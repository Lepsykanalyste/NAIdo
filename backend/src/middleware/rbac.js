'use strict';
// NAIdo - controle d'acces par role (RBAC) : une seule politique (config/permissions.json), lue aussi par le serveur Python.
// RBAC_MODE=enforce (defaut) : refuse les actions interdites | audit : journalise sans bloquer (valve de secours).
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const FICHIER = process.env.RBAC_FILE || path.join(__dirname, '../config/permissions.json');
const POLITIQUE = JSON.parse(fs.readFileSync(FICHIER, 'utf-8'));

const segs = (p) => String(p).split('?')[0].split('/').filter(Boolean);
const correspond = (motif, chemin) => {              // motif = debut du chemin, '*' = n'importe quel segment
  const m = segs(motif), c = segs(chemin);
  return m.length <= c.length && m.every((s, i) => s === '*' || s === c[i]);
};
const estLecture = (m) => ['GET', 'HEAD', 'OPTIONS'].includes(String(m).toUpperCase());
const methodeOk = (regle, m) => !regle.methodes || regle.methodes.includes(String(m).toUpperCase());
const normaliserRole = (r) => { r = String(r || '').toLowerCase().trim(); return (POLITIQUE.alias || {})[r] || r; };

function estPublique(methode, chemin) {
  return POLITIQUE.publiques.some((r) => methodeOk(r, methode) && correspond(r.motif, chemin));
}

function decider(roleBrut, methode, chemin) {
  const role = normaliserRole(roleBrut);
  if (role === 'super_admin') return { autorise: true, raison: 'super_admin' };
  if (POLITIQUE.super_admin_seulement.some((r) => methodeOk(r, methode) && correspond(r.motif, chemin))) return { autorise: false, raison: 'reserve au super_admin' };
  if (POLITIQUE.tous_connectes.some((r) => methodeOk(r, methode) && correspond(r.motif, chemin))) return { autorise: true, raison: 'tous connectes' };
  if (role === 'directeur') return { autorise: true, raison: 'directeur' };
  let meilleure = null;                                // regle la plus precise = celle qui a le plus de segments
  for (const r of POLITIQUE.regles) {
    if (correspond(r.motif, chemin) && (!meilleure || segs(r.motif).length > segs(meilleure.motif).length)) meilleure = r;
  }
  const lect = estLecture(methode);
  const liste = meilleure ? (lect ? meilleure.lecture : meilleure.ecriture) : (lect ? POLITIQUE.defaut.lecture : POLITIQUE.defaut.ecriture);
  const ok = liste.includes(role);
  return { autorise: ok, raison: ok ? (meilleure ? meilleure.motif : 'defaut') : `role '${role || '?'}' non autorise sur ${meilleure ? meilleure.motif : 'defaut'} (${lect ? 'lecture' : 'ecriture'})` };
}

// Ouverture d'un PDF protege depuis la barre d'adresse d'un navigateur (sans jeton) : page qui relit le jeton et redemande le PDF
const PAGE_PDF = "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>NAIdo - ouverture du document</title></head><body style=\"font-family:sans-serif;text-align:center;padding:40px;color:#374151\"><p id=\"m\">Ouverture du document...</p><script>\n(function () {\n  var m = document.getElementById('m');\n  function echec(texte) {\n    m.textContent = texte + ' ';\n    var a = document.createElement('a'); a.href = '/'; a.textContent = 'Ouvrir NAIdo';\n    m.appendChild(a);\n  }\n  var t = null;\n  try { t = localStorage.getItem('naido_token'); } catch (e) {}\n  if (!t) { echec('Connectez-vous d abord a NAIdo, puis rouvrez ce lien.'); return; }\n  fetch(location.pathname + location.search, { headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/pdf' } })\n    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })\n    .then(function (b) { location.replace(URL.createObjectURL(b)); })\n    .catch(function (e) { echec('Impossible d ouvrir le document (' + (e && e.message ? e.message : 'erreur') + '). Votre session a peut-etre expire : reconnectez-vous, puis rouvrez ce lien.'); });\n})();\n</script></body></html>";
function estOuvertureNavigateurPdf(methode, chemin, accept) {
  return methode === 'GET' && chemin.endsWith('/pdf') && /text\/html/i.test(accept || '');
}

function middleware(req, res, next) {
  const chemin = req.originalUrl.split('?')[0];
  if (estPublique(req.method, chemin)) return next();
  const h = req.headers.authorization;
  if (!h && estOuvertureNavigateurPdf(req.method, chemin, req.headers.accept)) return res.set('Cache-Control', 'no-store').type('html').send(PAGE_PDF);
  if (!h || !h.startsWith('Bearer ')) return next();   // sans jeton : la route repond 401
  let payload;
  try { payload = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch { return next(); }
  const d = decider(payload.role, req.method, chemin);
  if (d.autorise) return next();
  console.warn(`[RBAC] REFUS ${payload.login || payload.id} role=${payload.role} ${req.method} ${chemin} : ${d.raison}`);
  if ((process.env.RBAC_MODE || 'enforce') === 'audit') return next();
  return res.status(403).json({ error: 'Acces refuse : votre role ne permet pas cette action' });
}

module.exports = middleware;
module.exports.decider = decider;
module.exports.estPublique = estPublique;
module.exports.POLITIQUE = POLITIQUE;
