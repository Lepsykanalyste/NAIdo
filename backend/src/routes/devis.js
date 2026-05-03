const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/devis
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             u.nom||' '||u.prenom AS commercial_nom
      FROM devis d
      LEFT JOIN clients_complet c ON c.id=d.client_id
      LEFT JOIN articles a ON a.id=d.article_id
      LEFT JOIN utilisateurs u ON u.id=d.commercial_id
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/devis
router.post('/', auth, async (req, res) => {
  try {
    const { client_id, article_id, quantite, quantite_pieces, prix_unitaire_fcfa,
            date_validite, conditions_livraison, notes } = req.body;
    const montant = quantite && prix_unitaire_fcfa ? 
      parseFloat(quantite) * parseFloat(prix_unitaire_fcfa) : null;
    const { rows } = await db.query(`
      INSERT INTO devis (client_id, article_id, quantite, quantite_pieces, prix_unitaire_fcfa,
        montant_total_fcfa, date_validite, conditions_livraison, notes, commercial_id, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'brouillon') RETURNING *
    `, [client_id||null, article_id||null, quantite||null, quantite_pieces||null,
        prix_unitaire_fcfa||null, montant, date_validite||null,
        conditions_livraison||null, notes||null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/devis/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const { rows } = await db.query(
      'UPDATE devis SET statut=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/devis/:id/transformer-bc — Devis accepté → BC
router.post('/:id/transformer-bc', auth, async (req, res) => {
  try {
    const { reference_client, date_livraison_souhaitee, adresse_livraison, notes } = req.body;
    const { rows: dv } = await db.query('SELECT * FROM devis WHERE id=$1', [req.params.id]);
    if (!dv.length) return res.status(404).json({ error: 'Devis introuvable' });
    const d = dv[0];
    const { rows: bc } = await db.query(`
      INSERT INTO bons_commande (devis_id, client_id, article_id, quantite, quantite_pieces,
        prix_unitaire_fcfa, montant_total_fcfa, date_livraison_souhaitee,
        adresse_livraison, reference_client, notes, commercial_id, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'recu') RETURNING *
    `, [d.id, d.client_id, d.article_id, d.quantite, d.quantite_pieces,
        d.prix_unitaire_fcfa, d.montant_total_fcfa, date_livraison_souhaitee||null,
        adresse_livraison||null, reference_client||null, notes||null, req.user.id]);
    await db.query('UPDATE devis SET statut=$1 WHERE id=$2', ['transforme', d.id]);
    res.json(bc[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/devis/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, c.raison_sociale AS client_nom, c.telephone, c.email, c.adresse,
             a.designation AS article_nom, a.code AS article_code,
             a.longueur_mm, a.largeur_mm,
             u.nom||' '||u.prenom AS commercial_nom
      FROM devis d
      LEFT JOIN clients_complet c ON c.id=d.client_id
      LEFT JOIN articles a ON a.id=d.article_id
      LEFT JOIN utilisateurs u ON u.id=d.commercial_id
      WHERE d.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Devis introuvable' });
    const d = rows[0];
    const date_str = new Date(d.created_at).toLocaleDateString('fr-FR');
    const valid_str = d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—';
    const statut_colors = {brouillon:'#6b7280',envoye:'#0369a1',accepte:'#15803d',refuse:'#dc2626',expire:'#9ca3af',transforme:'#7c3aed'};
    const couleur = statut_colors[d.statut]||'#6b7280';
    const statut_label = {brouillon:'Brouillon',envoye:'Envoyé',accepte:'Accepté',refuse:'Refusé',expire:'Expiré',transforme:'Transformé en BC'}[d.statut]||d.statut;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4;margin:14mm;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#1f2937;}
  .header{border-bottom:3px solid #0369a1;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;}
  .company{font-size:18pt;font-weight:900;color:#0369a1;}
  .banner{background:#0369a1;color:#fff;text-align:center;padding:8px;border-radius:4px;margin-bottom:12px;font-size:12pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
  .num{font-size:18pt;font-weight:900;color:#0369a1;text-align:center;margin:6px 0;}
  .badge{display:inline-block;background:#e0f2fe;color:${couleur};border:1px solid ${couleur};border-radius:12px;padding:3px 14px;font-weight:700;font-size:10pt;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
  .sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;}
  .sec-h{background:#f3f4f6;padding:4px 10px;font-size:7.5pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;}
  .sec-b{padding:8px 10px;}
  .row{display:flex;justify-content:space-between;margin-bottom:3px;}
  .lbl{color:#6b7280;font-size:8pt;}
  .val{font-weight:700;font-size:8.5pt;}
  table{width:100%;border-collapse:collapse;margin:12px 0;}
  thead tr{background:#0369a1;color:#fff;}
  th{padding:8px 10px;text-align:left;font-size:8.5pt;}
  td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:8.5pt;}
  .total-row{background:#f0f9ff;font-weight:700;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}
  .sig-box{border:1px solid #d1d5db;border-radius:4px;padding:12px;min-height:70px;}
  .sig-title{font-size:7.5pt;font-weight:700;text-transform:uppercase;margin-bottom:4px;}
  .sig-line{border-top:1px solid #9ca3af;padding-top:4px;font-size:7pt;color:#9ca3af;text-align:center;margin-top:30px;}
  .footer{border-top:1px solid #e5e7eb;padding-top:6px;text-align:center;font-size:7pt;color:#9ca3af;margin-top:12px;}
  .validity{background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:8px;margin:10px 0;font-size:8.5pt;color:#92400e;}
</style></head><body>
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:8pt;color:#6b7280;">Industrie — Fabrication de sacs plastiques</div><div style="font-size:7.5pt;color:#6b7280;margin-top:4px;">Commercial : ${d.commercial_nom||'—'}</div></div>
  <div style="text-align:right;"><div style="font-size:8pt;color:#6b7280;">Date : ${date_str}</div><div style="font-size:8pt;color:#6b7280;margin-top:2px;">Réf. : ${d.numero_devis}</div></div>
</div>
<div class="banner">📋 Devis Commercial</div>
<div class="num">${d.numero_devis}</div>
<div style="text-align:center;margin-bottom:12px;"><span class="badge">${statut_label}</span></div>
<div class="grid">
  <div class="sec">
    <div class="sec-h">Client</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Raison sociale</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone?`<div class="row"><span class="lbl">Tél</span><span class="val">${d.telephone}</span></div>`:''}
      ${d.email?`<div class="row"><span class="lbl">Email</span><span class="val">${d.email}</span></div>`:''}
      ${d.adresse?`<div class="row"><span class="lbl">Adresse</span><span class="val">${d.adresse}</span></div>`:''}
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Validité & Conditions</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Valable jusqu'au</span><span class="val" style="color:#dc2626;">${valid_str}</span></div>
      ${d.conditions_livraison?`<div class="row"><span class="lbl">Livraison</span><span class="val">${d.conditions_livraison}</span></div>`:''}
    </div>
  </div>
</div>
<table>
  <thead><tr><th>Désignation</th><th>Référence</th><th>Qté (kg)</th><th>Qté (pcs)</th><th>P.U. (FCFA)</th><th>Total (FCFA)</th></tr></thead>
  <tbody>
    <tr>
      <td>${d.article_nom||'—'}</td>
      <td>${d.article_code||'—'}</td>
      <td>${d.quantite?parseFloat(d.quantite).toFixed(1)+' kg':'—'}</td>
      <td>${d.quantite_pieces?parseFloat(d.quantite_pieces).toLocaleString('fr-FR')+' pcs':'—'}</td>
      <td>${d.prix_unitaire_fcfa?parseFloat(d.prix_unitaire_fcfa).toLocaleString('fr-FR'):'—'}</td>
      <td style="font-weight:700;">${d.montant_total_fcfa?parseFloat(d.montant_total_fcfa).toLocaleString('fr-FR'):'—'}</td>
    </tr>
    <tr class="total-row">
      <td colspan="5" style="text-align:right;">TOTAL TTC</td>
      <td>${d.montant_total_fcfa?parseFloat(d.montant_total_fcfa).toLocaleString('fr-FR')+' FCFA':'—'}</td>
    </tr>
  </tbody>
</table>
<div class="validity">⚠ Ce devis est valable jusqu'au <strong>${valid_str}</strong>. Passé ce délai, les prix et conditions pourront être révisés.</div>
${d.notes?`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px;margin-bottom:10px;font-size:8.5pt;"><strong>Notes :</strong> ${d.notes}</div>`:''}
<div class="sigs">
  <div class="sig-box"><div class="sig-title">Commercial NAI</div><div style="font-size:8pt;color:#6b7280;">${d.commercial_nom||'—'}</div><div class="sig-line">Signature & Cachet NAI</div></div>
  <div class="sig-box"><div class="sig-title">Bon pour accord — Client</div><div style="font-size:8pt;color:#6b7280;">${d.client_nom||'—'}</div><div class="sig-line">Signature & Cachet Client</div></div>
</div>
<div class="footer">Devis ${d.numero_devis} · NAI — Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo SOPHOPSY</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
