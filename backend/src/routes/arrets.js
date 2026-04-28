const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// POST /api/arrets — Déclarer un arrêt
router.post('/', auth, async (req, res) => {
  try {
    const { session_id, machine_id, cause, details } = req.body;
    const { rows } = await db.query(`
      INSERT INTO arrêts_machine (session_id, machine_id, operateur_id, cause, details)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [session_id, machine_id, req.user.id, cause, details]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/arrets/:id/relancer — Clôturer un arrêt
router.put('/:id/relancer', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE arrêts_machine SET heure_fin=NOW(), statut='clos'
      WHERE id=$1 RETURNING *
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/arrets/session/:session_id
router.get('/session/:session_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM arrêts_machine WHERE session_id=$1 ORDER BY heure_debut DESC',
      [req.params.session_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
