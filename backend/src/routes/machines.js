const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM machines WHERE actif = true ORDER BY type, numero'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/imprimante', auth, role('chef_atelier'), async (req, res) => {
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
