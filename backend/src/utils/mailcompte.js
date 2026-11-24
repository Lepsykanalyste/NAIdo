'use strict';
// NAIdo - compte e-mail de chaque utilisateur : stockage chiffre et envoi depuis son adresse.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

// Cle de chiffrement : variable d'environnement MAIL_CHIFFREMENT_KEY (une phrase longue, gardee sur le serveur)
function cle() {
  const secret = process.env.MAIL_CHIFFREMENT_KEY;
  if (!secret || secret.length < 16) throw new Error('MAIL_CHIFFREMENT_KEY absente ou trop courte (16 caracteres minimum)');
  return crypto.createHash('sha256').update(secret).digest();
}

function chiffrer(texte) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle(), iv);
  const enc = Buffer.concat([c.update(String(texte), 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

function dechiffrer(valeur) {
  const [iv, tag, enc] = String(valeur).split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', cle(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

// Configuration (sans mot de passe) de l'utilisateur, ou null
async function lireCompte(userId) {
  const { rows } = await db.query(
    'SELECT smtp_host, smtp_port, smtp_user, adresse_expediteur FROM comptes_mail WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// Enregistre (ou met a jour) le compte. Le mot de passe n'est reecrit que s'il est fourni.
async function enregistrerCompte(userId, { host, port, user, pass, expediteur }) {
  const existe = await lireCompte(userId);
  if (!existe && !pass) throw new Error('Mot de passe requis pour un nouveau compte');
  if (pass) {
    await db.query(
      `INSERT INTO comptes_mail (user_id, smtp_host, smtp_port, smtp_user, smtp_pass_chiffre, adresse_expediteur, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (user_id) DO UPDATE SET smtp_host = EXCLUDED.smtp_host, smtp_port = EXCLUDED.smtp_port,
         smtp_user = EXCLUDED.smtp_user, smtp_pass_chiffre = EXCLUDED.smtp_pass_chiffre,
         adresse_expediteur = EXCLUDED.adresse_expediteur, updated_at = now()`,
      [userId, host, port, user, chiffrer(pass), expediteur]);
  } else {
    await db.query(
      `UPDATE comptes_mail SET smtp_host = $2, smtp_port = $3, smtp_user = $4, adresse_expediteur = $5, updated_at = now()
       WHERE user_id = $1`, [userId, host, port, user, expediteur]);
  }
}

// Envoi depuis le compte de l'utilisateur connecte
async function envoyerDepuisCompte(userId, { to, subject, html }) {
  const { rows } = await db.query('SELECT * FROM comptes_mail WHERE user_id = $1', [userId]);
  const c = rows[0];
  if (!c) throw new Error("Aucun compte e-mail configure : renseignez-le dans « Mon e-mail »");
  const port = parseInt(c.smtp_port, 10) || 587;
  const transport = nodemailer.createTransport({
    host: c.smtp_host, port, secure: port === 465,
    auth: { user: c.smtp_user, pass: dechiffrer(c.smtp_pass_chiffre) },
  });
  await transport.sendMail({ from: c.adresse_expediteur, to, subject, html });
}

module.exports = { lireCompte, enregistrerCompte, envoyerDepuisCompte };
