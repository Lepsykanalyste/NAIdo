const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// ── UNITÉS DE MESURE ─────────────────────────────────────────
router.get('/unites', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM unites_mesure WHERE actif=true ORDER BY type, libelle');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/unites', auth, role('super_admin','chef_atelier'), async (req, res) => {
  try {
    const { code, libelle, type } = req.body;
    const { rows } = await db.query(
      'INSERT INTO unites_mesure (code, libelle, type) VALUES ($1,$2,$3) RETURNING *',
      [code.toUpperCase(), libelle, type]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FAMILLES ARTICLES ─────────────────────────────────────────
router.get('/familles', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT f.*, COUNT(a.id) AS nb_articles
      FROM familles_articles f
      LEFT JOIN articles a ON a.famille_id = f.id AND a.actif = true
      WHERE f.actif = true
      GROUP BY f.id ORDER BY f.libelle
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/familles', auth, role('super_admin','chef_atelier'), async (req, res) => {
  try {
    const { code, libelle, description } = req.body;
    const { rows } = await db.query(
      'INSERT INTO familles_articles (code, libelle, description) VALUES ($1,$2,$3) RETURNING *',
      [code.toUpperCase(), libelle, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SOUS-FAMILLES ─────────────────────────────────────────────
router.get('/sous-familles', auth, async (req, res) => {
  try {
    const { famille_id } = req.query;
    let q = `
      SELECT sf.*, f.libelle AS famille_libelle
      FROM sous_familles_articles sf
      JOIN familles_articles f ON f.id = sf.famille_id
      WHERE sf.actif = true
    `;
    const params = [];
    if (famille_id) { params.push(famille_id); q += ` AND sf.famille_id = $${params.length}`; }
    q += ' ORDER BY f.libelle, sf.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sous-familles', auth, role('super_admin','chef_atelier'), async (req, res) => {
  try {
    const { famille_id, code, libelle } = req.body;
    const { rows } = await db.query(
      'INSERT INTO sous_familles_articles (famille_id, code, libelle) VALUES ($1,$2,$3) RETURNING *',
      [famille_id, code.toUpperCase(), libelle]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CATÉGORIES ────────────────────────────────────────────────
router.get('/categories', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM categories_articles WHERE actif=true ORDER BY libelle');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
