const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// GET /api/of — Liste des OF actifs
router.get('/', auth, async (req, res) => {
  try {
    const { statut, machine_id } = req.query;
    let query = `
      SELECT o.*, c.nom AS client_nom, a.designation AS article_nom,
             a.reference AS article_ref, a.dimensions, a.couleur,
             a.cadence_heure, a.temps_reglage_min, m.code AS machine_code
      FROM ordres_fabrication o
      JOIN clients c ON c.id = o.client_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); query += ` AND o.statut = $${params.length}`; }
    if (machine_id) { params.push(machine_id); query += ` AND o.machine_id = $${params.length}`; }
    query += ' ORDER BY o.priorite DESC, o.date_livraison_prevue ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/of/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, c.nom AS client_nom, a.designation AS article_nom,
             a.reference AS article_ref, a.dimensions, a.couleur,
             a.cadence_heure, a.temps_reglage_min, a.poids_mandrin_kg,
             m.code AS machine_code, m.nom AS machine_nom
      FROM ordres_fabrication o
      JOIN clients c ON c.id = o.client_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/of/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const { rows } = await db.query(
      'UPDATE ordres_fabrication SET statut=$1 WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
