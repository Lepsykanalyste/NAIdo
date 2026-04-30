const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password)
      return res.status(400).json({ error: 'Login et mot de passe requis' });
    const { rows } = await db.query(`
      SELECT u.*,
        COALESCE(u.role, r.nom) AS role_nom
      FROM utilisateurs u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.login = $1 AND u.actif = true
    `, [login]);
    if (!rows.length)
      return res.status(401).json({ error: 'Identifiants incorrects' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Identifiants incorrects' });
    const token = jwt.sign(
      { id: user.id, login: user.login, role: user.role_nom,
        nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
    res.json({
      token,
      user: { id: user.id, login: user.login, nom: user.nom,
              prenom: user.prenom, role: user.role_nom }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login-badge', async (req, res) => {
  try {
    const { badge_qr } = req.body;
    if (!badge_qr) return res.status(400).json({ error: 'Badge requis' });
    const { rows } = await db.query(`
      SELECT u.*, COALESCE(u.role, r.nom) AS role_nom
      FROM utilisateurs u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.badge_qr = $1 AND u.actif = true
    `, [badge_qr]);
    if (!rows.length) return res.status(401).json({ error: 'Badge non reconnu' });
    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, login: user.login, role: user.role_nom,
        nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, login: user.login, nom: user.nom,
                               prenom: user.prenom, role: user.role_nom } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
