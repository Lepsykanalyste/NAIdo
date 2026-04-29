const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { atelier_id, type } = req.query;
    let q = `
      SELECT e.*, a.libelle AS atelier_libelle, a.code AS atelier_code
      FROM emplacements_stock e JOIN ateliers a ON a.id=e.atelier_id
      WHERE e.actif=true
    `;
    const params = [];
    if (atelier_id) { params.push(atelier_id); q += ` AND e.atelier_id=$${params.length}`; }
    if (type)       { params.push(type);       q += ` AND e.type=$${params.length}`; }
    q += ' ORDER BY a.libelle, e.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, role('super_admin','magasinier'), async (req, res) => {
  try {
    const { code, libelle, atelier_id, type, capacite_max_kg } = req.body;
    const { rows } = await db.query(
      'INSERT INTO emplacements_stock (code, libelle, atelier_id, type, capacite_max_kg) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [code.toUpperCase(), libelle, atelier_id, type, capacite_max_kg || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
