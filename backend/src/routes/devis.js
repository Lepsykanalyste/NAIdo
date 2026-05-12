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
             u.nom||' '||u.prenom AS commercial_nom,
             (SELECT COUNT(*) FROM devis_lignes WHERE devis_id=d.id) AS nb_lignes
      FROM devis d
      LEFT JOIN clients_complet c ON c.id=d.client_id
      LEFT JOIN utilisateurs u ON u.id=d.commercial_id
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/devis/:id/lignes
router.get('/:id/lignes', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT dl.*, a.code AS article_code, a.designation AS article_nom,
             a.poids_piece_kg
      FROM devis_lignes dl
      LEFT JOIN articles a ON a.id=dl.article_id
      WHERE dl.devis_id=$1 ORDER BY dl.ordre
    `, [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/devis
router.post('/', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { client_id, date_validite, conditions_livraison, notes,
            remise_pct, taux_tva, lignes } = req.body;

    // Créer le devis
    const { rows: dv } = await client.query(`
      INSERT INTO devis (client_id, date_validite, conditions_livraison, notes,
        remise_pct, taux_tva, commercial_id, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'brouillon') RETURNING *
    `, [client_id||null, date_validite||null, conditions_livraison||null,
        notes||null, parseFloat(remise_pct||0), parseFloat(taux_tva||18), req.user.id]);

    let total_ht = 0, total_tva = 0, total_ttc = 0;

    // Insérer les lignes
    for (let i=0; i<(lignes||[]).length; i++) {
      const l = lignes[i];
      const pu_ht = parseFloat(l.prix_unitaire_ht||0);
      const qte = parseFloat(l.quantite_pieces||l.quantite_kg||0);
      const rem = parseFloat(l.remise_pct||0);
      const tva = parseFloat(l.taux_tva||18);
      const ht = pu_ht * qte * (1 - rem/100);
      const tva_amt = ht * tva / 100;
      const ttc = ht + tva_amt;
      total_ht += ht; total_tva += tva_amt; total_ttc += ttc;

      const qte_kg = parseFloat(l.quantite_kg||0) > 0
          ? parseFloat(l.quantite_kg||0)
          : parseInt(l.quantite_pieces||0) * parseFloat(l.poids_piece_kg||l.poids_theorique_kg||0);
      await client.query(`
        INSERT INTO devis_lignes (devis_id, article_id, designation, quantite_pieces,
          quantite_kg, prix_unitaire_ht, remise_pct, taux_tva,
          montant_ht, montant_tva, montant_ttc, ordre)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [dv[0].id, l.article_id||null, l.designation||'', parseInt(l.quantite_pieces||0),
          qte_kg, pu_ht, rem, tva, ht, tva_amt, ttc, i]);
    }

    // Mise à jour totaux
    const rem_glob = parseFloat(remise_pct||0);
    const disc = total_ht * rem_glob / 100;
    const ht_net = total_ht - disc;
    const tva_net = ht_net * parseFloat(taux_tva||18) / 100;
    const ttc_final = ht_net + tva_net;

    const { rows: final } = await client.query(`
      UPDATE devis SET montant_ht=$1, montant_tva=$2, montant_total_fcfa=$3 WHERE id=$4 RETURNING *
    `, [ht_net, tva_net, ttc_final, dv[0].id]);

    await client.query('COMMIT');
    res.status(201).json(final[0]);
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// PUT /api/devis/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE devis SET statut=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [req.body.statut, req.params.id]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/devis/:id/transformer-bc
router.post('/:id/transformer-bc', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { reference_client, date_livraison_souhaitee, adresse_livraison, notes } = req.body;
    const { rows: dv } = await client.query(
      'SELECT * FROM devis WHERE id=$1', [req.params.id]
    );
    if (!dv.length) throw new Error('Devis introuvable');
    const d = dv[0];

    const { rows: bc } = await client.query(`
      INSERT INTO bons_commande (devis_id, client_id, date_livraison_souhaitee,
        adresse_livraison, reference_client, notes, commercial_id,
        montant_ht, montant_tva, montant_total_fcfa, remise_pct, taux_tva, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'recu') RETURNING *
    `, [d.id, d.client_id, date_livraison_souhaitee||null, adresse_livraison||null,
        reference_client||null, notes||null, req.user.id,
        d.montant_ht, d.montant_tva, d.montant_total_fcfa, d.remise_pct, d.taux_tva]);

    // Copier les lignes
    const { rows: lignes } = await client.query(
      `SELECT dl.*, a.poids_piece_kg
       FROM devis_lignes dl
       LEFT JOIN articles a ON a.id = dl.article_id
       WHERE dl.devis_id=$1 ORDER BY dl.ordre`, [d.id]
    );
    for (const l of lignes) {
      await client.query(`
        INSERT INTO bc_lignes (bc_id, article_id, designation, quantite_pieces,
          quantite_kg, prix_unitaire_ht, remise_pct, taux_tva,
          montant_ht, montant_tva, montant_ttc, ordre)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [bc[0].id, l.article_id, l.designation, l.quantite_pieces,
          l.quantite_kg, l.prix_unitaire_ht, l.remise_pct, l.taux_tva,
          l.montant_ht, l.montant_tva, l.montant_ttc, l.ordre]);
    }

    await client.query("UPDATE devis SET statut='transforme' WHERE id=$1", [d.id]);
    await client.query('COMMIT');
    res.json(bc[0]);
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// GET /api/devis/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows: dv } = await db.query(`
      SELECT d.*, c.raison_sociale AS client_nom, c.telephone, c.email, c.adresse,
             u.nom||' '||u.prenom AS commercial_nom
      FROM devis d
      LEFT JOIN clients_complet c ON c.id=d.client_id
      LEFT JOIN utilisateurs u ON u.id=d.commercial_id
      WHERE d.id=$1
    `, [req.params.id]);
    if (!dv.length) return res.status(404).json({ error: 'Devis introuvable' });

    const { rows: lignes } = await db.query(`
      SELECT dl.*, a.code AS article_code FROM devis_lignes dl
      LEFT JOIN articles a ON a.id=dl.article_id
      WHERE dl.devis_id=$1 ORDER BY dl.ordre
    `, [req.params.id]);

    const d = dv[0];
    const date_str = new Date(d.created_at).toLocaleDateString('fr-FR');
    const valid_str = d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—';
    const statut_label = {brouillon:'Brouillon',envoye:'Envoyé',accepte:'Accepté',refuse:'Refusé',expire:'Expiré',transforme:'→ BC créé'}[d.statut]||d.statut;
    const couleur = {brouillon:'#6b7280',envoye:'#0369a1',accepte:'#15803d',refuse:'#dc2626',expire:'#9ca3af',transforme:'#7c3aed'}[d.statut]||'#6b7280';

    // Recalculer totaux depuis lignes
    let total_ht_calc = 0, total_tva_calc = 0;
    lignes.forEach(l => {
      const q = parseFloat(l.quantite_pieces||0);
      const p = parseFloat(l.prix_unitaire_ht||0);
      const r = parseFloat(l.remise_pct||0);
      const t = parseFloat(l.taux_tva||18);
      const ht = p * q * (1 - r/100);
      total_ht_calc += ht;
      total_tva_calc += ht * t / 100;
    });
    const total_ttc_calc = total_ht_calc + total_tva_calc;

    const lignes_html = lignes.map((l,i) => {
      const qte = parseFloat(l.quantite_pieces||0);
      const pu = parseFloat(l.prix_unitaire_ht||0);
      const rem = parseFloat(l.remise_pct||0);
      const tva = parseFloat(l.taux_tva||18);
      const ht = pu * qte * (1 - rem/100);
      const tva_amt = ht * tva / 100;
      const ttc = ht + tva_amt;
      return `
      <tr style="background:${i%2===0?'#fff':'#f9fafb'};">
        <td style="padding:8px 10px;">${i+1}</td>
        <td style="padding:8px 10px;font-weight:600;">${l.designation||l.article_code||'—'}</td>
        <td style="padding:8px 10px;text-align:right;">${qte.toLocaleString('fr-FR')} pcs</td>
        <td style="padding:8px 10px;text-align:right;">${pu.toLocaleString('fr-FR')} FCFA</td>
        <td style="padding:8px 10px;text-align:right;">${rem.toFixed(0)}%</td>
        <td style="padding:8px 10px;text-align:right;">${tva.toFixed(0)}%</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;">${ttc.toLocaleString('fr-FR')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4;margin:14mm;}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937;}
  .header{border-bottom:3px solid #0369a1;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;}
  .company{font-size:16pt;font-weight:900;color:#0369a1;}
  .banner{background:#0369a1;color:#fff;text-align:center;padding:7px;border-radius:4px;margin-bottom:10px;font-size:11pt;font-weight:700;text-transform:uppercase;}
  .num{font-size:16pt;font-weight:900;color:#0369a1;text-align:center;margin:5px 0;}
  .badge{display:inline-block;background:#e0f2fe;color:${couleur};border:1px solid ${couleur};border-radius:12px;padding:3px 12px;font-weight:700;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
  .sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;}
  .sec-h{background:#f3f4f6;padding:4px 10px;font-size:7.5pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb;}
  .sec-b{padding:7px 10px;}
  .row{display:flex;justify-content:space-between;margin-bottom:3px;font-size:8.5pt;}
  .lbl{color:#6b7280;} .val{font-weight:700;}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:8.5pt;}
  thead tr{background:#0369a1;color:#fff;}
  th{padding:7px 10px;text-align:left;}
  th.r{text-align:right;}
  .totaux{display:flex;justify-content:flex-end;margin-top:4px;}
  .totaux-box{width:280px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}
  .totaux-box table{margin:0;}
  .totaux-box td{padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:8.5pt;}
  .totaux-box .ttc{background:#0369a1;color:#fff;font-weight:800;font-size:10pt;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
  .sig-box{border:1px solid #d1d5db;border-radius:4px;padding:10px;min-height:65px;}
  .sig-title{font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px;}
  .sig-line{border-top:1px solid #9ca3af;padding-top:3px;font-size:6.5pt;color:#9ca3af;text-align:center;margin-top:25px;}
  .footer{border-top:1px solid #e5e7eb;padding-top:5px;text-align:center;font-size:7pt;color:#9ca3af;margin-top:10px;}
  .validity{background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:6px 10px;margin:8px 0;font-size:8pt;color:#92400e;}
</style></head><body>
<div class="header">
  <div>
    <div class="company">NAI</div>
    <div style="font-size:7.5pt;color:#6b7280;">Fabrication de sacs plastiques — Atelier 3</div>
    <div style="font-size:7.5pt;color:#6b7280;margin-top:3px;">Commercial : ${d.commercial_nom||'—'}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:8pt;color:#6b7280;">Date : ${date_str}</div>
    <div style="font-size:8pt;color:#6b7280;">N° : ${d.numero_devis}</div>
  </div>
</div>
<div class="banner">📋 Devis Commercial</div>
<div class="num">${d.numero_devis}</div>
<div style="text-align:center;margin-bottom:10px;"><span class="badge">${statut_label}</span></div>
<div class="grid">
  <div class="sec">
    <div class="sec-h">Client</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Raison sociale</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone?`<div class="row"><span class="lbl">Tél</span><span class="val">${d.telephone}</span></div>`:''}
      ${d.email?`<div class="row"><span class="lbl">Email</span><span class="val">${d.email}</span></div>`:''}
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Conditions</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Validité</span><span class="val" style="color:#dc2626;">${valid_str}</span></div>
      ${d.conditions_livraison?`<div class="row"><span class="lbl">Livraison</span><span class="val">${d.conditions_livraison}</span></div>`:''}
      <div class="row"><span class="lbl">TVA</span><span class="val">${d.taux_tva||18}%</span></div>
      ${parseFloat(d.remise_pct||0)>0?`<div class="row"><span class="lbl">Remise globale</span><span class="val">${d.remise_pct}%</span></div>`:''}
    </div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:30px;">#</th>
    <th>Désignation</th>
    <th class="r">Quantité</th>
    <th class="r">P.U. HT</th>
    <th class="r">Rem.</th>
    <th class="r">TVA</th>
    <th class="r">Total TTC</th>
  </tr></thead>
  <tbody>${lignes_html}</tbody>
</table>
<div class="totaux">
  <div class="totaux-box">
    <table>
      <tr><td style="color:#6b7280;">Sous-total HT</td><td style="text-align:right;font-weight:600;">${total_ht_calc.toLocaleString('fr-FR')} FCFA</td></tr>
      ${parseFloat(d.remise_pct||0)>0?`<tr><td style="color:#dc2626;">Remise (${d.remise_pct}%)</td><td style="text-align:right;color:#dc2626;">-${(parseFloat(d.montant_ht||0)*parseFloat(d.remise_pct||0)/100).toLocaleString('fr-FR')} FCFA</td></tr>`:''}
      <tr><td style="color:#6b7280;">TVA (${d.taux_tva||18}%)</td><td style="text-align:right;">${total_tva_calc.toLocaleString('fr-FR')} FCFA</td></tr>
      <tr class="ttc"><td>TOTAL TTC</td><td style="text-align:right;">${total_ttc_calc.toLocaleString('fr-FR')} FCFA</td></tr>
    </table>
  </div>
</div>
${d.notes?`<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:8px;margin-top:8px;font-size:8pt;"><strong>Notes :</strong> ${d.notes}</div>`:''}
<div class="validity">⚠ Ce devis est valable jusqu'au <strong>${valid_str}</strong>. Passé ce délai, les prix pourront être révisés.</div>
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

// POST /api/devis/:id/envoyer-email
router.post('/:id/envoyer-email', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, c.raison_sociale AS client_nom, c.email AS client_email,
             u.nom||' '||u.prenom AS commercial_nom, u.email AS commercial_email
      FROM devis d
      LEFT JOIN clients_complet c ON c.id=d.client_id
      LEFT JOIN utilisateurs u ON u.id=d.commercial_id
      WHERE d.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Devis introuvable' });
    const d = rows[0];
    if (!d.client_email) return res.status(400).json({ error: 'Le client n\'a pas d\'email renseigné' });

    const nodemailer = require('nodemailer');
    const emailConfig = req.body.email_config || {};

    const transporter = nodemailer.createTransport({
      host: emailConfig.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(emailConfig.port || process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: emailConfig.user || process.env.SMTP_USER || d.commercial_email,
        pass: emailConfig.pass || process.env.SMTP_PASS || '',
      },
    });

    const validationUrl = `http://100.85.252.109:8095/api/devis/valider/${d.token_validation}`;
    const pdfUrl = `http://100.85.252.109:8095/api/devis/${d.id}/pdf`;

    await transporter.sendMail({
      from: `"NAI - ${d.commercial_nom}" <${emailConfig.user || d.commercial_email}>`,
      to: d.client_email,
      subject: `Devis ${d.numero_devis} — NAI`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0369a1;padding:20px;border-radius:8px 8px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:20px;">NAI — Devis ${d.numero_devis}</h1>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Bonjour <strong>${d.client_nom}</strong>,</p>
            <p>Veuillez trouver ci-joint notre devis <strong>${d.numero_devis}</strong> pour votre commande.</p>
            <p style="font-size:14px;color:#6b7280;">Montant TTC : <strong style="color:#0369a1;font-size:18px;">${total_ttc_calc.toLocaleString('fr-FR')} FCFA</strong></p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${pdfUrl}" style="background:#0369a1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:10px;">
                📄 Voir le devis PDF
              </a>
            </div>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 12px;font-weight:600;">✅ Ce devis vous convient ?</p>
              <a href="${validationUrl}" style="background:#15803d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                ✓ Valider ce devis
              </a>
              <p style="margin:10px 0 0;font-size:11px;color:#6b7280;">En cliquant, vous acceptez les conditions du devis et nous donnez votre accord.</p>
            </div>
            <p style="font-size:13px;color:#6b7280;">Devis valable jusqu'au : <strong>${d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—'}</strong></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
            <p style="font-size:12px;color:#9ca3af;">NAI — Atelier 3 Production | NAIdo by SOPHOPSY</p>
          </div>
        </div>
      `,
    });

    await db.query(
      "UPDATE devis SET statut='envoye', email_envoye_at=NOW() WHERE id=$1",
      [d.id]
    );
    res.json({ ok: true, message: `Devis envoyé à ${d.client_email}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/devis/valider/:token — validation par le client (lien email)
router.get('/valider/:token', async (req, res) => {
  try {
    const { rows } = await db.query(
      "UPDATE devis SET statut='accepte', validee_par_client_at=NOW() WHERE token_validation=$1 AND statut='envoye' RETURNING numero_devis, client_id",
      [req.params.token]
    );
    if (!rows.length) {
      return res.send(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:60px;">
        <h2 style="color:#dc2626;">❌ Lien invalide ou devis déjà traité</h2>
        <p>Ce lien de validation n'est plus actif.</p>
      </body></html>`);
    }
    res.send(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:60px;background:#f0fdf4;">
      <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;border:2px solid #86efac;">
        <div style="font-size:64px;margin-bottom:16px;">✅</div>
        <h2 style="color:#15803d;">Devis ${rows[0].numero_devis} validé !</h2>
        <p style="color:#374151;">Merci pour votre confirmation. Notre équipe commerciale vous contactera très prochainement pour finaliser votre commande.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">NAI — Atelier 3 Production</p>
      </div>
    </body></html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});
