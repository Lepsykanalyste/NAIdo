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
        nom: user.nom, prenom: user.prenom, atelier_id: user.atelier_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
    const postes = await listerPostes(user.id, user.role_nom);
    res.json({
      token,
      user: { id: user.id, login: user.login, nom: user.nom,
              prenom: user.prenom, role: user.role_nom, atelier_id: user.atelier_id, postes }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function listerPostes(userId, principal) {
  const { rows } = await db.query(`
    SELECT r.nom FROM utilisateur_postes up JOIN roles r ON r.id = up.role_id
    WHERE up.utilisateur_id = $1 ORDER BY r.nom`, [userId]);
  const liste = rows.map(r => r.nom);
  if (principal && !liste.includes(principal)) liste.unshift(principal);
  return liste;
}

// Changer de poste actif : le poste doit faire partie des postes attribues au compte
router.post('/changer-poste', require('../middleware/auth').auth, async (req, res) => {
  try {
    const poste = String(req.body.poste || '').trim();
    if (!poste) return res.status(400).json({ error: 'Poste requis' });
    const { rows: ok } = await db.query(`
      SELECT 1 FROM utilisateur_postes up JOIN roles r ON r.id = up.role_id
      WHERE up.utilisateur_id = $1 AND r.nom = $2`, [req.user.id, poste]);
    if (!ok.length) return res.status(403).json({ error: 'Ce poste ne vous est pas attribué' });
    const { rows: u } = await db.query(
      'SELECT login, nom, prenom, atelier_id FROM utilisateurs WHERE id = $1 AND actif = true', [req.user.id]);
    if (!u.length) return res.status(401).json({ error: 'Compte inactif' });
    const compte = u[0];
    const token = jwt.sign(
      { id: req.user.id, login: compte.login, role: poste, nom: compte.nom, prenom: compte.prenom, atelier_id: compte.atelier_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
    const postes = await listerPostes(req.user.id, null);
    res.json({ token, user: { id: req.user.id, login: compte.login, nom: compte.nom, prenom: compte.prenom,
                              role: poste, atelier_id: compte.atelier_id, postes } });
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
        nom: user.nom, prenom: user.prenom, atelier_id: user.atelier_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, login: user.login, nom: user.nom,
                               prenom: user.prenom, role: user.role_nom, atelier_id: user.atelier_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
