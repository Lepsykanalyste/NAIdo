const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM shifts ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
