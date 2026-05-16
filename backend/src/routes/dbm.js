// ============================================================
// NAIdo — DBM + Stock AT3 + Déclarations Production
// Fichier : backend/src/routes/dbm.js
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

const ok  = (res, data)     => res.json(data);
const err = (res, e, msg='')=> { console.error('[DBM]', msg, e?.message||e); res.status(500).json({ error: msg||e?.message }); };

// ══════════════════════════════════════════════════════════════
// 1. DBM — DEMANDES DE BESOIN EN MATIÈRES
// ══════════════════════════════════════════════════════════════

// GET /api/dbm — liste des DBM
router.get('/', auth, async (req, res) => {
  try {
    const { statut, role } = req.query;
    let q = `SELECT * FROM vue_dbm WHERE 1=1`;
    const params = [];
    if (statut) { params.push(statut); q += ` AND statut=$${params.length}`; }
    // Magasinier MP voit seulement ses DBM
    if (req.user?.role === 'magasinier_mp') {
      params.push(16); q += ` AND magasin_id=$${params.length}`;
    }
    q += ' ORDER BY date_demande DESC LIMIT 100';
    const { rows } = await db.query(q, params);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur liste DBM'); }
});

// GET /api/dbm/:id — détail DBM avec lignes

// GET /api/dbm/:id/pdf — Bon de livraison DBM
router.get('/:id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, o.numero_of,
             u1.prenom||' '||u1.nom AS demandeur_nom,
             u2.prenom||' '||u2.nom AS livreur_nom
      FROM dbm d
      LEFT JOIN ordres_fabrication o ON o.id=d.of_id
      LEFT JOIN utilisateurs u1 ON u1.id=d.demandeur_id
      LEFT JOIN utilisateurs u2 ON u2.id=d.livre_par
      WHERE d.numero_dbm=$1 OR d.id=$1::uuid
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'DBM introuvable' });
    const d = rows[0];
    const { rows: lignes } = await db.query(`
      SELECT dl.*, a.code AS article_code, a.designation AS article_nom
      FROM dbm_lignes dl
      LEFT JOIN articles a ON a.id=dl.article_id
      WHERE dl.dbm_id=$1 ORDER BY dl.created_at
    `, [d.id]);
    let qrUrl = '';
    try {
      const QRCode = require('qrcode');
      const qrData = `NAI-DBM|${d.numero_dbm}|OF:${d.numero_of||'?'}|${new Date(d.created_at).toLocaleDateString('fr-FR')}`;
      qrUrl = await QRCode.toDataURL(qrData, { width:100, margin:1 });
    } catch(e) {}
    const statutColor = { livre:'#15803d', partiel:'#b45309', en_attente:'#1d4ed8', annule:'#dc2626' };
    const lignesHtml = lignes.map(l => `
      <tr>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">${l.article_code||'—'}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">${l.article_nom||'—'}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${parseFloat(l.qte_demandee||0).toFixed(1)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;color:#15803d;font-weight:700">${parseFloat(l.qte_livree||0).toFixed(1)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:7pt;color:#6b7280">${l.numero_lot||'—'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937}.header{border-bottom:3px solid #0369a1;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start}.company{font-size:16pt;font-weight:900;color:#0369a1}.banner{background:#0369a1;color:#fff;text-align:center;padding:8px;border-radius:4px;margin-bottom:12px;font-size:11pt;font-weight:700;text-transform:uppercase}.num{font-size:18pt;font-weight:900;color:#0369a1;text-align:center;margin:6px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}.sec-h{background:#f3f4f6;padding:4px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb}.sec-b{padding:8px}.row{display:flex;justify-content:space-between;margin-bottom:3px}.lbl{color:#6b7280;font-size:7.5pt}.val{font-weight:700;font-size:8pt}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#0369a1;color:#fff;padding:5px 6px;text-align:left;font-size:7.5pt}.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px}.sig-box{border:1px solid #d1d5db;border-radius:4px;padding:10px;min-height:55px}.footer{border-top:1px solid #e5e7eb;padding-top:4px;text-align:center;font-size:6pt;color:#9ca3af;margin-top:8px}
</style></head><body>
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280">Atelier 3 — Sacherie</div></div>
  <div style="text-align:center">${qrUrl ? '<img src="'+qrUrl+'" width="80" height="80"/>' : ''}<div style="font-size:6pt;color:#9ca3af">${d.numero_dbm}</div></div>
  <div style="text-align:right;font-size:7pt;color:#6b7280">Date : ${new Date(d.created_at).toLocaleDateString('fr-FR')}<br>Statut : <span style="color:${statutColor[d.statut]||'#374151'};font-weight:700">${(d.statut||'').toUpperCase()}</span></div>
</div>
<div class="banner">📦 Bon de Livraison Matières — DBM</div>
<div class="num">${d.numero_dbm}</div>
<div class="grid">
  <div class="sec"><div class="sec-h">Informations</div><div class="sec-b">
    <div class="row"><span class="lbl">OF lié</span><span class="val">${d.numero_of||'—'}</span></div>
    <div class="row"><span class="lbl">Demandeur</span><span class="val">${d.demandeur_nom||'—'}</span></div>
    <div class="row"><span class="lbl">Date demande</span><span class="val">${d.date_demande ? new Date(d.date_demande).toLocaleDateString('fr-FR') : '—'}</span></div>
    <div class="row"><span class="lbl">Date besoin</span><span class="val">${d.date_besoin ? new Date(d.date_besoin).toLocaleDateString('fr-FR') : '—'}</span></div>
  </div></div>
  <div class="sec"><div class="sec-h">Livraison</div><div class="sec-b">
    <div class="row"><span class="lbl">Livré par</span><span class="val">${d.livreur_nom||'—'}</span></div>
    <div class="row"><span class="lbl">Date livraison</span><span class="val">${d.date_livraison ? new Date(d.date_livraison).toLocaleDateString('fr-FR') : '—'}</span></div>
    <div class="row"><span class="lbl">Urgence</span><span class="val">${d.urgence ? '⚠️ OUI' : 'Non'}</span></div>
  </div></div>
</div>
<table><thead><tr><th>Code</th><th>Désignation</th><th style="text-align:center">Qté demandée</th><th style="text-align:center">Qté livrée</th><th>N° Lot</th></tr></thead><tbody>${lignesHtml}</tbody></table>
<div class="sigs">
  <div class="sig-box"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">Demandeur</div><div style="font-size:7pt;color:#6b7280;margin-bottom:25px">${d.demandeur_nom||'—'}</div><div style="border-top:1px solid #9ca3af;padding-top:3px;font-size:6pt;color:#9ca3af;text-align:center">Signature</div></div>
  <div class="sig-box"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">Magasinier MP</div><div style="font-size:7pt;color:#6b7280;margin-bottom:25px">${d.livreur_nom||'—'}</div><div style="border-top:1px solid #9ca3af;padding-top:3px;font-size:6pt;color:#9ca3af;text-align:center">Signature</div></div>
  <div class="sig-box"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">Chef Atelier</div><div style="font-size:7pt;color:#6b7280;margin-bottom:25px">—</div><div style="border-top:1px solid #9ca3af;padding-top:3px;font-size:6pt;color:#9ca3af;text-align:center">Signature</div></div>
</div>
<div class="footer">Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo v3 — SOPHOPSY pour NAI</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.send(html);
  } catch(e) { console.error('PDF DBM error:', e); res.status(500).json({ error: 'Erreur PDF' }); }
});



// POST /api/dbm — créer une DBM depuis un OF
router.post('/', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { of_id, lignes, urgence, date_besoin, notes_demandeur } = req.body;
    if (!lignes?.length) throw new Error('Aucune ligne MP');

    // Générer numéro
    const numRes = await client.query("SELECT gen_numero_dbm() AS num");
    const numero_dbm = numRes.rows[0].num;
    const demandeur_id = req.user?.id;

    // Créer la DBM
    const { rows: [dbm] } = await client.query(`
      INSERT INTO dbm (
        numero_dbm, of_id, atelier_id, magasin_id,
        statut, urgence, date_besoin,
        demandeur_id, notes_demandeur
      ) VALUES ($1,$2,1,16,'en_attente',$3,$4,$5,$6)
      RETURNING *
    `, [numero_dbm, of_id, urgence||false, date_besoin||null,
        demandeur_id, notes_demandeur||'']);

    // Créer les lignes
    for (const l of lignes) {
      await client.query(`
        INSERT INTO dbm_lignes (dbm_id, article_id, famille_id, qte_demandee, unite, notes)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [dbm.id, l.article_id, l.famille_id||null,
          l.qte_demandee, l.unite||'kg', l.notes||'']);
    }

    // Réserver le stock AT3 existant
    for (const l of lignes) {
      await client.query(`
        UPDATE stock_at3
        SET qte_reservee = qte_reservee + LEAST($1, qte_disponible - qte_reservee)
        WHERE article_id = $2 AND qte_disponible > qte_reservee
      `, [l.qte_demandee, l.article_id]);
    }

    await client.query('COMMIT');
    ok(res, { dbm, message: `DBM ${numero_dbm} envoyée au Magasin MP ✓` });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur création DBM'); }
  finally { client.release(); }
});

// PUT /api/dbm/:id/livrer — Magasinier MP envoie les MP (en transit)
router.put('/:id/livrer', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { livraisons, notes_magasin } = req.body;
    const mag_id = req.user?.id;
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    for (const l of livraisons) {
      if (!l.qte_livree || parseFloat(l.qte_livree) <= 0) continue;
      await client.query(`
        UPDATE dbm_lignes SET qte_en_transit=$1, numero_lot=$2 WHERE id=$3
      `, [parseFloat(l.qte_livree), l.numero_lot||'', l.ligne_id]);
      const saRes = await client.query('SELECT id FROM stock_articles WHERE article_id=$1 LIMIT 1', [l.article_id]);
      if (saRes.rows.length) {
        await client.query(`
          UPDATE stock_articles SET qte_disponible=GREATEST(0,qte_disponible-$1) WHERE article_id=$2
        `, [parseFloat(l.qte_livree), l.article_id]);
      }
    }
    await client.query(`
      UPDATE dbm SET statut='en_preparation', livre_par=$1, date_livraison=NOW(), notes_magasin=$2 WHERE id=$3
    `, [mag_id, notes_magasin||'', req.params.id]);
    await client.query('COMMIT');
    ok(res, { message: "Livraison envoyée — en attente de réception par l'Atelier 3 ✓" });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur livraison DBM'); }
  finally { client.release(); }
});

// PUT /api/dbm/:id/receptionner — Chef AT3 réceptionne et valide les MP
router.put('/:id/receptionner', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { receptions } = req.body;
    const chef_id = req.user?.id;
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    const dbm = dbmRes.rows[0];
    let toutRecu = true;
    for (const r of receptions) {
      if (!r.qte_recue || parseFloat(r.qte_recue) <= 0) continue;
      const qte = parseFloat(r.qte_recue);
      const ligneRes = await client.query('SELECT * FROM dbm_lignes WHERE id=$1', [r.ligne_id]);
      const ligne = ligneRes.rows[0];
      await client.query(`
        UPDATE dbm_lignes SET qte_livree=qte_livree+$1, qte_en_transit=GREATEST(0,qte_en_transit-$1) WHERE id=$2
      `, [qte, r.ligne_id]);
      const ligneUpd = await client.query('SELECT qte_demandee,qte_livree FROM dbm_lignes WHERE id=$1', [r.ligne_id]);
      if (parseFloat(ligneUpd.rows[0].qte_livree) < parseFloat(ligneUpd.rows[0].qte_demandee)) toutRecu = false;
      const lotNum = ligne?.numero_lot||'';
      const stockRes = await client.query('SELECT id FROM stock_at3 WHERE article_id=$1 AND numero_lot=$2 LIMIT 1', [r.article_id, lotNum]);
      if (stockRes.rows.length) {
        await client.query(`UPDATE stock_at3 SET qte_disponible=qte_disponible+$1,updated_at=NOW() WHERE id=$2`, [qte, stockRes.rows[0].id]);
      } else {
        await client.query(`INSERT INTO stock_at3 (article_id,famille_id,qte_disponible,numero_lot,dbm_id) VALUES ($1,$2,$3,$4,$5)`,
          [r.article_id, r.famille_id||null, qte, lotNum, dbm.id]);
      }
      const numMvt = await client.query("SELECT 'MSAT3-'||TO_CHAR(NOW(),'YYYYMMDD')||'-'||LPAD(nextval('seq_mvt_stock_at3_num')::text,4,'0') AS num");
      await client.query(`INSERT INTO mouvements_stock_at3 (numero_mvt,type_mvt,article_id,quantite,dbm_id,of_id,operateur_id,notes) VALUES ($1,'entree_dbm',$2,$3,$4,$5,$6,$7)`,
        [numMvt.rows[0].num, r.article_id, qte, dbm.id, dbm.of_id, chef_id, `Réception DBM ${dbm.numero_dbm}`]);
    }
    await client.query(`UPDATE dbm SET statut=$1 WHERE id=$2`, [toutRecu?'livre':'partiel', req.params.id]);
    await client.query('COMMIT');
    ok(res, { message: `Réception validée ✓` });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur réception DBM'); }
  finally { client.release(); }
});

// GET /api/dbm/of/:of_id/besoins — calcul besoins MP pour un OF
router.get('/of/:of_id/besoins', auth, async (req, res) => {
  try {
    const ofRes = await db.query(`
      SELECT o.at3_poids_cible_kg, o.quantite_cible, o.article_id, o.numero_of
      FROM ordres_fabrication o WHERE o.id = $1
    `, [req.params.of_id]);
    if (!ofRes.rows.length) return res.status(404).json({ error: 'OF introuvable' });
    const of = ofRes.rows[0];
    const poidsCible = parseFloat(of.at3_poids_cible_kg || of.quantite_cible || 0);

    const compoRows = await db.query(`
      SELECT ca.groupe_id, ca.pct,
             sf.code AS groupe_code, sf.libelle AS groupe_libelle,
             f.id AS famille_id, f.libelle AS famille_libelle
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      JOIN familles_articles f ON f.id = ca.famille_id
      WHERE ca.article_id = $1 ORDER BY ca.ordre
    `, [of.article_id]);

    if (!compoRows.rows.length)
      return res.json({ besoins:[], groupes:[], message:'Aucune composition définie pour cet article' });

    const groupes = [];
    const besoins = [];
    for (const g of compoRows.rows) {
      const pct = parseFloat(g.pct||0);
      const qteNec = poidsCible > 0 ? (pct/100)*poidsCible : 0;
      const artRes = await db.query(`
        SELECT a.id, a.code, a.designation,
               COALESCE(SUM(sa.qte_disponible),0) AS stock_magasin,
               COALESCE((SELECT SUM(qte_disponible) FROM stock_at3 WHERE article_id=a.id),0) AS stock_at3
        FROM articles a
        LEFT JOIN stock_articles sa ON sa.article_id=a.id
        WHERE a.sous_famille_id=$1 AND a.type_article='matiere_premiere'
        GROUP BY a.id,a.code,a.designation ORDER BY a.code
      `, [g.groupe_id]);
      const totalAt3 = artRes.rows.reduce((s,a)=>s+parseFloat(a.stock_at3||0),0);
      groupes.push({
        groupe_id:g.groupe_id, groupe_code:g.groupe_code, groupe_libelle:g.groupe_libelle,
        famille_id:g.famille_id, famille_libelle:g.famille_libelle,
        pct, qte_necessaire:parseFloat(qteNec.toFixed(3)), articles:artRes.rows
      });
      besoins.push({
        groupe_id:g.groupe_id, groupe_libelle:g.groupe_libelle, pct,
        famille_id:g.famille_id, famille_libelle:g.famille_libelle,
        qte_necessaire:parseFloat(qteNec.toFixed(3)),
        qte_dispo_at3:parseFloat(totalAt3.toFixed(3)),
        qte_a_demander:parseFloat(Math.max(0,qteNec-totalAt3).toFixed(3)),
        suffisant:totalAt3>=qteNec
      });
    }
    res.json({ groupes, besoins, poids_cible:poidsCible, of_numero:of.numero_of });
  } catch(e) { res.status(500).json({ error:e.message }); }
});


// ══════════════════════════════════════════════════════════════
// 2. STOCK AT3
// ══════════════════════════════════════════════════════════════


// PUT /api/dbm/:id/annuler — Annuler une DBM avec motif obligatoire
router.put('/:id/annuler', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { motif } = req.body;
    if (!motif || motif.trim().length < 5) throw new Error('Motif obligatoire (min 5 caractères)');
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    const dbm = dbmRes.rows[0];
    if (['livre','annule'].includes(dbm.statut)) throw new Error('DBM non annulable dans ce statut');
    // Remettre le stock en_transit dans stock_articles
    const lignes = await client.query('SELECT * FROM dbm_lignes WHERE dbm_id=$1', [req.params.id]);
    for (const l of lignes.rows) {
      if (parseFloat(l.qte_en_transit||0) > 0) {
        await client.query(`
          UPDATE stock_articles SET qte_disponible=qte_disponible+$1 WHERE article_id=$2
        `, [l.qte_en_transit, l.article_id]);
        await client.query(`UPDATE dbm_lignes SET qte_en_transit=0 WHERE id=$1`, [l.id]);
      }
    }
    await client.query(`
      UPDATE dbm SET statut='annule', notes_magasin=COALESCE(notes_magasin||' | ','') || 'ANNULÉ: ' || $1 WHERE id=$2
    `, [motif.trim(), req.params.id]);
    await client.query('COMMIT');
    ok(res, { message: 'DBM annulée ✓' });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur annulation DBM'); }
  finally { client.release(); }
});

// GET /api/dbm/lots/:article_id — lots disponibles pour un article
router.get('/lots/:article_id', auth, async (req, res) => {
  try {
    const { rows: data } = await db.query(`
      SELECT id, numero_lot, qte_disponible, date_reception, fournisseur_nom
      FROM lots_stock
      WHERE article_id=$1 AND statut='disponible' AND qte_disponible>0
      ORDER BY date_reception ASC
    `, [req.params.article_id]);
    ok(res, data);
  } catch(e) { err(res, e, 'Erreur lots'); }
});


// GET /api/dbm/stock-mp/liste — Stock MP avec lots
router.get('/stock-mp/liste', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.id, a.code, a.designation, f.libelle AS famille_libelle,
             COALESCE(sa.qte_disponible,0) AS qte_disponible,
             COALESCE(sa.qte_reservee,0) AS qte_reservee,
             (SELECT COUNT(*) FROM lots_stock ls WHERE ls.article_id=a.id AND ls.statut='disponible' AND ls.qte_disponible>0) AS nb_lots
      FROM articles a
      JOIN familles_articles f ON f.id=a.famille_id
      LEFT JOIN stock_articles sa ON sa.article_id=a.id
      WHERE a.type_article='matiere_premiere'
      ORDER BY f.libelle, a.code
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur stock MP liste'); }
});

// GET /api/dbm/stock-mp/lots/:article_id — Lots d'un article
router.get('/stock-mp/lots/:article_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ls.*, f.nom AS fournisseur_nom2
      FROM lots_stock ls
      LEFT JOIN clients f ON f.id=ls.fournisseur_id
      WHERE ls.article_id=$1 AND ls.statut='disponible' AND ls.qte_disponible>0
      ORDER BY ls.date_reception ASC
    `, [req.params.article_id]);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur lots MP'); }
});

// POST /api/dbm/stock-mp/entree — Réception fournisseur
router.post('/stock-mp/entree', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { article_id, numero_lot, qte, prix_unitaire, fournisseur_nom, date_reception, date_dluo, notes } = req.body;
    if (!article_id || !numero_lot || !qte) throw new Error('article_id, numero_lot et qte obligatoires');
    const qteNum = parseFloat(qte);
    
    // Créer le lot
    await client.query(`
      INSERT INTO lots_stock (article_id, numero_lot, qte_initiale, qte_disponible, prix_unitaire, fournisseur_nom, date_reception, date_dluo, statut)
      VALUES ($1,$2,$3,$3,$4,$5,$6,$7,'disponible')
      ON CONFLICT (numero_lot) DO UPDATE SET qte_disponible=lots_stock.qte_disponible+$3
    `, [article_id, numero_lot, qteNum, prix_unitaire||0, fournisseur_nom||'', date_reception||new Date().toISOString().split('T')[0], date_dluo||null]);

    // stock_articles mis a jour par trigger
    // Mouvement journal
    await client.query(`
      INSERT INTO journal_stock (article_id, type, qte, numero_lot, cree_par, notes)
      VALUES ($1,'entree',$2,$3,$4,$5)
    `, [article_id, qteNum, numero_lot, req.user?.id, notes||'Réception fournisseur']).catch(()=>{});

    await client.query('COMMIT');
    ok(res, { message: `Entrée de ${qteNum} kg enregistrée — lot ${numero_lot} ✓` });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur entrée stock MP'); }
  finally { client.release(); }
});
// GET /api/dbm/stock-mp/resume — Stock magasin MP par famille
router.get('/stock-mp/resume', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT f.libelle AS famille_libelle, 
             COALESCE(SUM(sa.qte_disponible),0) AS qte_totale
      FROM familles_articles f
      LEFT JOIN articles a ON a.famille_id=f.id AND a.type_article='matiere_premiere'
      LEFT JOIN stock_articles sa ON sa.article_id=a.id
      GROUP BY f.id, f.libelle
      HAVING COALESCE(SUM(sa.qte_disponible),0) > 0
      ORDER BY f.libelle
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur stock MP'); }
});
// GET /api/dbm/stock-at3 — stock MP interne AT3

// GET /api/dbm/stock-at3/mouvements
router.get('/stock-at3/mouvements', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*, a.code, a.designation,
             o.numero_of,
             u.prenom||' '||u.nom AS operateur_nom
      FROM mouvements_stock_at3 m
      LEFT JOIN articles a ON a.id=m.article_id
      LEFT JOIN ordres_fabrication o ON o.id=m.of_id
      LEFT JOIN utilisateurs u ON u.id::text=m.operateur_id::text
      ORDER BY m.date_mvt DESC LIMIT 100
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur mouvements AT3'); }
});

router.get('/stock-at3/liste', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.article_id, s.famille_id,
             s.qte_disponible, s.qte_reservee, s.qte_consommee,
             s.numero_lot, s.date_entree, s.dbm_id,
             a.code, a.designation, a.type_article,
             f.libelle AS famille_libelle, f.code AS famille_code
      FROM stock_at3 s
      JOIN articles a ON a.id = s.article_id
      LEFT JOIN familles_articles f ON f.id = s.famille_id
      WHERE s.qte_disponible > 0 OR s.qte_reservee > 0
      ORDER BY f.libelle, a.code, s.date_entree
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur stock AT3'); }
});


// PUT /api/dbm/:id/annuler — Annuler une DBM avec motif obligatoire
router.put('/:id/annuler', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { motif } = req.body;
    if (!motif || motif.trim().length < 5) throw new Error('Motif obligatoire (min 5 caractères)');
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    const dbm = dbmRes.rows[0];
    if (['livre','annule'].includes(dbm.statut)) throw new Error('DBM non annulable dans ce statut');
    // Remettre le stock en_transit dans stock_articles
    const lignes = await client.query('SELECT * FROM dbm_lignes WHERE dbm_id=$1', [req.params.id]);
    for (const l of lignes.rows) {
      if (parseFloat(l.qte_en_transit||0) > 0) {
        await client.query(`
          UPDATE stock_articles SET qte_disponible=qte_disponible+$1 WHERE article_id=$2
        `, [l.qte_en_transit, l.article_id]);
        await client.query(`UPDATE dbm_lignes SET qte_en_transit=0 WHERE id=$1`, [l.id]);
      }
    }
    await client.query(`
      UPDATE dbm SET statut='annule', notes_magasin=COALESCE(notes_magasin||' | ','') || 'ANNULÉ: ' || $1 WHERE id=$2
    `, [motif.trim(), req.params.id]);
    await client.query('COMMIT');
    ok(res, { message: 'DBM annulée ✓' });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur annulation DBM'); }
  finally { client.release(); }
});

// GET /api/dbm/lots/:article_id — lots disponibles pour un article
router.get('/lots/:article_id', auth, async (req, res) => {
  try {
    const { rows: data } = await db.query(`
      SELECT id, numero_lot, qte_disponible, date_reception, fournisseur_nom
      FROM lots_stock
      WHERE article_id=$1 AND statut='disponible' AND qte_disponible>0
      ORDER BY date_reception ASC
    `, [req.params.article_id]);
    ok(res, data);
  } catch(e) { err(res, e, 'Erreur lots'); }
});


// GET /api/dbm/stock-at3/resume — résumé par famille
router.get('/stock-at3/resume', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT f.id AS famille_id, f.code AS famille_code, f.libelle AS famille_libelle,
             COUNT(DISTINCT s.article_id) AS nb_articles,
             COALESCE(SUM(s.qte_disponible), 0) AS qte_totale,
             COALESCE(SUM(s.qte_reservee),   0) AS qte_reservee
      FROM familles_articles f
      LEFT JOIN stock_at3 s ON s.famille_id = f.id
      GROUP BY f.id, f.code, f.libelle
      ORDER BY f.libelle
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur résumé stock AT3'); }
});


// PUT /api/dbm/:id/annuler — Annuler une DBM avec motif obligatoire
router.put('/:id/annuler', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { motif } = req.body;
    if (!motif || motif.trim().length < 5) throw new Error('Motif obligatoire (min 5 caractères)');
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    const dbm = dbmRes.rows[0];
    if (['livre','annule'].includes(dbm.statut)) throw new Error('DBM non annulable dans ce statut');
    // Remettre le stock en_transit dans stock_articles
    const lignes = await client.query('SELECT * FROM dbm_lignes WHERE dbm_id=$1', [req.params.id]);
    for (const l of lignes.rows) {
      if (parseFloat(l.qte_en_transit||0) > 0) {
        await client.query(`
          UPDATE stock_articles SET qte_disponible=qte_disponible+$1 WHERE article_id=$2
        `, [l.qte_en_transit, l.article_id]);
        await client.query(`UPDATE dbm_lignes SET qte_en_transit=0 WHERE id=$1`, [l.id]);
      }
    }
    await client.query(`
      UPDATE dbm SET statut='annule', notes_magasin=COALESCE(notes_magasin||' | ','') || 'ANNULÉ: ' || $1 WHERE id=$2
    `, [motif.trim(), req.params.id]);
    await client.query('COMMIT');
    ok(res, { message: 'DBM annulée ✓' });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur annulation DBM'); }
  finally { client.release(); }
});

// GET /api/dbm/lots/:article_id — lots disponibles pour un article
router.get('/lots/:article_id', auth, async (req, res) => {
  try {
    const { rows: data } = await db.query(`
      SELECT id, numero_lot, qte_disponible, date_reception, fournisseur_nom
      FROM lots_stock
      WHERE article_id=$1 AND statut='disponible' AND qte_disponible>0
      ORDER BY date_reception ASC
    `, [req.params.article_id]);
    ok(res, data);
  } catch(e) { err(res, e, 'Erreur lots'); }
});



// GET /api/dbm/stock-mp/entree/:lot_id/pdf — Fiche entrée fournisseur
router.get('/stock-mp/entree/:lot_id/pdf', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ls.*, a.code AS article_code, a.designation AS article_nom,
             f.libelle AS famille_libelle
      FROM lots_stock ls
      LEFT JOIN articles a ON a.id=ls.article_id
      LEFT JOIN familles_articles f ON f.id=a.famille_id
      WHERE ls.id=$1`, [req.params.lot_id]);
    if (!rows.length) return res.status(404).json({ error: 'Lot introuvable' });
    const l = rows[0];

    const qrData = `NAI-MP|${l.article_code}|LOT:${l.numero_lot}|${parseFloat(l.qte_initiale).toFixed(1)}kg|${l.fournisseur_nom||'?'}`;
    let qrUrl = '';
    try {
      const QRCode = require('qrcode');
      qrUrl = await QRCode.toDataURL(qrData, { width:100, margin:1, color:{dark:'#0369a1',light:'#fff'} });
    } catch {}

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}
@page{size:A5;margin:10mm}body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937}
.header{border-bottom:3px solid #0369a1;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between}
.company{font-size:14pt;font-weight:900;color:#0369a1}
.banner{background:#0369a1;color:#fff;text-align:center;padding:6px;border-radius:4px;margin-bottom:10px;font-size:10pt;font-weight:700;text-transform:uppercase}
.num{font-size:16pt;font-weight:900;color:#0369a1;text-align:center;margin:5px 0}
.sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:8px}
.sec-h{background:#f3f4f6;padding:3px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb}
.sec-b{padding:6px 8px}.row{display:flex;justify-content:space-between;margin-bottom:3px}
.lbl{color:#6b7280;font-size:7.5pt}.val{font-weight:700;font-size:8pt}
.qte{font-size:22pt;font-weight:900;color:#0369a1;text-align:center;margin:6px 0 2px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.sig-box{border:1px solid #d1d5db;border-radius:4px;padding:8px;min-height:45px}
.footer{border-top:1px solid #e5e7eb;padding-top:4px;text-align:center;font-size:6pt;color:#9ca3af;margin-top:6px}
</style></head><body onload="window.print()">
<div class="header">
  <div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280">Magasin Matières Premières</div></div>
  <div style="text-align:right;font-size:7pt;color:#6b7280">Date : ${l.date_reception?new Date(l.date_reception).toLocaleDateString('fr-FR'):new Date().toLocaleDateString('fr-FR')}</div>
</div>
<div class="banner">📥 Fiche de Réception Fournisseur</div>
<div class="num">${l.numero_lot}</div>
<div class="sec"><div class="sec-h">Matière reçue</div><div class="sec-b">
  <div class="row"><span class="lbl">Code article</span><span class="val">${l.article_code||'—'}</span></div>
  <div class="row"><span class="lbl">Désignation</span><span class="val">${l.article_nom||'—'}</span></div>
  <div class="row"><span class="lbl">Famille</span><span class="val">${l.famille_libelle||'—'}</span></div>
  <div class="row"><span class="lbl">Fournisseur</span><span class="val">${l.fournisseur_nom||'—'}</span></div>
</div></div>
<div class="sec"><div class="sec-h">Détails réception</div><div class="sec-b">
  <div class="row"><span class="lbl">N° Lot</span><span class="val">${l.numero_lot}</span></div>
  <div class="row"><span class="lbl">Date réception</span><span class="val">${l.date_reception?new Date(l.date_reception).toLocaleDateString('fr-FR'):'—'}</span></div>
  <div class="row"><span class="lbl">DLUO</span><span class="val">${l.date_dluo?new Date(l.date_dluo).toLocaleDateString('fr-FR'):'—'}</span></div>
  <div class="row"><span class="lbl">Prix unitaire</span><span class="val">${l.prix_unitaire?parseFloat(l.prix_unitaire).toLocaleString('fr-FR')+' FCFA/kg':'—'}</span></div>
</div></div>
<div class="qte">${parseFloat(l.qte_initiale||0).toFixed(1)} kg</div>
<div style="text-align:center;font-size:7pt;color:#6b7280;margin-bottom:8px">QUANTITÉ REÇUE</div>
<div style="text-align:center;margin:6px 0">${qrUrl?`<img src="${qrUrl}" width="90" height="90" alt="QR"/><div style="font-size:6pt;color:#9ca3af;margin-top:2px">${l.article_code} · ${l.numero_lot}</div>`:''}</div>
<div class="sigs">
  <div class="sig-box"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">Réceptionnaire</div><div style="font-size:7pt;color:#6b7280;margin-bottom:18px">—</div><div style="border-top:1px solid #9ca3af;padding-top:3px;font-size:6pt;color:#9ca3af;text-align:center">Signature</div></div>
  <div class="sig-box"><div style="font-size:7pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">Resp. Magasin MP</div><div style="font-size:7pt;color:#6b7280;margin-bottom:18px">—</div><div style="border-top:1px solid #9ca3af;padding-top:3px;font-size:6pt;color:#9ca3af;text-align:center">Signature</div></div>
</div>
<div class="footer">Généré le ${new Date().toLocaleString('fr-FR')} · NAIdo — SOPHOPSY pour NAI</div>
<script>window.onload=()=>setTimeout(()=>window.print(),800);</script>
</body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.send(html);
  } catch(e) { err(res, e, 'Erreur fiche réception'); }
});
router.get('/:id', auth, async (req, res) => {
  try {
    const [dbmRes, lignesRes] = await Promise.all([
      db.query('SELECT * FROM vue_dbm WHERE id=$1', [req.params.id]),
      db.query(`
        SELECT dl.*, a.code, a.designation, f.libelle AS famille_libelle
        FROM dbm_lignes dl
        LEFT JOIN articles a ON a.id = dl.article_id
        LEFT JOIN familles_articles f ON f.id = dl.famille_id
        WHERE dl.dbm_id=$1
        ORDER BY f.libelle, a.code
      `, [req.params.id])
    ]);
    if (!dbmRes.rows.length) return res.status(404).json({ error: 'DBM introuvable' });
    ok(res, { ...dbmRes.rows[0], lignes: lignesRes.rows });
  } catch(e) { err(res, e, 'Erreur détail DBM'); }
});
module.exports = router;
