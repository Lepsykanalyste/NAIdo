const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/machines?atelier_id=AT3
router.get('/', auth, async (req, res) => {
  try {
    const { atelier_id } = req.query;
    let query = 'SELECT * FROM machines WHERE actif = true';
    const params = [];
    if (atelier_id) { params.push(atelier_id); query += ` AND atelier_id = $${params.length}`; }
    query += ' ORDER BY type, numero';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/imprimante', auth, async (req, res) => {
  try {
    const { imprimante_type, imprimante_adresse } = req.body;
    const { rows } = await db.query(
      'UPDATE machines SET imprimante_type=$1, imprimante_adresse=$2 WHERE id=$3 RETURNING *',
      [imprimante_type, imprimante_adresse, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
