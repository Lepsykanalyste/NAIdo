const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/ticket-prod/:id — HTML du ticket
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.*,
             o.numero_of, o.atelier_id, o.instructions,
             a.designation AS article_nom, a.code AS article_code,
             a.longueur_mm, a.largeur_mm,
             m.code AS machine_code, m.nom AS machine_nom,
             u.nom AS operateur_nom, u.prenom AS operateur_prenom,
             s.date_session, s.heure_debut, s.shift_id,
             c.raison_sociale AS client_nom_of
      FROM tickets_production t
      LEFT JOIN sessions_production s ON s.id = t.session_id
      LEFT JOIN ordres_fabrication o ON o.id = t.of_id
      LEFT JOIN articles a ON a.id = t.article_id
      LEFT JOIN machines m ON m.id = t.machine_id
      LEFT JOIN utilisateurs u ON u.id = t.operateur_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      WHERE t.id = $1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Ticket introuvable' });
    const t = rows[0];

    const client = t.client_nom || t.client_nom_of || 'NAI';
    const date_str = t.date_session 
      ? new Date(t.date_session).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    const heure_str = t.heure_debut 
      ? t.heure_debut.substring(0,5)
      : new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});

    const typeLabel = {
      extrusion: '🏭 EXTRUSION',
      soudure: '🔧 SOUDURE', 
      impression: '🖨 IMPRESSION',
      emballage: '📦 EMBALLAGE',
      of_recap: '📋 RÉCAP OF'
    }[t.type_ticket] || '🏭 PRODUCTION';

    const qr_data = [
      'OF:' + (t.numero_of||''),
      'TK:' + (t.numero_ticket||''),
      'ART:' + (t.article_code||''),
      'MACH:' + (t.machine_code||''),
      'POIDS:' + (t.poids_net_kg||0),
      'QTE:' + (t.qte_pieces||0),
      'DATE:' + date_str,
      'CLI:' + client
    ].join('|');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ticket ${t.numero_ticket}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: 80mm auto; margin: 3mm; }
  body {
    font-family: "DejaVu Sans", Arial, sans-serif;
    font-size: 8.5pt;
    color: #1f2937;
    width: 74mm;
    background: #fff;
  }
  .header { border-bottom: 2.5px solid #0369a1; padding-bottom: 5px; margin-bottom: 6px; text-align: center; }
  .company { font-size: 13pt; font-weight: 900; color: #0369a1; letter-spacing: 1px; }
  .sub { font-size: 7pt; color: #6b7280; }
  .banner {
    background: #0369a1; color: #fff; text-align: center;
    padding: 5px; border-radius: 3px; margin-bottom: 6px;
    font-size: 9pt; font-weight: 700; letter-spacing: 0.5px;
  }
  .of-num { font-size: 15pt; font-weight: 900; color: #0369a1; text-align: center; margin: 4px 0 2px; }
  .client-line { text-align: center; font-size: 8pt; font-weight: 700; color: #374151; margin-bottom: 6px; }
  .sec { border: 1px solid #e5e7eb; border-radius: 3px; margin-bottom: 5px; overflow: hidden; }
  .sec-h { background: #f3f4f6; padding: 2px 7px; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #374151; border-bottom: 1px solid #e5e7eb; letter-spacing: 0.3px; }
  .sec-b { padding: 5px 7px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .lbl { color: #6b7280; font-size: 7.5pt; }
  .val { font-weight: 700; color: #111827; font-size: 8pt; }
  .poids-net { font-size: 18pt; font-weight: 900; color: #15803d; text-align: center; margin: 3px 0 1px; }
  .poids-lbl { text-align: center; font-size: 7pt; color: #6b7280; margin-bottom: 3px; }
  .sep { border-top: 1px dashed #d1d5db; margin: 4px 0; }
  .qr-wrap { text-align: center; margin: 6px 0 4px; }
  .qr-data { font-size: 5.5pt; color: #9ca3af; word-break: break-all; margin-top: 2px; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 4px; text-align: center; font-size: 6.5pt; color: #9ca3af; margin-top: 4px; }
  .badge-rebut { background: #fee2e2; color: #dc2626; border-radius: 8px; padding: 1px 6px; font-weight: 700; font-size: 7.5pt; }
  .seq-num { position: absolute; top: 3mm; right: 3mm; font-size: 7pt; color: #9ca3af; }
  .ticket-num { text-align: center; font-size: 8pt; color: #6b7280; margin-bottom: 4px; }
  ${t.type_ticket === 'emballage' ? '.banner { background: #7c3aed; }' : ''}
  ${t.type_ticket === 'soudure' ? '.banner { background: #d97706; }' : ''}
  ${t.type_ticket === 'impression' ? '.banner { background: #0891b2; }' : ''}
</style>
</head>
<body>

<div class="header">
  <div class="company">NAI</div>
  <div class="sub">Atelier 3 — Système de Production</div>
</div>

<div class="banner">${typeLabel}</div>

<div class="ticket-num">N° ${t.numero_ticket}</div>
<div class="of-num">${t.numero_of || '—'}</div>
<div class="client-line">Client : ${client}</div>

<div class="sec">
  <div class="sec-h">Article</div>
  <div class="sec-b">
    <div class="row"><span class="lbl">Code</span><span class="val">${t.article_code || '—'}</span></div>
    <div class="row"><span class="lbl">Désignation</span><span class="val" style="font-size:7.5pt;max-width:40mm;text-align:right;">${t.article_nom || '—'}</span></div>
    ${t.longueur_mm ? `<div class="row"><span class="lbl">Dimensions</span><span class="val">${t.longueur_mm}×${t.largeur_mm||'?'} mm</span></div>` : ''}
    ${t.instructions ? `<div class="row"><span class="lbl">Instructions</span><span class="val" style="font-size:7pt;">${t.instructions}</span></div>` : ''}
  </div>
</div>

<div class="sec">
  <div class="sec-h">Opération</div>
  <div class="sec-b">
    <div class="row"><span class="lbl">Machine</span><span class="val">${t.machine_code || '—'}</span></div>
    <div class="row"><span class="lbl">Opérateur</span><span class="val">${t.operateur_prenom || ''} ${t.operateur_nom || '—'}</span></div>
    <div class="row"><span class="lbl">Date</span><span class="val">${date_str} ${heure_str}</span></div>
    ${t.numero_sequence ? `<div class="row"><span class="lbl">Séquence</span><span class="val">#${t.numero_sequence}</span></div>` : ''}
  </div>
</div>

<div class="sec">
  <div class="sec-h">Pesée & Quantités</div>
  <div class="sec-b">
    ${t.type_ticket !== 'emballage' ? `
    <div class="row"><span class="lbl">Poids brut</span><span class="val">${parseFloat(t.poids_brut_kg||0).toFixed(3)} kg</span></div>
    <div class="row"><span class="lbl">Tare/Mandrin</span><span class="val">${parseFloat(t.poids_mandrin_kg||0).toFixed(3)} kg</span></div>
    <div class="sep"></div>
    <div class="poids-net">${parseFloat(t.poids_net_kg||0).toFixed(3)} kg</div>
    <div class="poids-lbl">POIDS NET</div>
    ` : `
    <div class="row"><span class="lbl">N° Colis</span><span class="val">${t.numero_colis || '—'}</span></div>
    <div class="row"><span class="lbl">Qté pièces</span><span class="val">${t.qte_pieces || 0} pcs</span></div>
    <div class="row"><span class="lbl">Poids carton</span><span class="val">${parseFloat(t.poids_carton_kg||0).toFixed(3)} kg</span></div>
    <div class="poids-net">${parseFloat(t.poids_net_kg||0).toFixed(3)} kg</div>
    <div class="poids-lbl">POIDS NET CONTENU</div>
    `}
    ${parseFloat(t.poids_dechets_kg||0)+parseFloat(t.poids_rebuts_kg||0) > 0 ? `
    <div class="sep"></div>
    <div class="row"><span class="lbl">Déchets/Rebuts</span><span class="badge-rebut">${(parseFloat(t.poids_dechets_kg||0)+parseFloat(t.poids_rebuts_kg||0)).toFixed(3)} kg</span></div>
    ` : ''}
  </div>
</div>

${t.etape_dest ? `
<div class="sec">
  <div class="sec-h">Destination</div>
  <div class="sec-b">
    <div class="row"><span class="lbl">Envoyé vers</span><span class="val">${t.etape_dest}</span></div>
  </div>
</div>
` : ''}

<div class="qr-wrap">
  <canvas id="qr"></canvas>
  <div class="qr-data">${qr_data}</div>
</div>

<div class="footer">
  Imprimé le ${new Date().toLocaleString('fr-FR')}<br>
  <strong>NAIdo — SOPHOPSY pour NAI</strong>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  new QRCode(document.getElementById('qr'), {
    text: "${qr_data}",
    width: 100, height: 100,
    colorDark: '#0369a1', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
  window.onload = () => setTimeout(() => window.print(), 800);
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ticket-prod/of/:of_id — tous les tickets d'un OF
router.get('/of/:of_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.id, t.numero_ticket, t.type_ticket, t.created_at,
             t.poids_net_kg, t.qte_pieces, t.numero_colis,
             t.machine_id, m.code AS machine_code,
             t.operateur_id, u.nom AS operateur_nom
      FROM tickets_production t
      LEFT JOIN machines m ON m.id = t.machine_id
      LEFT JOIN utilisateurs u ON u.id = t.operateur_id
      WHERE t.of_id = $1 ORDER BY t.created_at DESC
    `, [req.params.of_id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
