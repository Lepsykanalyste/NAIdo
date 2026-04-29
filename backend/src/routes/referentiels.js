const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// ── UNITÉS DE MESURE ──────────────────────────────────────────

// Toutes les unités (actives ET inactives) - pour le toggle
router.get('/unites/toutes', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM unites_mesure ORDER BY type, libelle'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Unités actives uniquement - pour les formulaires
router.get('/unites', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM unites_mesure WHERE actif=true ORDER BY type, libelle'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/unites', auth, async (req, res) => {
  try {
    const { code, libelle, type } = req.body;
    if (!code || !libelle) return res.status(400).json({ error: 'Code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO unites_mesure (code, libelle, type) VALUES ($1,$2,$3) RETURNING *',
      [code.toUpperCase().trim(), libelle.trim(), type || 'masse']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/unites/:id', auth, async (req, res) => {
  try {
    const { libelle, type, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE unites_mesure SET libelle=$1, type=$2, actif=$3 WHERE id=$4 RETURNING *',
      [libelle, type, actif !== false && actif !== 'false', req.params.id]
    );
    res.json(rows[0]);
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

router.post('/familles', auth, async (req, res) => {
  try {
    const { code, libelle, description } = req.body;
    if (!code || !libelle) return res.status(400).json({ error: 'Code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO familles_articles (code, libelle, description) VALUES ($1,$2,$3) RETURNING *',
      [code.toUpperCase().trim(), libelle.trim(), description]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/familles/:id', auth, async (req, res) => {
  try {
    const { libelle, description, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE familles_articles SET libelle=$1, description=$2, actif=$3 WHERE id=$4 RETURNING *',
      [libelle, description, actif !== false, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SOUS-FAMILLES ─────────────────────────────────────────────

router.get('/sous-familles', auth, async (req, res) => {
  try {
    const { famille_id } = req.query;
    const params = [];
    let q = `
      SELECT sf.*, f.libelle AS famille_libelle, f.code AS famille_code
      FROM sous_familles_articles sf
      JOIN familles_articles f ON f.id = sf.famille_id
      WHERE sf.actif = true
    `;
    if (famille_id) { params.push(famille_id); q += ` AND sf.famille_id = $1`; }
    q += ' ORDER BY f.libelle, sf.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sous-familles', auth, async (req, res) => {
  try {
    const { famille_id, code, libelle } = req.body;
    if (!famille_id || !code || !libelle) return res.status(400).json({ error: 'Famille, code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO sous_familles_articles (famille_id, code, libelle) VALUES ($1,$2,$3) RETURNING *',
      [famille_id, code.toUpperCase().trim(), libelle.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: err.message });
  }
});

// ── CATÉGORIES ────────────────────────────────────────────────

router.get('/categories', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM categories_articles WHERE actif=true ORDER BY libelle'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', auth, async (req, res) => {
  try {
    const { code, libelle } = req.body;
    if (!code || !libelle) return res.status(400).json({ error: 'Code et libellé requis' });
    const { rows } = await db.query(
      'INSERT INTO categories_articles (code, libelle) VALUES ($1,$2) RETURNING *',
      [code.toUpperCase().trim(), libelle.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code déjà existant' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
