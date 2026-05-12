const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { of_id, resultats, observations } = req.body;
    const res_obj = typeof resultats === 'string' ? JSON.parse(resultats) : (resultats||{});
    const autorise = Object.values(res_obj).filter(v=>v==='OK').length >= 5;
    const { rows } = await db.query(`
      INSERT INTO controles_cession (of_id, controleur_id, resultats, observations, autorise)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [of_id, req.user.id, JSON.stringify(res_obj), observations, autorise]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, o.numero_of, a.designation AS article,
             cl.raison_sociale AS client_nom,
             u.prenom || ' ' || u.nom AS controleur_nom
      FROM controles_cession c
      LEFT JOIN ordres_fabrication o ON o.id = c.of_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet cl ON cl.id = o.client_id
      LEFT JOIN utilisateurs u ON u.id = c.controleur_id
      ORDER BY c.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
