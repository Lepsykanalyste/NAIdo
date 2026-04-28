const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { auth, role } = require('../middleware/auth');

// GET /api/users
router.get('/', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nom, u.prenom, u.login, u.badge_qr, u.actif, r.nom AS role
      FROM utilisateurs u JOIN roles r ON r.id = u.role_id ORDER BY u.nom
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { nom, prenom, login, password, role_nom, badge_qr } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const roleRes = await db.query('SELECT id FROM roles WHERE nom=$1', [role_nom]);
    if (!roleRes.rows.length) return res.status(400).json({ error: 'Rôle invalide' });

    const { rows } = await db.query(`
      INSERT INTO utilisateurs (nom, prenom, login, password_hash, role_id, badge_qr)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nom, prenom, login, badge_qr
    `, [nom, prenom, login, hash, roleRes.rows[0].id, badge_qr]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:id
router.put('/:id', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { nom, prenom, actif, role_nom, badge_qr, password } = req.body;
    const roleRes = await db.query('SELECT id FROM roles WHERE nom=$1', [role_nom]);
    let hash;
    if (password) hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(`
      UPDATE utilisateurs SET
        nom=$1, prenom=$2, actif=$3, role_id=$4, badge_qr=$5
        ${hash ? ', password_hash=$7' : ''}
      WHERE id=$6 RETURNING id, nom, prenom, login, actif, badge_qr
    `, hash
      ? [nom, prenom, actif, roleRes.rows[0].id, badge_qr, req.params.id, hash]
      : [nom, prenom, actif, roleRes.rows[0].id, badge_qr, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
