const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// ── MATIÈRES PREMIÈRES ────────────────────────────────────────

// GET /api/tracabilite/matieres
router.get('/matieres', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT mp.*, 
        COALESCE(SUM(lm.quantite_restante_kg), 0) AS stock_total_kg,
        COUNT(lm.id) AS nb_lots
      FROM matieres_premieres mp
      LEFT JOIN lots_matiere lm ON lm.matiere_id = mp.id
      GROUP BY mp.id ORDER BY mp.designation
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tracabilite/matieres
router.post('/matieres', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { reference, designation, type, stock_minimum } = req.body;
    const { rows } = await db.query(`
      INSERT INTO matieres_premieres (reference, designation, type, stock_minimum)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [reference, designation, type || 'granules', stock_minimum || 0]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LOTS MATIÈRE ──────────────────────────────────────────────

// GET /api/tracabilite/lots
router.get('/lots', auth, async (req, res) => {
  try {
    const { matiere_id } = req.query;
    let query = `
      SELECT lm.*, mp.designation AS matiere_nom, mp.reference AS matiere_ref
      FROM lots_matiere lm JOIN matieres_premieres mp ON mp.id = lm.matiere_id
      WHERE 1=1
    `;
    const params = [];
    if (matiere_id) { params.push(matiere_id); query += ` AND lm.matiere_id = $${params.length}`; }
    query += ' ORDER BY lm.date_reception DESC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tracabilite/lots — Réception matière
router.post('/lots', auth, role('chef_atelier', 'regleur'), async (req, res) => {
  try {
    const { matiere_id, numero_lot, fournisseur, quantite_recue_kg, date_reception } = req.body;
    const { rows } = await db.query(`
      INSERT INTO lots_matiere
        (matiere_id, numero_lot, fournisseur, quantite_recue_kg, quantite_restante_kg, date_reception)
      VALUES ($1,$2,$3,$4,$4,$5) RETURNING *
    `, [matiere_id, numero_lot, fournisseur, quantite_recue_kg, date_reception || new Date().toISOString().split('T')[0]]);

    // Mettre à jour stock
    await db.query(`
      UPDATE matieres_premieres
      SET stock_actuel = stock_actuel + $1 WHERE id = $2
    `, [quantite_recue_kg, matiere_id]);

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tracabilite/consommation — Lier consommation à session
router.post('/consommation', auth, async (req, res) => {
  try {
    const { lot_matiere_id, of_id, session_id, quantite_kg } = req.body;
    const { rows } = await db.query(`
      INSERT INTO consommations_matiere (lot_matiere_id, of_id, session_id, quantite_kg)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [lot_matiere_id, of_id, session_id, quantite_kg]);

    // Déduire du lot
    await db.query(`
      UPDATE lots_matiere SET quantite_restante_kg = quantite_restante_kg - $1 WHERE id = $2
    `, [quantite_kg, lot_matiere_id]);

    // Déduire du stock matière
    await db.query(`
      UPDATE matieres_premieres mp
      SET stock_actuel = stock_actuel - $1
      FROM lots_matiere lm
      WHERE lm.id = $2 AND mp.id = lm.matiere_id
    `, [quantite_kg, lot_matiere_id]);

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BILAN MATIÈRE ─────────────────────────────────────────────

// GET /api/tracabilite/bilan
router.get('/bilan', auth, async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;
    const debut = date_debut || new Date().toISOString().split('T')[0];
    const fin = date_fin || new Date().toISOString().split('T')[0];
    const { rows } = await db.query(`
      SELECT * FROM vue_bilan_matiere
      WHERE date_jour BETWEEN $1 AND $2
      ORDER BY date_jour DESC, machine_code
    `, [debut, fin]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tracabilite/ticket/:numero — Traçabilité complète d'un ticket
router.get('/ticket/:numero', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT tp.*,
        o.numero_of, o.quantite_cible, o.date_livraison_prevue,
        a.designation AS article, a.reference AS article_ref,
        a.dimensions, a.couleur,
        c.nom AS client,
        m.code AS machine_code, m.nom AS machine_nom,
        u.nom || ' ' || u.prenom AS operateur,
        sp.heure_debut AS session_debut,
        sp.regleur_temperature, sp.regleur_pression,
        lm.numero_lot AS lot_matiere, lm.fournisseur,
        mp.designation AS matiere
      FROM tickets_production tp
      JOIN ordres_fabrication o ON o.id = tp.of_id
      JOIN articles a ON a.id = o.article_id
      JOIN clients c ON c.id = o.client_id
      JOIN machines m ON m.id = tp.machine_id
      JOIN utilisateurs u ON u.id = tp.operateur_id
      JOIN sessions_production sp ON sp.id = tp.session_id
      LEFT JOIN lots_matiere lm ON lm.id = tp.lot_matiere_id
      LEFT JOIN matieres_premieres mp ON mp.id = lm.matiere_id
      WHERE tp.numero_ticket = $1
    `, [req.params.numero]);
    if (!rows.length) return res.status(404).json({ error: 'Ticket introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
