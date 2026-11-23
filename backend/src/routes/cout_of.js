'use strict';
// NAIdo - Cout de revient par OF : matieres, temps machine, interventions, achats. Maintenance rattachee a l'OF.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const err = (res, e, msg) => { console.error('[COUT-OF]', msg, e?.message || e); res.status(e?.http || 500).json({ error: e?.userMessage || msg }); };
const user = (msg, http = 400) => { const e = new Error(msg); e.userMessage = msg; e.http = http; return e; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function coutDeRevient(ofId) {
  const [mat, mach, interv, ach, taux] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(dl.qte_livree * COALESCE(ls.prix_unitaire, 0)), 0) AS montant
              FROM dbm_livraisons dl JOIN dbm d ON d.id = dl.dbm_id
              LEFT JOIN lots_stock ls ON ls.article_id = dl.article_id AND ls.numero_lot = dl.numero_lot
              WHERE d.of_id = $1`, [ofId]),
    db.query(`SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s.heure_fin - s.heure_debut)) / 3600), 0) AS heures,
                     COALESCE(SUM(EXTRACT(EPOCH FROM (s.heure_fin - s.heure_debut)) / 3600
                       * COALESCE(m.cout_horaire_fcfa, (SELECT valeur::numeric FROM parametres_systeme WHERE cle = 'taux_horaire_machine_fcfa'))), 0) AS montant
              FROM sessions_production s LEFT JOIN machines m ON m.id = s.machine_id
              WHERE s.of_id = $1 AND s.heure_debut IS NOT NULL AND s.heure_fin IS NOT NULL`, [ofId]),
    db.query(`SELECT COALESCE(SUM(cout_total), 0) AS montant, COUNT(*)::int AS n FROM ordres_travail WHERE of_id = $1`, [ofId]),
    db.query(`SELECT COALESCE(SUM(montant_ttc), 0) AS montant, COUNT(*)::int AS n FROM commandes_achat
              WHERE of_id = $1 AND validation = 'validee'`, [ofId]),
    db.query(`SELECT valeur FROM parametres_systeme WHERE cle = 'taux_horaire_machine_fcfa'`),
  ]);
  const tauxH = num(taux.rows[0]?.valeur);
  const heures = num(mach.rows[0].heures);
  const matieres = num(mat.rows[0].montant);
  const temps = num(mach.rows[0].montant);
  const interventions = num(interv.rows[0].montant);
  const achats = num(ach.rows[0].montant);
  return {
    matieres_fcfa: Math.round(matieres),
    temps_machine: { heures: Math.round(heures * 100) / 100, taux_horaire_fcfa: tauxH, montant_fcfa: Math.round(temps) },
    interventions_maintenance: { nombre: interv.rows[0].n, montant_fcfa: Math.round(interventions) },
    achats_valides: { nombre: ach.rows[0].n, montant_fcfa: Math.round(achats) },
    total_fcfa: Math.round(matieres + temps + interventions + achats),
  };
}

// Cout horaire par machine : vide = valeur provisoire de l'atelier (parametre)
router.get('/machines', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT m.id, m.code, m.nom, m.cout_horaire_fcfa,
        (SELECT valeur::numeric FROM parametres_systeme WHERE cle = 'taux_horaire_machine_fcfa') AS taux_provisoire
      FROM machines m WHERE m.actif ORDER BY m.code`);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur liste machines'); }
});

router.put('/machines/:id/cout-horaire', auth, async (req, res) => {
  if (!['directeur', 'super_admin'].includes(String(req.user?.role || ''))) return res.status(403).json({ error: 'Seule la direction fixe le coût horaire des machines' });
  if (!UUID.test(req.params.id) && !/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Machine invalide' });
  const v = req.body?.cout_horaire_fcfa;
  const montant = v === null || v === '' ? null : Number(v);
  if (montant !== null && (!Number.isFinite(montant) || montant < 0)) return res.status(400).json({ error: 'Le coût horaire doit être un nombre positif (ou vide pour la valeur provisoire)' });
  try {
    const { rows } = await db.query('UPDATE machines SET cout_horaire_fcfa = $2 WHERE id = $1 RETURNING id, code, nom, cout_horaire_fcfa', [req.params.id, montant]);
    if (!rows.length) return res.status(404).json({ error: 'Machine introuvable' });
    res.json(rows[0]);
  } catch (e) { err(res, e, 'Erreur coût horaire machine'); }
});

router.get('/of/:id', auth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'OF invalide' });
  try {
    const of = (await db.query('SELECT id, numero_of FROM ordres_fabrication WHERE id = $1', [req.params.id])).rows[0];
    if (!of) return res.status(404).json({ error: 'OF introuvable' });
    res.json({ of: of.numero_of, ...(await coutDeRevient(of.id)) });
  } catch (e) { err(res, e, 'Erreur cout de revient'); }
});

// Rattacher une intervention de maintenance a l'OF sur lequel la panne est survenue
router.put('/ordres-travail/:id/rattacher', auth, async (req, res) => {
  if (!UUID.test(req.params.id) || !UUID.test(String(req.body?.of_id || ''))) return res.status(400).json({ error: 'Intervention et OF requis' });
  try {
    const { rows } = await db.query('UPDATE ordres_travail SET of_id = $2 WHERE id = $1 RETURNING id, numero_ot, of_id', [req.params.id, req.body.of_id]);
    if (!rows.length) return res.status(404).json({ error: 'Intervention introuvable' });
    res.json(rows[0]);
  } catch (e) { err(res, e, 'Erreur rattachement'); }
});

// Une piece ou une prestation pour une intervention devient une demande d'achat rattachee a l'OF (ou a un libelle)
router.post('/ordres-travail/:id/demande-achat', auth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Intervention invalide' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const ot = (await client.query('SELECT id, numero_ot, of_id FROM ordres_travail WHERE id = $1', [req.params.id])).rows[0];
    if (!ot) throw user('Intervention introuvable', 404);
    const lignes = (req.body?.lignes || []).filter(l => num(l.quantite_demandee) > 0 && String(l.designation || '').trim());
    if (!lignes.length) throw user('Indiquez au moins une pièce ou prestation avec sa quantité');
    let of_id = ot.of_id, libelle = null;
    if (!of_id) {
      // intervention sans OF : frais de maintenance (libelle), obligatoire
      libelle = req.body?.libelle_frais_id || (await client.query("SELECT id FROM libelles_frais WHERE lower(btrim(libelle)) = 'maintenance machines'")).rows[0]?.id;
      if (!libelle) throw user('Cette intervention n\'est pas rattachée à un OF : choisissez un libellé de frais');
    }
    const n = await client.query(`SELECT 'DA-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('seq_demande_achat_num')::text,5,'0') AS num`);
    const { rows: [da] } = await client.query(
      `INSERT INTO demandes_achat (numero_demande, demandeur_id, statut, notes, of_id, libelle_frais_id, ot_id)
       VALUES ($1,$2,'en_attente',$3,$4,$5,$6) RETURNING *`,
      [n.rows[0].num, req.user?.id || null, `Intervention ${ot.numero_ot}`, of_id, libelle, ot.id]);
    for (const l of lignes) {
      await client.query(`INSERT INTO lignes_demande_achat (demande_id, article_id, designation, quantite_demandee, notes) VALUES ($1,$2,$3,$4,$5)`,
        [da.id, l.article_id || null, l.designation, num(l.quantite_demandee), l.notes || null]);
    }
    await client.query('COMMIT');
    res.status(201).json(da);
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur demande d\'achat maintenance'); }
  finally { client.release(); }
});

module.exports = router;
module.exports.coutDeRevient = coutDeRevient;
