const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { type, actif } = req.query;
    let q = `SELECT a.* FROM ateliers a WHERE 1=1`;
    const params = [];
    // Par défaut actifs seulement, sauf si actif=tous
    if (actif !== 'tous') q += ' AND a.actif=true';
    if (type) { params.push(type); q += ` AND a.type=$${params.length}`; }
    q += ' ORDER BY a.type, a.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { code, libelle, type, localisation } = req.body;
    if (!code || !libelle) return res.status(400).json({ error: 'Code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO ateliers (code,libelle,type,localisation) VALUES ($1,$2,$3,$4) RETURNING *',
      [code.toUpperCase().trim(), libelle.trim(), type||'production', localisation||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { libelle, type, localisation, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE ateliers SET libelle=$1, type=$2, localisation=$3, actif=$4 WHERE id=$5 RETURNING *',
      [libelle, type, localisation||null, actif !== false && actif !== 'false', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
