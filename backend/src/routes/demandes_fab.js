const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/df
router.get('/', auth, async (req, res) => {
  try {
    const { statut } = req.query;
    let q = `
      SELECT df.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             u1.nom||' '||u1.prenom AS demandeur_nom,
             u2.nom||' '||u2.prenom AS valideur_nom,
             o.numero_of,
             bc.numero_bc,
             COALESCE((SELECT SUM(quantite_kg) FROM bc_lignes WHERE bc_id=df.bc_id), df.quantite_demandee) AS quantite_totale_kg
      FROM demandes_fabrication df
      LEFT JOIN clients_complet c ON c.id=df.client_id
      LEFT JOIN articles a ON a.id=df.article_id
      LEFT JOIN utilisateurs u1 ON u1.id=df.demandeur_id
      LEFT JOIN utilisateurs u2 ON u2.id=df.validee_par
      LEFT JOIN ordres_fabrication o ON o.id=df.of_id
      LEFT JOIN bons_commande bc ON bc.id=df.bc_id
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); q += ` AND df.statut=$${params.length}`; }
    q += ' ORDER BY df.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/df
router.post('/', auth, async (req, res) => {
  try {
    const { client_id, article_id, quantite_demandee, description,
            specifications, date_livraison_souhaitee, priorite, notes } = req.body;
    if (!article_id || !quantite_demandee)
      return res.status(400).json({ error: 'article_id et quantite_demandee requis' });
    const { rows } = await db.query(`
      INSERT INTO demandes_fabrication
        (client_id, article_id, quantite_demandee, description,
         specifications, date_livraison_souhaitee, priorite,
         demandeur_id, notes, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'en_attente')
      RETURNING *
    `, [client_id||null, article_id, parseFloat(quantite_demandee),
        description||null, specifications||null,
        date_livraison_souhaitee||null, parseInt(priorite||3),
        req.user.id, notes||null]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/valider — Direction valide et crée OF automatiquement
router.put('/:id/valider', auth, async (req, res) => {
  try {
    const { machine_id, atelier_id, date_debut_prevue } = req.body;
    const { rows: df } = await db.query(
      'SELECT * FROM demandes_fabrication WHERE id=$1', [req.params.id]
    );
    if (!df.length) return res.status(404).json({ error: 'DF introuvable' });
    const d = df[0];

    // Calculer temps prévu
    let temps_prevu_min = null;
    const { rows: art } = await db.query(
      'SELECT cadence_theorique_kg_h, temps_reglage_min FROM articles WHERE id=$1', [d.article_id]
    );
    if (art.length && parseFloat(art[0].cadence_theorique_kg_h||0) > 0) {
      const c = parseFloat(art[0].cadence_theorique_kg_h);
      const r = parseFloat(art[0].temps_reglage_min||30);
      temps_prevu_min = Math.round((parseFloat(d.quantite_demandee)/c)*60 + r);
    }

    // Créer OF automatiquement
    const { rows: of } = await db.query(`
      INSERT INTO ordres_fabrication
        (client_id, article_id, quantite_cible, machine_id, atelier_id,
         date_livraison_prevue, date_debut_prevue, priorite, statut,
         temps_prevu_min, df_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'planifie',$9,$10)
      RETURNING *
    `, [d.client_id, d.article_id, d.quantite_demandee,
        machine_id ? parseInt(machine_id) : null,
        atelier_id||'AT3',
        d.date_livraison_souhaitee, date_debut_prevue||null,
        d.priorite, temps_prevu_min, d.id]);

    // Mettre à jour la DF
    const { rows: updated } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='validee', validee_par=$1, validee_at=NOW(), of_id=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [req.user.id, of[0].id, req.params.id]);

    res.json({ df: updated[0], of: of[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/refuser
router.put('/:id/refuser', auth, async (req, res) => {
  try {
    const { motif_refus } = req.body;
    const { rows } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='refusee', validee_par=$1, validee_at=NOW(), motif_refus=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [req.user.id, motif_refus||'', req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// GET /api/df/:id/ticket — Document de Demande de Fabrication
router.get('/:id/ticket', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT df.*, 
             c.raison_sociale AS client_nom, c.telephone, c.email,
             a.designation AS article_nom, a.code AS article_code,
             a.longueur_mm, a.largeur_mm,
             u1.nom||' '||u1.prenom AS demandeur_nom,
             u2.nom||' '||u2.prenom AS valideur_nom,
             o.numero_of,
             bc.numero_bc,
             COALESCE((SELECT SUM(quantite_kg) FROM bc_lignes WHERE bc_id=df.bc_id), df.quantite_demandee) AS quantite_totale_kg
      FROM demandes_fabrication df
      LEFT JOIN clients_complet c ON c.id=df.client_id
      LEFT JOIN articles a ON a.id=df.article_id
      LEFT JOIN utilisateurs u1 ON u1.id=df.demandeur_id
      LEFT JOIN utilisateurs u2 ON u2.id=df.validee_par
      LEFT JOIN ordres_fabrication o ON o.id=df.of_id
      WHERE df.id=$1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'DF introuvable' });
    const d = rows[0];

    const qr_text = `NAI DEMANDE FABRICATION\nN: ${d.numero_df}\nARTICLE: ${d.article_code} ${d.article_nom}\nQTE: ${d.quantite_demandee} kg\nCLIENT: ${d.client_nom||'—'}\nSTATUT: ${d.statut}\nOF: ${d.numero_of||'—'}\nDATE: ${new Date(d.created_at).toLocaleDateString('fr-FR')}`;

    const couleur = d.statut==='validee'?'#15803d':d.statut==='refusee'?'#dc2626':'#d97706';
    const bgCouleur = d.statut==='validee'?'#dcfce7':d.statut==='refusee'?'#fee2e2':'#fef3c7';
    const labelStatut = {en_attente:'En attente',validee:'Validée',refusee:'Refusée',annulee:'Annulée'}[d.statut]||d.statut;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>DF ${d.numero_df}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A5; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1f2937; background: #fff; }
  .header { border-bottom: 3px solid #7c3aed; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
  .company { font-size: 14pt; font-weight: 900; color: #7c3aed; }
  .sub { font-size: 7pt; color: #6b7280; }
  .banner { background: #7c3aed; color: #fff; text-align: center; padding: 6px; border-radius: 4px; margin-bottom: 10px; font-size: 10pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .df-num { font-size: 16pt; font-weight: 900; color: #7c3aed; text-align: center; margin: 6px 0 3px; }
  .statut-badge { text-align: center; margin-bottom: 8px; }
  .badge { display: inline-block; background: ${bgCouleur}; color: ${couleur}; border: 1px solid ${couleur}; border-radius: 12px; padding: 3px 12px; font-weight: 700; font-size: 9pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .sec { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
  .sec-h { background: #f3f4f6; padding: 3px 8px; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #374151; border-bottom: 1px solid #e5e7eb; letter-spacing: 0.3px; }
  .sec-b { padding: 6px 8px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .lbl { color: #6b7280; font-size: 7.5pt; }
  .val { font-weight: 700; color: #111827; font-size: 8pt; }
  .qte-big { font-size: 18pt; font-weight: 900; color: #7c3aed; text-align: center; margin: 4px 0 2px; }
  .qte-lbl { text-align: center; font-size: 7pt; color: #6b7280; margin-bottom: 4px; }
  .of-link { background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 4px; padding: 5px 8px; text-align: center; margin: 6px 0; }
  .of-link .of-num { font-size: 13pt; font-weight: 800; color: #0369a1; }
  .specs { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 8px; margin-bottom: 8px; font-size: 8pt; color: #374151; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .sig-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 10px; min-height: 60px; }
  .sig-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #374151; margin-bottom: 3px; }
  .sig-name { font-size: 7.5pt; color: #6b7280; margin-bottom: 25px; }
  .sig-line { border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 6.5pt; color: #9ca3af; text-align: center; }
  .qr-wrap { text-align: center; margin: 8px 0; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 5px; text-align: center; font-size: 6.5pt; color: #9ca3af; margin-top: 6px; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company">NAI</div>
    <div class="sub">Atelier 3 — Système de Production</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:7pt;color:#6b7280;">Date : ${new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
    <div style="font-size:7pt;color:#6b7280;">Demandeur : ${d.demandeur_nom||'—'}</div>
  </div>
</div>

<div class="banner">📝 Demande de Fabrication</div>
<div class="df-num">${d.numero_df}</div>
<div class="statut-badge"><span class="badge">${labelStatut}</span></div>

<div class="grid">
  <div class="sec">
    <div class="sec-h">Article à fabriquer</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Code</span><span class="val">${d.article_code||'—'}</span></div>
      <div class="row"><span class="lbl">Désignation</span><span class="val" style="font-size:7.5pt;">${d.article_nom||'—'}</span></div>
      ${d.longueur_mm ? `<div class="row"><span class="lbl">Dimensions</span><span class="val">${d.longueur_mm}×${d.largeur_mm||'?'} mm</span></div>` : ''}
    </div>
  </div>
  <div class="sec">
    <div class="sec-h">Client</div>
    <div class="sec-b">
      <div class="row"><span class="lbl">Nom</span><span class="val">${d.client_nom||'—'}</span></div>
      ${d.telephone ? `<div class="row"><span class="lbl">Tél</span><span class="val">${d.telephone}</span></div>` : ''}
      <div class="row"><span class="lbl">Livraison</span><span class="val">${d.date_livraison_souhaitee?new Date(d.date_livraison_souhaitee).toLocaleDateString('fr-FR'):'—'}</span></div>
      <div class="row"><span class="lbl">Priorité</span><span class="val">${'⭐'.repeat(d.priorite||1)}</span></div>
    </div>
  </div>
</div>

<div class="qte-big">${parseFloat(d.quantite_demandee).toFixed(0)} kg</div>
<div class="qte-lbl">QUANTITÉ DEMANDÉE</div>

${d.description ? `<div class="specs"><strong>Spécifications :</strong> ${d.description}</div>` : ''}

${d.numero_of ? `
<div class="of-link">
  <div style="font-size:7pt;color:#6b7280;margin-bottom:2px;">Ordre de fabrication généré</div>
  <div class="of-num">→ ${d.numero_of}</div>
  ${d.valideur_nom ? `<div style="font-size:7pt;color:#6b7280;">Validé par : ${d.valideur_nom} — ${d.validee_at?new Date(d.validee_at).toLocaleDateString('fr-FR'):'—'}</div>` : ''}
</div>
` : `
<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:6px;text-align:center;font-size:8pt;color:#92400e;margin:6px 0;">
  ⏳ En attente de validation par la Direction
</div>
`}

<div class="qr-wrap">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qr_text)}&color=7c3aed" 
       alt="QR" width="90" height="90"/>
  <div style="font-size:6pt;color:#9ca3af;margin-top:2px;">${d.numero_df}</div>
</div>

<div class="sigs">
  <div class="sig-box">
    <div class="sig-title">Demandeur</div>
    <div class="sig-name">${d.demandeur_nom||'—'}</div>
    <div class="sig-line">Signature</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">Direction / Validation</div>
    <div class="sig-name">${d.valideur_nom||'À signer'}</div>
    <div class="sig-line">Signature</div>
  </div>
</div>

<div class="footer">
  Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo — SOPHOPSY pour NAI
</div>

<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id — modifier une DF
router.put('/:id', auth, async (req, res) => {
  try {
    const { quantite_demandee, description, specifications, date_livraison_souhaitee, priorite } = req.body;
    const { rows } = await db.query(`
      UPDATE demandes_fabrication SET
        quantite_demandee = COALESCE($1, quantite_demandee),
        description = COALESCE($2, description),
        specifications = COALESCE($3, specifications),
        date_livraison_souhaitee = COALESCE($4, date_livraison_souhaitee),
        priorite = COALESCE($5, priorite),
        updated_at = NOW()
      WHERE id=$6 AND statut='en_attente'
      RETURNING *
    `, [quantite_demandee||null, description||null, specifications||null,
        date_livraison_souhaitee||null, priorite||null, req.params.id]);
    if (!rows.length) return res.status(400).json({ error: 'DF introuvable ou déjà validée' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/annuler — annulation par le commercial
router.put('/:id/annuler', auth, async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif requis' });
    const { rows } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='annulee', motif_refus=$1, validee_par=$2, validee_at=NOW(), updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, ['[Annulé par commercial] ' + motif, req.user.id, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'DF introuvable' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/demander-annulation
router.put('/:id/demander-annulation', auth, async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif requis' });
    const { rows } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='annulation_demandee', motif_refus=$1, updated_at=NOW()
      WHERE id=$2 RETURNING *
    `, ['[Annulation demandée] ' + motif, req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/valider-annulation — Direction approuve/refuse l'annulation
router.put('/:id/valider-annulation', auth, async (req, res) => {
  try {
    const { accepter } = req.body;
    const nouveau_statut = accepter ? 'annulee' : 'en_attente';
    const { rows } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut=$1, validee_par=$2, validee_at=NOW(), updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [nouveau_statut, req.user.id, req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
