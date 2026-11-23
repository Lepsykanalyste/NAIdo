'use strict';
// NAIdo - Droits par ecran : chaque poste voit et modifie les ecrans qu'on lui coche. Source du menu et des tableaux de bord.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
const ECRANS = require('../config/ecrans.json');
const ECRAN_IDS = new Set(ECRANS.map(e => e.id));
const DIRECTION = ['directeur', 'super_admin'];
const err = (res, e, msg) => { console.error('[DROITS-ECRANS]', msg, e?.message || e); res.status(500).json({ error: msg }); };

// Liste des ecrans et matrice (direction seulement)
router.get('/ecrans', auth, async (req, res) => {
  if (!DIRECTION.includes(String(req.user?.role || ''))) return res.status(403).json({ error: 'Réservé à la direction' });
  try {
    const postes = (await db.query("SELECT nom AS code, COALESCE(libelle, nom) AS libelle FROM roles WHERE nom NOT IN ('directeur','super_admin') ORDER BY libelle")).rows;
    const lignes = (await db.query('SELECT poste, ecran, voir, modifier FROM droits_ecrans')).rows;
    const matrice = {};
    for (const l of lignes) { (matrice[l.poste] = matrice[l.poste] || {})[l.ecran] = { voir: l.voir, modifier: l.modifier }; }
    res.json({ ecrans: ECRANS, postes, matrice, toujours_complets: DIRECTION });
  } catch (e) { err(res, e, 'Erreur lecture des droits par écran'); }
});

// Modifier un droit : un ecran, un poste. Modifier implique voir ; ne pas voir enleve modifier.
router.put('/ecrans', auth, async (req, res) => {
  if (!DIRECTION.includes(String(req.user?.role || ''))) return res.status(403).json({ error: 'Seule la direction modifie les droits' });
  const { poste, ecran } = req.body || {};
  if (!poste || !ECRAN_IDS.has(ecran)) return res.status(400).json({ error: 'Poste ou écran inconnu' });
  if (DIRECTION.includes(poste)) return res.status(400).json({ error: 'La direction garde toujours tous les écrans' });
  try {
    const existe = await db.query('SELECT 1 FROM roles WHERE nom = $1', [poste]);
    if (!existe.rows.length) return res.status(400).json({ error: `Poste inconnu : ${poste}` });
    let voir = !!req.body.voir, modifier = !!req.body.modifier;
    if (!voir) modifier = false;
    if (modifier) voir = true;
    await db.query(`INSERT INTO droits_ecrans (poste, ecran, voir, modifier) VALUES ($1,$2,$3,$4)
      ON CONFLICT (poste, ecran) DO UPDATE SET voir = EXCLUDED.voir, modifier = EXCLUDED.modifier`, [poste, ecran, voir, modifier]);
    res.json({ poste, ecran, voir, modifier });
  } catch (e) { err(res, e, 'Erreur enregistrement du droit'); }
});

// Ecrans visibles pour la personne connectee (son poste actif) : sert au menu et aux tableaux de bord
router.get('/mon-menu', auth, async (req, res) => {
  const role = String(req.user?.role || '');
  if (DIRECTION.includes(role)) return res.json({ tout: true, ecrans: ECRANS.map(e => e.id) });
  try {
    const { rows } = await db.query('SELECT ecran FROM droits_ecrans WHERE poste = $1 AND voir = true', [role]);
    res.json({ tout: false, ecrans: rows.map(r => r.ecran) });
  } catch (e) { err(res, e, 'Erreur lecture du menu'); }
});

module.exports = router;
