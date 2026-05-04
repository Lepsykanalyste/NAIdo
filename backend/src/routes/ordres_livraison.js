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
             bc.numero_bc, bc.reference_client,
             df.numero_df, o.numero_of,
             u.nom||' '||u.prenom AS demandeur_nom,
             (SELECT COUNT(*) FROM ol_lignes WHERE ol_id=ol.id) AS nb_articles
      FROM ordres_livraison ol
      LEFT JOIN clients_complet c ON c.id=ol.client_id
      LEFT JOIN bons_commande bc ON bc.id=ol.bc_id
      LEFT JOIN demandes_fabrication df ON df.id=ol.df_id
      LEFT JOIN ordres_fabrication o ON o.id=ol.of_id
      LEFT JOIN utilisateurs u ON u.id=ol.demandeur_id
      ORDER BY ol.created_at DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ol/:id/lignes
router.get('/:id/lignes', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ll.*, a.code AS article_code, a.designation AS article_nom_complet
      FROM ol_lignes ll
      LEFT JOIN articles a ON a.id=ll.article_id
      WHERE ll.ol_id=$1 ORDER BY ll.ordre
    `, [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ol
router.post('/', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { bc_id, client_id, date_livraison_prevue, adresse_livraison,
            notes, est_derogatoire, transporteur, lignes } = req.body;
    if (!lignes || lignes.length === 0)
      return res.status(400).json({ error: 'Au moins une ligne requise' });

    const { rows: ol } = await client.query(`
      INSERT INTO ordres_livraison
        (bc_id, client_id, date_livraison_prevue, adresse_livraison,
         notes, est_derogatoire, transporteur, demandeur_id, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'brouillon') RETURNING *
    `, [bc_id||null, client_id||null, date_livraison_prevue||null,
        adresse_livraison||null, notes||null, est_derogatoire||false,
        transporteur||null, req.user.id]);

    for (let i=0; i<lignes.length; i++) {
      const l = lignes[i];
      await client.query(`
        INSERT INTO ol_lignes (ol_id, bc_ligne_id, article_id, designation,
          quantite_commandee, quantite_livrer, ordre)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [ol[0].id, l.bc_ligne_id||null, l.article_id||null,
          l.designation||'', parseFloat(l.quantite_commandee||0),
          parseFloat(l.quantite_livrer||0), i]);
    }
    await client.query('COMMIT');
    res.status(201).json(ol[0]);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// PUT /api/ol/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut, numero_suivi, transporteur } = req.body;
    const { rows } = await db.query(`
      UPDATE ordres_livraison SET
        statut=$1,
        numero_suivi=COALESCE($2, numero_suivi),
        transporteur=COALESCE($3, transporteur),
        updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [statut, numero_suivi||null, transporteur||null, req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ol/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ol.*, c.raison_sociale AS client_nom, c.telephone, c.adresse,
             bc.numero_bc, bc.reference_client,
             df.numero_df, o.numero_of,
             u.nom||' '||u.prenom AS demandeur_nom
      FROM ordres_livraison ol
      LEFT JOIN clients_complet c ON c.id=ol.client_id
      LEFT JOIN bons_commande bc ON bc.id=ol.bc_id
      LEFT JOIN demandes_fabrication df ON df.id=ol.df_id
      LEFT JOIN ordres_fabrication o ON o.id=ol.of_id
      LEFT JOIN utilisateurs u ON u.id=ol.demandeur_id
      WHERE ol.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OL introuvable' });
    const d = rows[0];

    const { rows: lignes } = await db.query(`
      SELECT ll.*, a.code AS article_code
      FROM ol_lignes ll
      LEFT JOIN articles a ON a.id=ll.article_id
      WHERE ll.ol_id=$1 ORDER BY ll.ordre
    `, [req.params.id]);

    let lignes_html = '';
    for (const l of lignes) {
      lignes_html += '<tr style="border-bottom:1px solid #e5e7eb;">';
      lignes_html += '<td style="padding:5px 8px;font-weight:700;">'+(l.article_code||'—')+'</td>';
      lignes_html += '<td style="padding:5px 8px;">'+(l.designation||'—')+'</td>';
      lignes_html += '<td style="padding:5px 8px;text-align:right;">'+(l.quantite_commandee?parseFloat(l.quantite_commandee).toLocaleString('fr-FR')+' pcs':'—')+'</td>';
      lignes_html += '<td style="padding:5px 8px;text-align:right;font-weight:700;color:#15803d;">'+parseFloat(l.quantite_livrer||0).toLocaleString('fr-FR')+' pcs</td>';
      lignes_html += '</tr>';
    }

    const date_str = new Date(d.created_at).toLocaleDateString('fr-FR');
    const livr_str = d.date_livraison_prevue ? new Date(d.date_livraison_prevue).toLocaleDateString('fr-FR') : '—';
    const statut_label = {brouillon:'Brouillon',confirme:'Confirme',en_livraison:'En livraison',livre:'Livre',annule:'Annule'}[d.statut]||d.statut;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4;margin:12mm;}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937;}
  .header{border-bottom:3px solid #15803d;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;}
  .company{font-size:14pt;font-weight:900;color:#15803d;}
  .banner{background:#15803d;color:#fff;text-align:center;padding:6px;border-radius:4px;margin-bottom:10px;font-size:10pt;font-weight:700;text-transform:uppercase;}
  .ol-num{font-size:16pt;font-weight:900;color:#15803d;text-align:center;margin:6px 0 3px;}
  .badge{display:inline-block;background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:12px;padding:3px 12px;font-weight:700;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
  .sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;}
  .sec-h{background:#f3f4f6;padding:3px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;}
  .sec-b{padding:6px 8px;}
  .row{display:flex;justify-content:space-between;margin-bottom:2px;}
  .lbl{color:#6b7280;font-size:7.5pt;}
  .val{font-weight:700;font-size:8pt;}
  table{width:100%;border-collapse:collapse;margin:8px 0;}
  thead tr{background:#15803d;color:#fff;}
  th{padding:6px 8px;text-align:left;font-size:8pt;}
  td{font-size:8pt;}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px;}
  .sig-box{border:1px solid #d1d5db;border-radius:4px;padding:10px;min-height:60px;}
  .sig-title{font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px;}
  .sig-line{border-top:1px solid #9ca3af;padding-top:3px;font-size:6.5pt;color:#9ca3af;text-align:center;margin-top:25px;}
  .footer{border-top:1px solid #e5e7eb;padding-top:5px;text-align:center;font-size:6.5pt;color:#9ca3af;margin-top:6px;}
</style></head><body>
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280;">Magasin Central - Livraison</div></div>
  <div style="text-align:right;">
    <div style="font-size:7pt;color:#6b7280;">Date : ${date_str}</div>
    <div style="font-size:7pt;color:#6b7280;">Demandeur : ${d.demandeur_nom||'—'}</div>
  </div>
</div>
<div class="banner">Ordre de Livraison</div>
<div class="ol-num">${d.numero_ol}</div>
<div style="text-align:center;margin-bottom:8px;"><span class="badge">${statut_label}</span></div>
<div class="grid">
  <div class="sec">
    <div class="sec-h">Commande</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">BC NAI</span><span class="val">${d.numero_bc||'—'}</span></div>
      <div class="row"><span class="lbl">Ref client</span><span class="val">${d.reference_client||'—'}</span></div>
      <div class="row"><span class="lbl">DF origine</span><span class="val">${d.numero_df||'—'}</span></div>
      <div class="row"><span class="lbl">OF origine</span><span class="val">${d.numero_of||'—'}</span></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Client destinataire</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Nom</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone ? '<div class="row"><span class="lbl">Tel</span><span class="val">'+d.telephone+'</span></div>' : ''}
      <div class="row"><span class="lbl">Livraison</span><span class="val">${livr_str}</span></div>
      ${d.transporteur ? '<div class="row"><span class="lbl">Transporteur</span><span class="val">'+d.transporteur+'</span></div>' : ''}
      ${d.numero_suivi ? '<div class="row"><span class="lbl">N° suivi</span><span class="val">'+d.numero_suivi+'</span></div>' : ''}
    </div>
  </div>
</div>
<table>
  <thead><tr>
    <th>Ref</th><th>Designation</th><th style="text-align:right;">Qte commandee</th><th style="text-align:right;background:#166534;">Qte a livrer</th>
  </tr></thead>
  <tbody>${lignes_html}</tbody>
</table>
${d.adresse_livraison ? '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px;margin-bottom:8px;font-size:8pt;"><strong>Adresse :</strong> '+d.adresse_livraison+'</div>' : ''}
${d.notes ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:8px;font-size:8pt;"><strong>Notes :</strong> '+d.notes+'</div>' : ''}
<div class="sigs">
  <div class="sig-box"><div class="sig-title">Commercial</div><div style="font-size:7.5pt;color:#6b7280;">${d.demandeur_nom||'—'}</div><div class="sig-line">Signature</div></div>
  <div class="sig-box"><div class="sig-title">Magasinier - Magasin Central</div><div style="font-size:7.5pt;color:#6b7280;">A completer</div><div class="sig-line">Signature</div></div>
</div>
<div class="footer">Genere le ${new Date().toLocaleString('fr-FR')} · NAIdo — SOPHOPSY pour NAI</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/ol/:id — modifier un OL
router.put('/:id', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { client_id, date_livraison_prevue, adresse_livraison, notes,
            est_derogatoire, transporteur, lignes } = req.body;

    await client.query(`
      UPDATE ordres_livraison SET
        client_id=COALESCE($1,client_id),
        date_livraison_prevue=$2,
        adresse_livraison=$3,
        notes=$4,
        est_derogatoire=COALESCE($5,est_derogatoire),
        transporteur=$6,
        updated_at=NOW()
      WHERE id=$7
    `, [client_id||null, date_livraison_prevue||null, adresse_livraison||null,
        notes||null, est_derogatoire, transporteur||null, req.params.id]);

    if (lignes && lignes.length > 0) {
      await client.query('DELETE FROM ol_lignes WHERE ol_id=$1', [req.params.id]);
      for (let i=0; i<lignes.length; i++) {
        const l = lignes[i];
        await client.query(`
          INSERT INTO ol_lignes (ol_id, bc_ligne_id, article_id, designation,
            quantite_commandee, quantite_livrer, ordre)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [req.params.id, l.bc_ligne_id||null, l.article_id||null,
            l.designation||'', parseFloat(l.quantite_commandee||0),
            parseFloat(l.quantite_livrer||0), i]);
      }
    }
    await client.query('COMMIT');
    const { rows } = await db.query('SELECT * FROM ordres_livraison WHERE id=$1', [req.params.id]);
    res.json(rows[0]);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
