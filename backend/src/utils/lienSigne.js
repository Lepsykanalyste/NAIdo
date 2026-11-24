'use strict';
// NAIdo - lien signe et temporaire pour un document (QR code scanne depuis un telephone, sans connexion).
// Le jeton est signe avec JWT_SECRET et expire (30 jours par defaut).
const crypto = require('crypto');

const secret = () => process.env.JWT_SECRET || '';
const signature = (base) => crypto.createHmac('sha256', secret()).update('doc:' + base).digest('base64url');

function signer(id, jours = 30) {
  const exp = Math.floor(Date.now() / 1000) + jours * 86400;
  const base = `${id}.${exp}`;
  return `${base}.${signature(base)}`;
}

function verifier(id, jeton) {
  const parts = String(jeton || '').split('.');
  if (parts.length !== 3) return false;
  const [pid, exp, sig] = parts;
  if (pid !== String(id) || Number(exp) < Date.now() / 1000) return false;
  const attendue = Buffer.from(signature(`${pid}.${exp}`));
  const recue = Buffer.from(sig);
  return recue.length === attendue.length && crypto.timingSafeEqual(recue, attendue);
}

module.exports = { signer, verifier };
