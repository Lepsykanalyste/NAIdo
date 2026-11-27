const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');
const { assurerReglages } = require('../utils/reglagesOf');
assurerReglages().catch(e => console.error('[REGLEUR] historique des reglages :', e.message));

// Protege les textes inseres dans les pages HTML publiques (QR code)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseUrl = (req) => process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
const fs = require('fs');
const path = require('path');

// Signataire d'un ticket : nom, fonction, matricule et signature (image du profil, comme sur les autres documents)
const FONCTIONS = { regleur: 'Opérateur extrusion', technicien_regleur: 'Opérateur extrusion', operateur_ext: 'Opérateur extrusion', chef_atelier: "Chef d'atelier", operateur: 'Opérateur' };
async function signataire(userId) {
  if (!userId) return null;
  const { rows } = await db.query(`SELECT trim(COALESCE(prenom,'') || ' ' || COALESCE(nom,'')) AS nom, matricule, role, signature_path FROM utilisateurs WHERE id::text = $1`, [String(userId)]);
  const u = rows[0];
  if (!u) return null;
  let signature = null;
  const p = u.signature_path;
  if (p && String(p).startsWith('/uploads/signatures/')) {
    try {
      const dossier = path.resolve(__dirname, '../../uploads/signatures');
      const fichier = path.resolve(__dirname, '../..', String(p).replace(/^\/+/, ''));
      if (!fichier.startsWith(dossier + path.sep)) throw new Error('chemin hors du dossier des signatures');
      const buf = fs.readFileSync(fichier);
      const ext = path.extname(p).toLowerCase();
      signature = `data:image/${ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`;
    } catch (e) { signature = null; }
  }
  return { nom: u.nom || null, matricule: u.matricule || null, role: u.role || null, fonction: FONCTIONS[u.role] || u.role || null, signature };
}

// Qui apparaît sur le ticket : l'opérateur de la session demandée (impression pendant son quart), sinon le dernier qui a repris le réglage, sinon son auteur.
// Le numéro de ticket ne change pas ; seuls le nom, la signature et le quart changent selon celui qui imprime.
async function signataireTicket(numero, sessionId) {
  await assurerReglages();
  if (sessionId) {
    const s = await db.query(`SELECT sp.operateur_id, sh.nom AS quart FROM sessions_production sp LEFT JOIN shifts sh ON sh.id::text = sp.shift_id::text WHERE sp.id::text = $1`, [String(sessionId)]);
    if (s.rows[0]) {
      const sg = await signataire(s.rows[0].operateur_id);
      if (sg) return { ...sg, quart: s.rows[0].quart || null };
    }
  }
  const p = await db.query(`SELECT operateur_id, shift_nom FROM reglages_reprises WHERE numero_ticket = $1 ORDER BY at DESC LIMIT 1`, [numero]);
  if (p.rows[0] && p.rows[0].operateur_id) {
    const sg = await signataire(p.rows[0].operateur_id);
    if (sg) return { ...sg, quart: p.rows[0].shift_nom || null };
  }
  const a = await db.query(`SELECT regleur_id FROM reglages_of WHERE numero_ticket = $1`, [numero]);
  return a.rows[0] ? signataire(a.rows[0].regleur_id) : null;
}

// GET /api/regleur/ticket/:numero/signataire — nom, fonction, quart et signature de l'opérateur (ticket affiché dans l'application)
router.get('/ticket/:numero/signataire', auth, async (req, res) => {
  try {
    const s = await signataireTicket(req.params.numero, req.query.session);
    res.json(s || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/regleur/historique
// Toutes les validations régleur (sessions + OFs directs), sans limite de date
router.get('/historique', auth, async (req, res) => {
  try {
    await assurerReglages();
    // Un réglage = une ligne : un OF peut en avoir plusieurs (arrêt puis nouveau réglage)
    const { rows } = await db.query(`
      SELECT r.id, r.valide_at, r.temperature, r.pression, r.vitesse, r.notes,
             r.numero_ticket AS numero_ticket_reglage, r.rang, r.motif, r.of_id,
             o.numero_of, o.quantite_cible, o.quantite_pieces, o.date_livraison_prevue,
             o.regleur_valide_at AS of_valide_at,
             a.designation AS article, a.couleur, a.largeur_mm,
             COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
             um.code AS unite_code, um.libelle AS unite_libelle,
             c.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom,
             CASE WHEN r.session_id IS NULL THEN 'of' ELSE 'session' END AS origine
      FROM reglages_of r
      JOIN ordres_fabrication o ON o.id::text = r.of_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN machines m ON m.id::text = COALESCE(r.machine_id, o.machine_id::text)
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur ON ur.id::text = r.regleur_id
      ORDER BY r.valide_at DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/regleur/of/:of_id/reglages — tous les réglages d'un OF (le dernier sert de base à un nouveau réglage)
router.get('/of/:of_id/reglages', auth, async (req, res) => {
  try {
    await assurerReglages();
    const { rows } = await db.query(`
      SELECT r.id, r.rang, r.numero_ticket AS numero_ticket_reglage, r.motif, r.valide_at, r.notes,
             trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom
      FROM reglages_of r LEFT JOIN utilisateurs ur ON ur.id::text = r.regleur_id
      WHERE r.of_id = $1 ORDER BY r.rang`, [String(req.params.of_id)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/regleur/ticket/:numero/view — Ticket réglage imprimable (accessible via QR code)
router.get('/ticket/:numero/view', async (req, res) => {
  try {
    await assurerReglages();
    const { rows } = await db.query(`
      SELECT o.numero_of, o.quantite_cible, o.quantite_pieces, o.date_livraison_prevue,
             r.valide_at AS valide_at, r.numero_ticket AS numero_ticket_reglage, r.regleur_id, r.rang, r.motif,
             r.temperature AS temperature, r.pression AS pression,
             r.vitesse AS vitesse, r.notes AS notes,
             a.designation AS article, a.couleur, a.largeur_mm,
             COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
             um.code AS unite_code, um.libelle AS unite_libelle,
             c.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom
      FROM reglages_of r
      JOIN ordres_fabrication o ON o.id::text = r.of_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN machines m ON m.id::text = COALESCE(r.machine_id, o.machine_id::text)
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur ON ur.id::text = r.regleur_id
      WHERE r.numero_ticket = $1
    `, [req.params.numero]);
    if (!rows.length) return res.status(404).send('<h1>Ticket introuvable</h1>');
    const r = rows[0];
    const sg = (await signataireTicket(r.numero_ticket_reglage, req.query.session)) || (await signataire(r.regleur_id));

    let params = {};
    try { params = JSON.parse(r.notes || '{}').params_complets || {}; } catch {}

    const fmt = (n, d = 0) => (n === null || n === undefined || n === '') ? '—' : parseFloat(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    const lignes = [
      { l: 'N° TICKET', v: r.numero_ticket_reglage || '—', bold: true },
      { l: 'RÉGLAGE N°', v: String(r.rang || 1) }, ...(r.rang > 1 ? [{ l: 'MOTIF', v: r.motif || '—' }] : []), null,
      { l: 'OF', v: r.numero_of }, { l: 'ARTICLE', v: r.article },
      { l: 'COULEUR', v: r.couleur || '—' }, { l: 'CLIENT', v: r.client_nom || '—' },
      { l: 'MACHINE', v: r.machine_nom || r.machine_code || '—' }, null,
      { l: 'QUANTITE', v: parseFloat(r.quantite_pieces) > 0 ? `${fmt(r.quantite_pieces)} pcs` : `${fmt(r.quantite_cible)} ${r.unite_libelle || r.unite_code || ''}`, bold: true },
      { l: 'POIDS CIBLE', v: r.poids_total_kg ? `${fmt(r.poids_total_kg, 1)} kg` : '—', bold: true },
      { l: 'LIVRAISON', v: fmtDate(r.date_livraison_prevue) }, null,
      { l: 'LARGEUR', v: params.largeur_mm ? `${params.largeur_mm} mm` : '—' },
      { l: 'SOUFFLET', v: params.soufflet_mm ? `${params.soufflet_mm} mm` : '—' },
      { l: 'EPAISSEUR', v: params.epaisseur_um ? `${params.epaisseur_um} µm` : '—' }, null,
      { l: 'T° ZONE 1', v: params.temp_zone1 ? `${params.temp_zone1} °C` : `${r.temperature || '—'} °C`, bold: true },
      { l: 'T° ZONE 2', v: params.temp_zone2 ? `${params.temp_zone2} °C` : '—' },
      { l: 'T° ZONE 3', v: params.temp_zone3 ? `${params.temp_zone3} °C` : '—' },
      { l: 'T° FILIERE', v: params.temp_filiere ? `${params.temp_filiere} °C` : '—' },
      { l: 'PRESSION', v: params.pression_bar ? `${params.pression_bar} bar` : `${r.pression || '—'} bar`, bold: true },
      { l: 'VIT. VIS', v: params.vitesse_vis ? `${params.vitesse_vis} tr/min` : '—' },
      { l: 'VIT. TIRAGE', v: params.vitesse_tirage ? `${params.vitesse_tirage} m/min` : '—' },
      { l: 'CORONA', v: params.corona || '—' }, null,
      { l: 'OPÉRATEUR', v: (sg && sg.nom) || r.regleur_nom || '—' }, ...(sg && sg.quart ? [{ l: 'QUART', v: sg.quart }] : []),
      { l: 'DATE', v: fmtDate(r.valide_at) }, { l: 'HEURE', v: r.valide_at ? new Date(r.valide_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—' },
    ];

    const QRCode = require('qrcode');
    const qrUrl = `${baseUrl(req)}/api/regleur/ticket/${encodeURIComponent(r.numero_ticket_reglage)}/view`;
    let qrImg = '';
    try { qrImg = await QRCode.toDataURL(qrUrl, { width: 130, margin: 1, color: { dark: '#312e81', light: '#fff' } }); } catch {}

    const rowsHtml = lignes.map(x => x === null ? '<hr/>' :
      `<div class="r${x.bold ? ' bold' : ''}"><span class="lbl">${x.l}</span><span class="val${x.bold ? ' big' : ''}">${esc(x.v)}</span></div>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(r.numero_ticket_reglage)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.s{border:none;border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}.val{font-weight:bold;text-align:right}
.big{font-size:14px}.qr{text-align:center;margin:5px 0}
.sig{border:1px solid #000;padding:4px;min-height:12mm}
@media print{@page{size:72mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — RÉGLAGE</div>
<div class="s"></div><div style="text-align:center;font-weight:800;font-size:12px">TICKET RÉGLAGE</div><hr/>
${rowsHtml}
<div class="qr">${qrImg ? `<img src="${qrImg}" width="120" height="120"/>` : ''}
<div style="font-size:8px;color:#666">${esc(r.numero_ticket_reglage)}</div></div><hr/>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:8px;font-weight:bold">OPÉRATEUR</div>${sg && sg.signature ? `<img src="${sg.signature}" style="max-height:14mm;max-width:100%;display:block;margin:1mm 0"/>` : '<br/><br/>'}<b>${esc((sg && sg.nom) || r.regleur_nom || '—')}</b><br/><span style="font-size:8px">${esc((sg && sg.fonction) || '')}${sg && sg.matricule ? ' · ' + esc(sg.matricule) : ''}</span>${sg && sg.signature ? '' : '<br/>Signature:'}</div>
<div class="sig"><div style="font-size:8px;font-weight:bold">CHEF DE QUART</div><br/><br/>Signature:</div>
</div>
<div style="font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm">NAIdo — NAI</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Erreur ticket reglage view:', err.message);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

// GET /api/regleur/ticket/:numero/record — un réglage (même contenu qu'une ligne de l'historique), pour imprimer son ticket depuis l'application
router.get('/ticket/:numero/record', auth, async (req, res) => {
  try {
    await assurerReglages();
    const { rows } = await db.query(`
      SELECT r.id, r.valide_at, r.temperature, r.pression, r.vitesse, r.notes,
             r.numero_ticket AS numero_ticket_reglage, r.rang, r.motif, r.of_id,
             o.numero_of, o.quantite_cible, o.quantite_pieces, o.date_livraison_prevue,
             a.designation AS article, a.couleur, a.largeur_mm,
             COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
             um.code AS unite_code, um.libelle AS unite_libelle,
             c.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom
      FROM reglages_of r
      JOIN ordres_fabrication o ON o.id::text = r.of_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN machines m ON m.id::text = COALESCE(r.machine_id, o.machine_id::text)
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur ON ur.id::text = r.regleur_id
      WHERE r.numero_ticket = $1`, [req.params.numero]);
    if (!rows.length) return res.status(404).json({ error: 'Ticket de réglage introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/regleur/of/:of_id/reprises — qui a repris le réglage de l'OF, à quel quart
router.get('/of/:of_id/reprises', auth, async (req, res) => {
  try {
    await assurerReglages();
    const { rows } = await db.query(`SELECT numero_ticket, rang, operateur_nom, shift_nom, mode, at FROM reglages_reprises WHERE of_id = $1 ORDER BY at`, [String(req.params.of_id)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/regleur/equipements — machines et équipements de la GMAO, pour signaler un problème depuis l'écran du poste
router.get('/equipements', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT id, code, designation FROM equipements WHERE actif = true ORDER BY code`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/regleur/signalement — ordre de travail GMAO ouvert depuis l'écran du poste (panne, anomalie, usure...)
router.post('/signalement', auth, async (req, res) => {
  try {
    const { equipement_id, type, urgence, description } = req.body || {};
    const TYPES = { panne: 'Panne', anomalie: 'Anomalie', usure: 'Usure', reglage: 'Problème de réglage', autre: 'Autre' };
    const PRIORITES = { critique: 'urgente', haute: 'haute', normale: 'normale', basse: 'basse' };
    if (!equipement_id || !TYPES[type] || !String(description || '').trim())
      return res.status(400).json({ error: 'Machine, type de problème et description obligatoires' });
    const eq = await db.query('SELECT id, code, designation FROM equipements WHERE id::text = $1 AND actif = true', [String(equipement_id)]);
    if (!eq.rows.length) return res.status(404).json({ error: 'Machine introuvable' });
    const e = eq.rows[0];
    const arret = urgence === 'critique';
    const priorite = PRIORITES[urgence] || 'normale';
    const typeOt = (type === 'panne' || arret) ? 'urgence' : 'curatif';
    const u = await db.query(`SELECT trim(COALESCE(prenom,'') || ' ' || COALESCE(nom,'')) AS nom FROM utilisateurs WHERE id::text = $1`, [String(req.user.id)]);
    const par = (u.rows[0] && u.rows[0].nom) || '';
    const { rows } = await db.query(`
      INSERT INTO ordres_travail (type_ot, equipement_id, titre, description, symptomes, priorite, duree_estimee_h, demandeur_id, arret_machine, statut, notes)
      VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,'ouvert',$9)
      RETURNING *`,
    [typeOt, e.id, `${TYPES[type]} — ${e.code}`, String(description).trim(), String(description).trim(), priorite, req.user.id, arret,
      `Signalé depuis l'écran de production${par ? ' par ' + par : ''}`]);
    // Arrêt total : la machine passe « en panne » dans la GMAO, comme pour un ordre de travail créé par la maintenance
    if (arret) await db.query(`UPDATE equipements SET statut = 'en_panne' WHERE id = $1`, [e.id]);
    res.status(201).json({ ok: true, id: rows[0].id, numero: rows[0].numero_ot || rows[0].numero || null });
  } catch (err) { console.error('[REGLEUR] signalement :', err.message); res.status(500).json({ error: 'Enregistrement impossible : ' + err.message }); }
});

module.exports = router;
