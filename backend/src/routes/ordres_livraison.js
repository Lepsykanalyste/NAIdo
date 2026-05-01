const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/ol
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ol.*,
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             df.numero_df, o.numero_of,
             u.nom||' '||u.prenom AS demandeur_nom
      FROM ordres_livraison ol
      LEFT JOIN clients_complet c ON c.id=ol.client_id
      LEFT JOIN articles a ON a.id=ol.article_id
      LEFT JOIN demandes_fabrication df ON df.id=ol.df_id
      LEFT JOIN ordres_fabrication o ON o.id=ol.of_id
      LEFT JOIN utilisateurs u ON u.id=ol.demandeur_id
      ORDER BY ol.created_at DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ol
router.post('/', auth, async (req, res) => {
  try {
    const { df_id, of_id, client_id, article_id, quantite_livrer,
            date_livraison_prevue, adresse_livraison, notes } = req.body;
    if (!quantite_livrer) return res.status(400).json({ error: 'quantite_livrer requis' });
    const { rows } = await db.query(`
      INSERT INTO ordres_livraison
        (df_id, of_id, client_id, article_id, quantite_livrer,
         date_livraison_prevue, adresse_livraison, notes, demandeur_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [df_id||null, of_id||null, client_id||null, article_id||null,
        parseFloat(quantite_livrer), date_livraison_prevue||null,
        adresse_livraison||null, notes||null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/ol/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut, quantite_livree, date_livraison_reelle } = req.body;
    const { rows } = await db.query(`
      UPDATE ordres_livraison SET
        statut=$1,
        quantite_livree=COALESCE($2, quantite_livree),
        date_livraison_reelle=COALESCE($3, date_livraison_reelle),
        magasinier_id=COALESCE($4, magasinier_id),
        updated_at=NOW()
      WHERE id=$5 RETURNING *
    `, [statut, quantite_livree||null, date_livraison_reelle||null, req.user.id, req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ol/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ol.*, c.raison_sociale AS client_nom, c.telephone, c.adresse,
             a.designation AS article_nom, a.code AS article_code,
             a.longueur_mm, a.largeur_mm,
             df.numero_df, o.numero_of,
             u.nom||' '||u.prenom AS demandeur_nom
      FROM ordres_livraison ol
      LEFT JOIN clients_complet c ON c.id=ol.client_id
      LEFT JOIN articles a ON a.id=ol.article_id
      LEFT JOIN demandes_fabrication df ON df.id=ol.df_id
      LEFT JOIN ordres_fabrication o ON o.id=ol.of_id
      LEFT JOIN utilisateurs u ON u.id=ol.demandeur_id
      WHERE ol.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OL introuvable' });
    const d = rows[0];
    const date_str = new Date(d.created_at).toLocaleDateString('fr-FR');
    const livr_str = d.date_livraison_prevue ? new Date(d.date_livraison_prevue).toLocaleDateString('fr-FR') : '—';
    const statut_label = {en_attente:'En attente',confirme:'Confirmé',en_preparation:'En préparation',expedie:'Expédié',livre:'Livré',annule:'Annulé'}[d.statut]||d.statut;
    const qr_data = `NAI OL\nN: ${d.numero_ol}\nARTICLE: ${d.article_code} ${d.article_nom}\nQTE: ${d.quantite_livrer} kg\nCLIENT: ${d.client_nom||'—'}\nDF: ${d.numero_df||'—'}\nOF: ${d.numero_of||'—'}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  @page { size:A5; margin:10mm; }
  body { font-family:Arial,sans-serif; font-size:9pt; color:#1f2937; }
  .header { border-bottom:3px solid #15803d; padding-bottom:8px; margin-bottom:10px; display:flex; justify-content:space-between; }
  .company { font-size:14pt; font-weight:900; color:#15803d; }
  .banner { background:#15803d; color:#fff; text-align:center; padding:6px; border-radius:4px; margin-bottom:10px; font-size:10pt; font-weight:700; text-transform:uppercase; }
  .ol-num { font-size:16pt; font-weight:900; color:#15803d; text-align:center; margin:6px 0 3px; }
  .badge { display:inline-block; background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:12px; padding:3px 12px; font-weight:700; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
  .sec { border:1px solid #e5e7eb; border-radius:4px; overflow:hidden; }
  .sec-h { background:#f3f4f6; padding:3px 8px; font-size:7pt; font-weight:700; text-transform:uppercase; border-bottom:1px solid #e5e7eb; }
  .sec-b { padding:6px 8px; }
  .row { display:flex; justify-content:space-between; margin-bottom:2px; }
  .lbl { color:#6b7280; font-size:7.5pt; }
  .val { font-weight:700; font-size:8pt; }
  .qte-big { font-size:20pt; font-weight:900; color:#15803d; text-align:center; margin:4px 0; }
  .sigs { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .sig-box { border:1px solid #d1d5db; border-radius:4px; padding:10px; min-height:60px; }
  .sig-title { font-size:7pt; font-weight:700; text-transform:uppercase; margin-bottom:3px; }
  .sig-line { border-top:1px solid #9ca3af; padding-top:3px; font-size:6.5pt; color:#9ca3af; text-align:center; margin-top:25px; }
  .footer { border-top:1px solid #e5e7eb; padding-top:5px; text-align:center; font-size:6.5pt; color:#9ca3af; margin-top:6px; }
</style></head><body>
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280;">Magasin Central — Livraison</div></div>
  <div style="text-align:right;">
    <div style="font-size:7pt;color:#6b7280;">Date : ${date_str}</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(qr_data)}&color=15803d" width="70" height="70"/>
  </div>
</div>
<div class="banner">📦 Ordre de Livraison</div>
<div class="ol-num">${d.numero_ol}</div>
<div style="text-align:center;margin-bottom:8px;"><span class="badge">${statut_label}</span></div>
${d.numero_df ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:5px 8px;text-align:center;margin-bottom:8px;font-size:8pt;">DF : <strong>${d.numero_df}</strong> → OF : <strong>${d.numero_of||'—'}</strong></div>` : ''}
<div class="grid">
  <div class="sec">
    <div class="sec-h">Article</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Code</span><span class="val">${d.article_code||'—'}</span></div>
      <div class="row"><span class="lbl">Désignation</span><span class="val" style="font-size:7.5pt;">${d.article_nom||'—'}</span></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Client</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Nom</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone ? `<div class="row"><span class="lbl">Tél</span><span class="val">${d.telephone}</span></div>` : ''}
      <div class="row"><span class="lbl">Livraison</span><span class="val">${livr_str}</span></div>
    </div>
  </div>
</div>
<div class="qte-big">${parseFloat(d.quantite_livrer).toFixed(0)} kg</div>
<div style="text-align:center;font-size:7pt;color:#6b7280;margin-bottom:8px;">QUANTITÉ À LIVRER</div>
${d.adresse_livraison ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px;margin-bottom:8px;font-size:8pt;"><strong>Adresse :</strong> ${d.adresse_livraison}</div>` : ''}
${d.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:8px;margin-bottom:8px;font-size:8pt;"><strong>Notes :</strong> ${d.notes}</div>` : ''}
<div class="sigs">
  <div class="sig-box"><div class="sig-title">Commercial / Demandeur</div><div style="font-size:7.5pt;color:#6b7280;">${d.demandeur_nom||'—'}</div><div class="sig-line">Signature</div></div>
  <div class="sig-box"><div class="sig-title">Magasinier / Livreur</div><div style="font-size:7.5pt;color:#6b7280;">À compléter</div><div class="sig-line">Signature</div></div>
</div>
<div class="footer">Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo — SOPHOPSY pour NAI</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
