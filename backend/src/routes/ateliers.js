const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { type, actif } = req.query;
    let q = 'SELECT a.*, u.nom||\'\'||u.prenom AS responsable_nom FROM ateliers a LEFT JOIN utilisateurs u ON u.id=a.responsable_id WHERE 1=1';
    const params = [];
    if (actif !== 'false') q += ' AND a.actif=true';
    if (type) { params.push(type); q += ` AND a.type=$${params.length}`; }
    q += ' ORDER BY a.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, role('super_admin'), async (req, res) => {
  try {
    const { code, libelle, type, localisation } = req.body;
    const { rows } = await db.query(
      'INSERT INTO ateliers (code, libelle, type, localisation) VALUES ($1,$2,$3,$4) RETURNING *',
      [code.toUpperCase(), libelle, type, localisation]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, role('super_admin'), async (req, res) => {
  try {
    const { libelle, responsable_id, localisation, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE ateliers SET libelle=$1, responsable_id=$2, localisation=$3, actif=$4 WHERE id=$5 RETURNING *',
      [libelle, responsable_id, localisation, actif, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
