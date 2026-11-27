const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// Protege les textes inseres dans les pages HTML publiques (QR code)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseUrl = (req) => process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
const { assurerReglages } = require('../utils/reglagesOf');
// Chaque bobine garde le numéro du ticket de réglage en vigueur quand elle a été faite (un OF peut avoir plusieurs réglages)
const colonneReglage = db.query('ALTER TABLE tickets_production ADD COLUMN IF NOT EXISTS numero_ticket_reglage text').catch(e => console.error('[TICKETS] colonne reglage :', e.message));
assurerReglages().catch(e => console.error('[TICKETS] historique des reglages :', e.message));

// POST /api/tickets
router.post('/', auth, async (req, res) => {
  try {
    const {
      session_id, of_id, machine_id, article_id,
      poids_brut_kg, poids_mandrin_kg, poids_dechets_kg, motif_dechet,
      poids_rebuts_kg, motif_rebut, type_ticket, etape_source, etape_dest,
      lot_id, nom_matiere, qte_pieces, numero_colis, poids_carton_kg,
      client_nom, numero_sequence, ticket_parent_id, zone_actuelle
    } = req.body;

    if (!session_id || !of_id) return res.status(400).json({ error: 'Session et OF obligatoires' });
    if (!machine_id) return res.status(400).json({ error: "Machine non definie pour ce ticket : selectionnez la machine avant de valider" });
    const poids_net = parseFloat(poids_brut_kg||0) - parseFloat(poids_mandrin_kg||0);
    if (!(poids_net >= 0)) return res.status(400).json({ error: 'Poids invalide : le mandrin ne peut pas depasser le poids brut' });
    const qr = 'NAI|' + (of_id||'') + '|' + (machine_id||'') + '|' + poids_net.toFixed(3) + 'kg';


    const { rows } = await db.query(`
      INSERT INTO tickets_production
        (session_id, of_id, machine_id, operateur_id, article_id,
         poids_brut_kg, poids_mandrin_kg, poids_net_kg,
         poids_dechets_kg, motif_dechet, poids_rebuts_kg, motif_rebut,
         type_ticket, etape_source, etape_dest,
         lot_matiere_id, numero_sequence, qte_pieces,
         numero_colis, poids_carton_kg, qr_code_contenu,
         ticket_parent_id, zone_actuelle)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *
    `, [
      session_id, of_id, machine_id||null, req.user.id, article_id||null,
      poids_brut_kg||0, poids_mandrin_kg||0, poids_net,
      poids_dechets_kg||0, motif_dechet||null, poids_rebuts_kg||0, motif_rebut||null,
      type_ticket||'extrusion', etape_source||null, etape_dest||null,
      lot_id||null, numero_sequence||1, qte_pieces||0,
      numero_colis||null, poids_carton_kg||0, qr,
      ticket_parent_id||null, zone_actuelle||'AT3-EXT'
    ]);

    await db.query(
      'UPDATE ordres_fabrication SET quantite_produite = quantite_produite + $1 WHERE id = $2',
      [poids_net, of_id]
    );

    try {
      await colonneReglage;
      await db.query('UPDATE tickets_production SET numero_ticket_reglage = (SELECT numero_ticket_reglage FROM ordres_fabrication WHERE id = $2) WHERE id = $1', [rows[0].id, of_id]);
    } catch (e) { console.error('[TICKETS] reglage de la bobine :', e.message); }

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/session/:session_id
router.get('/session/:session_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT tp.*, m.code AS machine_code, o.numero_of
      FROM tickets_production tp
      LEFT JOIN machines m ON m.id = tp.machine_id
      JOIN ordres_fabrication o ON o.id = tp.of_id
      WHERE tp.session_id = $1
      ORDER BY tp.created_at DESC
    `, [req.params.session_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/tickets/:id/imprime
router.put('/:id/imprime', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE tickets_production SET imprime=true, imprime_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/tickets?operateur_id=&limit=
router.get('/', auth, async (req, res) => {
  try {
    const { operateur_id, limit = 20 } = req.query;
    const id = operateur_id || req.user.id;
    const { rows } = await db.query(
      `SELECT tp.id, tp.numero_ticket, tp.poids_net_kg, tp.poids_dechets_kg,
              tp.type_ticket, tp.created_at, tp.etape_dest,
              o.numero_of, m.code AS machine_code
       FROM tickets_production tp
       LEFT JOIN ordres_fabrication o ON o.id = tp.of_id
      LEFT JOIN articles art ON art.id = o.article_id
       LEFT JOIN machines m ON m.id = tp.machine_id
       WHERE tp.operateur_id = $1
       ORDER BY tp.created_at DESC LIMIT $2`,
      [id, parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// GET /api/tickets/:id/view — Ticket imprimable complet (accessible via QR code)
router.get('/:id/view', async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(404).send('<h1>Ticket introuvable</h1>');
    const { rows } = await db.query(`
      SELECT tp.*, o.numero_of, o.regleur_notes,
             art.designation AS article_nom, art.largeur_mm, art.epaisseur_mm,
             cl.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             u.prenom AS operateur_prenom, u.nom AS operateur_nom,
             sh.nom AS shift_nom
      FROM tickets_production tp
      LEFT JOIN ordres_fabrication o ON o.id = tp.of_id
      LEFT JOIN articles art ON art.id = o.article_id
      LEFT JOIN clients_complet cl ON cl.id = o.client_id
      LEFT JOIN machines m ON m.id = tp.machine_id
      LEFT JOIN utilisateurs u ON u.id = tp.operateur_id
      LEFT JOIN sessions_production sp ON sp.id = tp.session_id
      LEFT JOIN shifts sh ON sh.id = sp.shift_id
      WHERE tp.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).send('<h1>Ticket introuvable</h1>');
    const t = rows[0];

    let reglageP = {};
    try { reglageP = JSON.parse(t.regleur_notes || '{}').params_complets || {}; } catch {}
    // Valeurs du réglage en vigueur quand la bobine a été faite (si l'OF a eu plusieurs réglages)
    let rangReglage = null;
    if (t.numero_ticket_reglage) {
      try {
        const rg = await db.query('SELECT rang, notes FROM reglages_of WHERE numero_ticket = $1', [t.numero_ticket_reglage]);
        if (rg.rows[0]) {
          rangReglage = rg.rows[0].rang;
          const p = JSON.parse(rg.rows[0].notes || '{}').params_complets;
          if (p) reglageP = p;
        }
      } catch {}
    }

    const QRCode = require('qrcode');
    const qrUrl = `${baseUrl(req)}/api/tickets/${t.id}/view`;
    let qrImg = '';
    try { qrImg = await QRCode.toDataURL(qrUrl, { width: 130, margin: 1, color: { dark: '#1c1917', light: '#fff' } }); } catch {}

    const fmt = (n, d = 3) => (n === null || n === undefined) ? '—' : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const fmtDate = (d) => new Date(d || Date.now()).toLocaleDateString('fr-FR');
    const fmtTime = (d) => new Date(d || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const rows_ = [
      { l: 'N° BOBINE', v: t.numero_ticket || '—', bold: true }, null,
      { l: 'OF', v: t.numero_of || '—' }, { l: 'ARTICLE', v: t.article_nom || '—' },
      { l: 'CLIENT', v: t.client_nom || '—' }, { l: 'MACHINE', v: t.machine_code || t.machine_nom || '—' }, { l: 'SHIFT', v: t.shift_nom || '—' },
      ...(t.numero_ticket_reglage ? [{ l: 'RÉGLAGE', v: `${t.numero_ticket_reglage}${rangReglage ? ' (n°' + rangReglage + ')' : ''}` }] : []), null,
      { l: 'LARGEUR', v: (reglageP.largeur_mm || t.largeur_mm) ? `${reglageP.largeur_mm || t.largeur_mm} mm` : '—' },
      { l: 'SOUFFLET', v: reglageP.soufflet_mm ? `${reglageP.soufflet_mm} mm` : '—' },
      { l: 'ÉPAISSEUR', v: (reglageP.epaisseur_um || t.epaisseur_mm) ? `${reglageP.epaisseur_um || t.epaisseur_mm} µm` : '—' }, null,
      { l: 'POIDS BRUT', v: `${fmt(t.poids_brut_kg)} kg` },
      { l: 'TARE / MAND.', v: `${fmt(t.poids_mandrin_kg)} kg` },
      { l: 'POIDS NET ★', v: `${fmt(t.poids_net_kg)} kg`, bold: true, big: true },
      ...(parseFloat(t.poids_dechets_kg) > 0 ? [{ l: 'DÉCHETS', v: `${fmt(t.poids_dechets_kg)} kg` }] : []),
      ...(parseFloat(t.poids_rebuts_kg) > 0 ? [{ l: 'REBUTS', v: `${fmt(t.poids_rebuts_kg)} kg` }] : []),
      ...(t.etape_dest ? [null, { l: 'DESTINATION', v: t.etape_dest, bold: true }] : []), null,
      { l: 'OPÉRATEUR', v: `${t.operateur_prenom || ''} ${t.operateur_nom || ''}`.trim() || '—' },
      { l: 'DATE', v: fmtDate(t.created_at) }, { l: 'HEURE', v: fmtTime(t.created_at) },
    ].filter(x => x !== undefined);

    const rowsHtml = rows_.map(r => r === null ? '<hr/>' :
      `<div class="r${r.bold ? ' bold' : ''}"><span class="lbl">${r.l}</span><span class="val${r.big ? ' big' : ''}">${esc(r.v)}</span></div>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(t.numero_ticket)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.s{border:none;border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}.val{font-weight:bold;text-align:right}
.bold .val{font-weight:900}.big{font-size:15px}.qr{text-align:center;margin:5px 0}
.sig{border:1px solid #000;padding:4px;min-height:14mm}
.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:72mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — EXTRUSION</div>
<div class="s"></div><div style="text-align:center;font-weight:800;font-size:12px">TICKET BOBINE</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-005</div><hr/>
${rowsHtml}
<div class="qr">${qrImg ? `<img src="${qrImg}" width="120" height="120"/>` : ''}
<div style="font-size:8px;color:#666">${esc(t.numero_ticket)}</div></div><hr/>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:8px;font-weight:bold">OPÉRATEUR</div>${esc(t.operateur_prenom)} ${esc(t.operateur_nom)}<br/><br/>Signature:</div>
<div class="sig"><div style="font-size:8px;font-weight:bold">CHEF DE QUART</div><br/><br/>Signature:</div>
</div><div class="foot">NAIdo — NAI · ${fmtDate(t.created_at)}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  } catch (err) {
    console.error('Erreur ticket view:', err.message);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});


// GET /api/tickets/disponibles?of_id=X&zone=Y — Bobines disponibles pour selection (ticket parent)
router.get('/disponibles', auth, async (req, res) => {
  try {
    const { of_id, zone } = req.query;
    if (!of_id || !zone) return res.status(400).json({ error: "of_id et zone requis" });
    const { rows } = await db.query(`
      SELECT t.id, t.numero_ticket, t.poids_net_kg, t.qte_pieces, t.created_at,
             (t.poids_net_kg - COALESCE((
               SELECT SUM(c.poids_carton_kg) FROM tickets_production c WHERE c.ticket_parent_id = t.id
             ),0)) AS poids_restant_kg
      FROM tickets_production t
      WHERE t.of_id = $1 AND t.zone_actuelle = $2
        AND (t.poids_net_kg - COALESCE((
               SELECT SUM(c.poids_carton_kg) FROM tickets_production c WHERE c.ticket_parent_id = t.id
             ),0)) > 0.001
      ORDER BY t.created_at ASC
    `, [of_id, zone]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/of/:of_id/resume — bobines d'extrusion de l'OF tous quarts confondus (cumul affiché à l'opérateur)
router.get('/of/:of_id/resume', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS nb_bobines, COALESCE(SUM(poids_net_kg), 0) AS poids_net_total
       FROM tickets_production WHERE of_id::text = $1 AND COALESCE(type_ticket, 'extrusion') = 'extrusion'`, [String(req.params.of_id)]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
