const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

// Protege les textes inseres dans les pages HTML publiques (QR code)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseUrl = (req) => process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
const fs = require('fs');
const path = require('path');

// Signataire d'un ticket : nom, fonction, matricule et signature (image du profil, comme sur les autres documents)
const FONCTIONS = { regleur: 'Régleur', technicien_regleur: 'Technicien régleur', chef_atelier: "Chef d'atelier", operateur: 'Opérateur' };
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

// GET /api/regleur/ticket/:numero/signataire — nom, fonction et signature du régleur (ticket affiché dans l'application)
router.get('/ticket/:numero/signataire', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT regleur_id FROM ordres_fabrication WHERE numero_ticket_reglage = $1', [req.params.numero]);
    const s = r.rows[0] ? await signataire(r.rows[0].regleur_id) : null;
    res.json(s || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/regleur/historique
// Toutes les validations régleur (sessions + OFs directs), sans limite de date
router.get('/historique', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        sp.id,
        sp.regleur_validation_at AS valide_at,
        sp.regleur_temperature   AS temperature,
        sp.regleur_pression      AS pression,
        sp.regleur_vitesse       AS vitesse,
        sp.regleur_notes         AS notes,
        o.numero_of,
        o.quantite_cible,
        o.quantite_pieces,
        o.date_livraison_prevue,
        o.regleur_valide_at      AS of_valide_at,
        o.numero_ticket_reglage,
        a.designation            AS article,
        a.couleur,
        a.largeur_mm,
        COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
        um.code                  AS unite_code,
        um.libelle               AS unite_libelle,
        c.raison_sociale         AS client_nom,
        m.code                   AS machine_code,
        m.nom                    AS machine_nom,
        trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom,
        'session' AS origine
      FROM sessions_production sp
      JOIN ordres_fabrication o  ON o.id  = sp.of_id
      JOIN articles a            ON a.id  = o.article_id
      LEFT JOIN clients_complet c  ON c.id  = o.client_id
      LEFT JOIN machines m         ON m.id  = sp.machine_id
      LEFT JOIN unites_mesure um   ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur    ON ur.id = sp.regleur_id
      WHERE sp.regleur_valide = true

      UNION ALL

      SELECT
        o.id,
        o.regleur_valide_at      AS valide_at,
        o.regleur_temperature    AS temperature,
        o.regleur_pression       AS pression,
        o.regleur_vitesse        AS vitesse,
        o.regleur_notes          AS notes,
        o.numero_of,
        o.quantite_cible,
        o.quantite_pieces,
        o.date_livraison_prevue,
        o.regleur_valide_at      AS of_valide_at,
        o.numero_ticket_reglage,
        a.designation            AS article,
        a.couleur,
        a.largeur_mm,
        COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
        um.code                  AS unite_code,
        um.libelle               AS unite_libelle,
        c.raison_sociale         AS client_nom,
        m.code                   AS machine_code,
        m.nom                    AS machine_nom,
        trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom,
        'of' AS origine
      FROM ordres_fabrication o
      JOIN articles a            ON a.id  = o.article_id
      LEFT JOIN clients_complet c  ON c.id  = o.client_id
      LEFT JOIN machines m         ON m.id  = o.machine_id
      LEFT JOIN unites_mesure um   ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur    ON ur.id = o.regleur_id
      WHERE o.regleur_valide = true
        AND NOT EXISTS (
          SELECT 1 FROM sessions_production sp
          WHERE sp.of_id = o.id AND sp.regleur_valide = true
        )

      ORDER BY valide_at DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/regleur/ticket/:numero/view — Ticket réglage imprimable (accessible via QR code)
router.get('/ticket/:numero/view', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.numero_of, o.quantite_cible, o.quantite_pieces, o.date_livraison_prevue,
             o.regleur_valide_at AS valide_at, o.numero_ticket_reglage, o.regleur_id,
             o.regleur_temperature AS temperature, o.regleur_pression AS pression,
             o.regleur_vitesse AS vitesse, o.regleur_notes AS notes,
             a.designation AS article, a.couleur, a.largeur_mm,
             COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
             um.code AS unite_code, um.libelle AS unite_libelle,
             c.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             trim(COALESCE(ur.prenom,'') || ' ' || COALESCE(ur.nom,'')) AS regleur_nom
      FROM ordres_fabrication o
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN machines m ON m.id = o.machine_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur ON ur.id = o.regleur_id
      WHERE o.numero_ticket_reglage = $1
    `, [req.params.numero]);
    if (!rows.length) return res.status(404).send('<h1>Ticket introuvable</h1>');
    const r = rows[0];
    const sg = await signataire(r.regleur_id);

    let params = {};
    try { params = JSON.parse(r.notes || '{}').params_complets || {}; } catch {}

    const fmt = (n, d = 0) => (n === null || n === undefined || n === '') ? '—' : parseFloat(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    const lignes = [
      { l: 'N° TICKET', v: r.numero_ticket_reglage || '—', bold: true }, null,
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
      { l: 'RÉGLEUR', v: (sg && sg.nom) || r.regleur_nom || '—' },
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
<div class="sig"><div style="font-size:8px;font-weight:bold">RÉGLEUR</div>${sg && sg.signature ? `<img src="${sg.signature}" style="max-height:14mm;max-width:100%;display:block;margin:1mm 0"/>` : '<br/><br/>'}<b>${esc((sg && sg.nom) || r.regleur_nom || '—')}</b><br/><span style="font-size:8px">${esc((sg && sg.fonction) || '')}${sg && sg.matricule ? ' · ' + esc(sg.matricule) : ''}</span>${sg && sg.signature ? '' : '<br/>Signature:'}</div>
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

module.exports = router;
