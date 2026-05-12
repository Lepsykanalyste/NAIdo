const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { of_id, machine_id, heure_debut, heure_fin, resultats, actions } = req.body;
    const { rows } = await db.query(`
      INSERT INTO rondes_chef_quart (of_id, machine_id, chef_id, heure_debut, heure_fin, resultats, actions)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [of_id, machine_id||null, req.user.id, heure_debut, heure_fin, resultats||'{}', actions]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, o.numero_of, a.designation AS article,
             m.code AS machine, u.prenom || ' ' || u.nom AS chef_nom
      FROM rondes_chef_quart r
      LEFT JOIN ordres_fabrication o ON o.id = r.of_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = r.machine_id
      LEFT JOIN utilisateurs u ON u.id = r.chef_id
      ORDER BY r.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
