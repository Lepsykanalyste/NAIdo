const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/lots-prod?article_id=xxx&atelier=AT3
// Retourne les lots disponibles d'une MP dans un atelier
router.get('/', auth, async (req, res) => {
  try {
    const { article_id, atelier } = req.query;
    let q = `
      SELECT l.*, a.designation AS article_nom, a.code AS article_code,
             e.code AS emplacement_code, e.libelle AS emplacement_libelle
      FROM lots_stock l
      LEFT JOIN articles a ON a.id=l.article_id
      LEFT JOIN emplacements_stock e ON e.id=l.emplacement_id
      WHERE l.statut='disponible' AND l.qte_disponible > 0
    `;
    const params = [];
    if (article_id) { params.push(article_id); q += ` AND l.article_id=$${params.length}`; }
    if (atelier) { params.push(atelier); q += ` AND (l.emplacement_atelier=$${params.length} OR l.emplacement_atelier IS NULL)`; }
    q += ' ORDER BY l.date_reception ASC'; // FIFO
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/lots-prod/of/:of_id — composition lots d'un OF
router.get('/of/:of_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ocl.*, a.designation AS mp_nom, a.code AS mp_code,
             l.numero_lot, l.qte_disponible AS lot_stock
      FROM of_composition_lots ocl
      LEFT JOIN articles a ON a.id=ocl.article_mp_id
      LEFT JOIN lots_stock l ON l.id=ocl.lot_id
      WHERE ocl.of_id=$1 ORDER BY ocl.created_at
    `, [req.params.of_id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/lots-prod/of/:of_id — ajouter lot à un OF
router.post('/of/:of_id', auth, async (req, res) => {
  try {
    const { article_mp_id, lot_id, nom_matiere, numero_lot,
            qte_prevue, pourcentage, unite_id } = req.body;
    const { rows } = await db.query(`
      INSERT INTO of_composition_lots
        (of_id, article_mp_id, lot_id, nom_matiere, numero_lot,
         qte_prevue, pourcentage, unite_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.params.of_id, article_mp_id||null, lot_id||null,
        nom_matiere||null, numero_lot||null,
        parseFloat(qte_prevue||0), parseFloat(pourcentage||0),
        unite_id||null]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/lots-prod/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM of_composition_lots WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/lots-prod/of/:of_id/consommer — déduire du stock
router.put('/of/:of_id/consommer', auth, async (req, res) => {
  try {
    const { rows: lots } = await db.query(
      'SELECT * FROM of_composition_lots WHERE of_id=$1 AND lot_id IS NOT NULL',
      [req.params.of_id]
    );
    for (const lot of lots) {
      await db.query(`
        UPDATE lots_stock 
        SET qte_disponible = qte_disponible - $1
        WHERE id=$2 AND qte_disponible >= $1
      `, [parseFloat(lot.qte_prevue||0), lot.lot_id]);
    }
    res.json({ ok: true, lots_consommes: lots.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
