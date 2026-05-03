const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/bc
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT bc.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             dv.numero_devis,
             df.numero_df,
             u.nom||' '||u.prenom AS commercial_nom
      FROM bons_commande bc
      LEFT JOIN clients_complet c ON c.id=bc.client_id
      LEFT JOIN articles a ON a.id=bc.article_id
      LEFT JOIN devis dv ON dv.id=bc.devis_id
      LEFT JOIN demandes_fabrication df ON df.id=bc.df_id
      LEFT JOIN utilisateurs u ON u.id=bc.commercial_id
      ORDER BY bc.created_at DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bc — Créer BC manuellement (sans devis)
router.post('/', auth, async (req, res) => {
  try {
    const { client_id, article_id, quantite, quantite_pieces, prix_unitaire_fcfa,
            date_livraison_souhaitee, adresse_livraison, reference_client, notes } = req.body;
    const montant = quantite && prix_unitaire_fcfa ?
      parseFloat(quantite) * parseFloat(prix_unitaire_fcfa) : null;
    const { rows } = await db.query(`
      INSERT INTO bons_commande (client_id, article_id, quantite, quantite_pieces,
        prix_unitaire_fcfa, montant_total_fcfa, date_livraison_souhaitee,
        adresse_livraison, reference_client, notes, commercial_id, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'recu') RETURNING *
    `, [client_id||null, article_id||null, quantite||null, quantite_pieces||null,
        prix_unitaire_fcfa||null, montant, date_livraison_souhaitee||null,
        adresse_livraison||null, reference_client||null, notes||null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bc/:id/transformer-df — BC → DF
router.post('/:id/transformer-df', auth, async (req, res) => {
  try {
    const { rows: bc_rows } = await db.query('SELECT * FROM bons_commande WHERE id=$1', [req.params.id]);
    if (!bc_rows.length) return res.status(404).json({ error: 'BC introuvable' });
    const bc = bc_rows[0];
    if (bc.df_id) return res.status(400).json({ error: 'BC déjà transformé en DF' });

    const { rows: df } = await db.query(`
      INSERT INTO demandes_fabrication
        (client_id, article_id, quantite_demandee, bc_id,
         date_livraison_souhaitee, description, demandeur_id, statut, priorite)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'en_attente',3) RETURNING *
    `, [bc.client_id, bc.article_id, bc.quantite,
        bc.id, bc.date_livraison_souhaitee,
        'BC N°' + bc.numero_bc + (bc.reference_client?' — Réf. client: '+bc.reference_client:''),
        req.user.id]);

    await db.query(
      'UPDATE bons_commande SET df_id=$1, statut=$2, updated_at=NOW() WHERE id=$3',
      [df[0].id, 'transforme_df', bc.id]
    );
    res.json({ bc: bc, df: df[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/bc/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT bc.*, c.raison_sociale AS client_nom, c.telephone, c.email, c.adresse,
             a.designation AS article_nom, a.code AS article_code,
             dv.numero_devis, df.numero_df,
             u.nom||' '||u.prenom AS commercial_nom
      FROM bons_commande bc
      LEFT JOIN clients_complet c ON c.id=bc.client_id
      LEFT JOIN articles a ON a.id=bc.article_id
      LEFT JOIN devis dv ON dv.id=bc.devis_id
      LEFT JOIN demandes_fabrication df ON df.id=bc.df_id
      LEFT JOIN utilisateurs u ON u.id=bc.commercial_id
      WHERE bc.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'BC introuvable' });
    const d = rows[0];
    const date_str = new Date(d.created_at).toLocaleDateString('fr-FR');
    const livr_str = d.date_livraison_souhaitee ? new Date(d.date_livraison_souhaitee).toLocaleDateString('fr-FR') : '—';
    const statut_label = {recu:'Reçu',confirme:'Confirmé',en_traitement:'En traitement',transforme_df:'→ DF créée',annule:'Annulé'}[d.statut]||d.statut;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4;margin:14mm;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#1f2937;}
  .header{border-bottom:3px solid #15803d;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;}
  .company{font-size:18pt;font-weight:900;color:#15803d;}
  .banner{background:#15803d;color:#fff;text-align:center;padding:8px;border-radius:4px;margin-bottom:12px;font-size:12pt;font-weight:700;text-transform:uppercase;}
  .num{font-size:18pt;font-weight:900;color:#15803d;text-align:center;margin:6px 0;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
  .sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;}
  .sec-h{background:#f3f4f6;padding:4px 10px;font-size:7.5pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;}
  .sec-b{padding:8px 10px;}
  .row{display:flex;justify-content:space-between;margin-bottom:3px;}
  .lbl{color:#6b7280;font-size:8pt;}
  .val{font-weight:700;font-size:8.5pt;}
  table{width:100%;border-collapse:collapse;margin:12px 0;}
  thead tr{background:#15803d;color:#fff;}
  th{padding:8px 10px;text-align:left;font-size:8.5pt;}
  td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:8.5pt;}
  .total-row{background:#f0fdf4;font-weight:700;}
  .tracabilite{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:8px;margin:10px 0;font-size:8.5pt;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}
  .sig-box{border:1px solid #d1d5db;border-radius:4px;padding:12px;min-height:70px;}
  .sig-title{font-size:7.5pt;font-weight:700;text-transform:uppercase;margin-bottom:4px;}
  .sig-line{border-top:1px solid #9ca3af;padding-top:4px;font-size:7pt;color:#9ca3af;text-align:center;margin-top:30px;}
  .footer{border-top:1px solid #e5e7eb;padding-top:6px;text-align:center;font-size:7pt;color:#9ca3af;margin-top:12px;}
</style></head><body>
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:8pt;color:#6b7280;">Bon de Commande Client</div></div>
  <div style="text-align:right;"><div style="font-size:8pt;color:#6b7280;">Date réception : ${date_str}</div><div style="font-size:8pt;color:#6b7280;">Réf. BC : ${d.numero_bc}</div>${d.reference_client?`<div style="font-size:8pt;color:#6b7280;">Réf. client : ${d.reference_client}</div>`:''}</div>
</div>
<div class="banner">📦 Bon de Commande</div>
<div class="num">${d.numero_bc}</div>
<div class="tracabilite">
  ${d.numero_devis?`📋 Devis d'origine : <strong>${d.numero_devis}</strong>`:'📋 BC direct (sans devis)'}
  ${d.numero_df?` → 📝 DF créée : <strong>${d.numero_df}</strong>`:''}
</div>
<div class="grid">
  <div class="sec">
    <div class="sec-h">Client</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Raison sociale</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone?`<div class="row"><span class="lbl">Tél</span><span class="val">${d.telephone}</span></div>`:''}
      ${d.adresse_livraison?`<div class="row"><span class="lbl">Livraison à</span><span class="val">${d.adresse_livraison}</span></div>`:''}
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Livraison</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Date souhaitée</span><span class="val">${livr_str}</span></div>
      <div class="row"><span class="lbl">Statut</span><span class="val">${statut_label}</span></div>
      <div class="row"><span class="lbl">Commercial</span><span class="val">${d.commercial_nom||'—'}</span></div>
    </div>
  </div>
</div>
<table>
  <thead><tr><th>Désignation</th><th>Référence</th><th>Qté (kg)</th><th>Qté (pcs)</th><th>P.U. (FCFA)</th><th>Montant TTC</th></tr></thead>
  <tbody>
    <tr>
      <td>${d.article_nom||'—'}</td>
      <td>${d.article_code||'—'}</td>
      <td>${d.quantite?parseFloat(d.quantite).toFixed(1)+' kg':'—'}</td>
      <td>${d.quantite_pieces?parseFloat(d.quantite_pieces).toLocaleString('fr-FR')+' pcs':'—'}</td>
      <td>${d.prix_unitaire_fcfa?parseFloat(d.prix_unitaire_fcfa).toLocaleString('fr-FR')+' FCFA':'—'}</td>
      <td style="font-weight:700;">${d.montant_total_fcfa?parseFloat(d.montant_total_fcfa).toLocaleString('fr-FR')+' FCFA':'—'}</td>
    </tr>
    <tr class="total-row">
      <td colspan="5" style="text-align:right;">TOTAL</td>
      <td>${d.montant_total_fcfa?parseFloat(d.montant_total_fcfa).toLocaleString('fr-FR')+' FCFA':'—'}</td>
    </tr>
  </tbody>
</table>
${d.notes?`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px;font-size:8.5pt;"><strong>Notes :</strong> ${d.notes}</div>`:''}
<div class="sigs">
  <div class="sig-box"><div class="sig-title">Reçu par NAI</div><div style="font-size:8pt;color:#6b7280;">${d.commercial_nom||'—'}</div><div class="sig-line">Signature</div></div>
  <div class="sig-box"><div class="sig-title">Émis par le Client</div><div style="font-size:8pt;color:#6b7280;">${d.client_nom||'—'}</div><div class="sig-line">Signature & Cachet</div></div>
</div>
<div class="footer">BC ${d.numero_bc} · NAI — Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo SOPHOPSY</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
