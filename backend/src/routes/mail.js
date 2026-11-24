'use strict';
// NAIdo - « Mon e-mail » : chaque utilisateur renseigne son compte e-mail (le mot de passe n'est jamais renvoye).
const express = require('express');
const { auth } = require('../middleware/auth');
const { lireCompte, enregistrerCompte, envoyerDepuisCompte } = require('../utils/mailcompte');
const router = express.Router();

router.get('/moi', auth, async (req, res) => {
  try {
    const c = await lireCompte(req.user.id);
    res.json(c ? { configure: true, host: c.smtp_host, port: c.smtp_port, user: c.smtp_user, expediteur: c.adresse_expediteur }
      : { configure: false });
  } catch (e) { console.error('[MAIL]', e.message); res.status(500).json({ error: 'Lecture impossible' }); }
});

router.put('/moi', auth, async (req, res) => {
  const b = req.body || {};
  const host = String(b.host || '').trim();
  const port = parseInt(b.port, 10) || 587;
  const user = String(b.user || '').trim();
  const expediteur = String(b.expediteur || user).trim();
  if (!host || !user) return res.status(400).json({ error: 'Serveur SMTP et identifiant requis' });
  if (![25, 465, 587, 2525].includes(port)) return res.status(400).json({ error: 'Port SMTP inattendu (587 ou 465 en general)' });
  try {
    await enregistrerCompte(req.user.id, { host, port, user, pass: b.pass ? String(b.pass) : null, expediteur });
    res.json({ ok: true });
  } catch (e) {
    console.error('[MAIL]', e.message);
    res.status(400).json({ error: e.message.includes('MAIL_CHIFFREMENT_KEY') ? 'Cle de chiffrement absente sur le serveur (MAIL_CHIFFREMENT_KEY)' : e.message });
  }
});

// Test : un message envoye a sa propre adresse
router.post('/moi/test', auth, async (req, res) => {
  try {
    const c = await lireCompte(req.user.id);
    if (!c) return res.status(400).json({ error: 'Configurez d\'abord votre compte e-mail' });
    await envoyerDepuisCompte(req.user.id, {
      to: c.adresse_expediteur,
      subject: 'NAIdo - test de votre compte e-mail',
      html: '<p>Ce message confirme que votre compte e-mail NAIdo fonctionne.</p>',
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Envoi de test impossible : ' + e.message }); }
});

module.exports = router;
