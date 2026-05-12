const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { numero_lot, quantite, designation, client_nom, motif, description, decision, actions } = req.body;
    const { rows } = await db.query(`
      INSERT INTO non_conformites (numero_lot, quantite, designation, client_nom, motif, description, decision, actions, declarant_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [numero_lot, quantite, designation, client_nom, motif, description, decision, actions, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT n.*, u.prenom || ' ' || u.nom AS controleur_nom
      FROM non_conformites n
      LEFT JOIN utilisateurs u ON u.id = n.declarant_id
      ORDER BY n.created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/clore', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE non_conformites SET statut='clos', closed_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
