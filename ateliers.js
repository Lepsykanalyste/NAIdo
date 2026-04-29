const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let q = `SELECT a.*, u.nom||' '||u.prenom AS responsable_nom FROM ateliers a LEFT JOIN utilisateurs u ON u.id=a.responsable_id WHERE a.actif=true`;
    const params = [];
    if (type) { params.push(type); q += ` AND a.type=$1`; }
    q += ' ORDER BY a.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error:err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { code, libelle, type, localisation } = req.body;
    if (!code||!libelle) return res.status(400).json({ error:'Code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO ateliers (code,libelle,type,localisation) VALUES ($1,$2,$3,$4) RETURNING *',
      [code.toUpperCase().trim(), libelle.trim(), type||'production', localisation]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(err.code==='23505'?400:500).json({ error:err.code==='23505'?'Code déjà existant':err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { libelle, type, responsable_id, localisation, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE ateliers SET libelle=$1,type=$2,responsable_id=$3,localisation=$4,actif=$5 WHERE id=$6 RETURNING *',
      [libelle, type, responsable_id||null, localisation, actif!==false, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error:err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE ateliers SET actif=false WHERE id=$1', [req.params.id]);
    res.json({ success:true });
  } catch (err) { res.status(500).json({ error:err.message }); }
});

module.exports = router;
