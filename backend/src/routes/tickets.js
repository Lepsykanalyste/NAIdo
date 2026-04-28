const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// POST /api/tickets — Créer un ticket
router.post('/', auth, async (req, res) => {
  try {
    const { session_id, of_id, machine_id, poids_brut_kg, poids_mandrin_kg, poids_dechets_kg, motif_dechet } = req.body;
    const poids_net = parseFloat(poids_brut_kg) - parseFloat(poids_mandrin_kg || 0);

    const { rows } = await db.query(`
      INSERT INTO tickets_production
        (session_id, of_id, machine_id, operateur_id,
         poids_brut_kg, poids_mandrin_kg, poids_net_kg,
         poids_dechets_kg, motif_dechet, qr_code_contenu)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'TEMP')
      RETURNING *
    `, [session_id, of_id, machine_id, req.user.id,
        poids_brut_kg, poids_mandrin_kg || 0, poids_net,
        poids_dechets_kg || 0, motif_dechet]);

    // Mettre à jour quantité produite sur l'OF
    await db.query(`
      UPDATE ordres_fabrication
      SET quantite_produite = quantite_produite + $1
      WHERE id = $2
    `, [poids_net, of_id]);

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/session/:session_id
router.get('/session/:session_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT tp.*, m.code AS machine_code, o.numero_of
      FROM tickets_production tp
      JOIN machines m ON m.id = tp.machine_id
      JOIN ordres_fabrication o ON o.id = tp.of_id
      WHERE tp.session_id = $1
      ORDER BY tp.created_at DESC
    `, [req.params.session_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/tickets/:id/imprime — Marquer comme imprimé
router.put('/:id/imprime', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE tickets_production SET imprime=true, imprime_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
