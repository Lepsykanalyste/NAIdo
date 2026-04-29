const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// GET /api/alertes — Alertes non lues
router.get('/', auth, async (req, res) => {
  try {
    const { lue } = req.query;
    let query = `
      SELECT a.*, m.code AS machine_code, m.nom AS machine_nom,
             o.numero_of
      FROM alertes a
      LEFT JOIN machines m ON m.id = a.machine_id
      LEFT JOIN ordres_fabrication o ON o.id = a.of_id
      WHERE 1=1
    `;
    const params = [];
    if (lue !== undefined) { params.push(lue === 'true'); query += ` AND a.lue = $${params.length}`; }
    query += ' ORDER BY a.created_at DESC LIMIT 50';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/alertes/count — Compteur alertes non lues
router.get('/count', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT COUNT(*) FROM alertes WHERE lue = false');
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/alertes/:id/lire
router.put('/:id/lire', auth, async (req, res) => {
  try {
    await db.query('UPDATE alertes SET lue=true WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/alertes/lire-tout
router.put('/lire-tout', auth, async (req, res) => {
  try {
    await db.query('UPDATE alertes SET lue=true WHERE lue=false');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/alertes/config — Config seuils
router.get('/config', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM config_alertes ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/alertes/config/:id — Modifier seuil
router.put('/config/:id', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { seuil, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE config_alertes SET seuil=$1, actif=$2 WHERE id=$3 RETURNING *',
      [seuil, actif, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/alertes/verifier — Déclencher vérification manuelle
router.post('/verifier', auth, role('chef_atelier'), async (req, res) => {
  try {
    await db.query('SELECT verifier_alertes()');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
