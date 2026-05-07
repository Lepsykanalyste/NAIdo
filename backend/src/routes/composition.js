const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/composition/:articleId
router.get('/:articleId', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ca.*, sf.code AS groupe_code, sf.libelle AS groupe_libelle,
             f.libelle AS famille_libelle
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      JOIN familles_articles f ON f.id = ca.famille_id
      WHERE ca.article_id = $1 ORDER BY ca.ordre
    `, [req.params.articleId]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/composition/:articleId
router.put('/:articleId', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { lignes } = req.body;
    await client.query('DELETE FROM composition_article WHERE article_id=$1', [req.params.articleId]);
    for (let i = 0; i < (lignes||[]).length; i++) {
      const l = lignes[i];
      await client.query(
        'INSERT INTO composition_article (article_id,groupe_id,famille_id,pct,ordre) VALUES ($1,$2,$3,$4,$5)',
        [req.params.articleId, l.groupe_id, l.famille_id, l.pct||0, i]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'OK' });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

module.exports = router;
