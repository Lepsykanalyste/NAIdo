const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { of_id, resultats, observations } = req.body;
    if (!of_id) return res.status(400).json({ error: 'OF obligatoire' });
    const res_obj = typeof resultats === 'string' ? JSON.parse(resultats) : (resultats||{});
    // Regle ENR.ALP1-024 : la cession est autorisee seulement si TOUS les points requis sont conformes
    const REQUIS = ['designation', 'fiche_qualite', 'etat_emballages', 'quantite_caisse', 'coloris', 'conformite_finale'];
    const autorise = REQUIS.every(k => res_obj[k] === 'OK');
    const { rows } = await db.query(`
      INSERT INTO controles_cession (of_id, controleur_id, resultats, observations, autorise)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [of_id, req.user.id, JSON.stringify(res_obj), observations, autorise]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Resultats illisibles' });
    if (err.code === '23503' || err.code === '22P02') return res.status(400).json({ error: 'OF introuvable' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, o.numero_of, a.designation AS article,
             cl.raison_sociale AS client_nom,
             u.prenom || ' ' || u.nom AS controleur_nom
      FROM controles_cession c
      LEFT JOIN ordres_fabrication o ON o.id = c.of_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet cl ON cl.id = o.client_id
      LEFT JOIN utilisateurs u ON u.id = c.controleur_id
      ORDER BY c.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
