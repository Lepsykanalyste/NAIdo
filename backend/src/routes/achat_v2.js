// ============================================================
// NAIdo — Achats v2
// Fichier : backend/src/routes/achat_v2.js  (monte sur /api/achat, AVANT achat.js)
//
//   POST /commandes                    creation : statut 'envoye' (en attente de la direction)
//   PUT  /commandes/:id/statut         transitions controlees ; 'confirme' = direction seulement
//   PUT  /commandes/:id/receptionner   receptions partielles cumulees (plafonnees au restant)
//   GET  /commandes/:id/receptions     historique des receptions
//   GET  /commandes/:id/pdf            bon de commande imprimable
//   GET  /receptions/:id/pdf           bordereau de reception imprimable
//   GET  /dashboard                    indicateurs du tableau de bord achat
//   GET  /articles-stock-bas           articles sous leur stock mini
//   GET  /articles-prix-moyen          prix moyen pondere d'achat par article
//   GET/POST /demandes ...             demandes d'achat (atelier -> achats) et transformation en BC
// Tout le reste passe a achat.js (next()).
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');
const { envoyerDepuisCompte } = require('../utils/mailcompte');
const fs = require('fs');
const path = require('path');
const lienSigne = require('../utils/lienSigne');
const { pdfBonAchat } = require('../utils/pdfBonAchat');
const { peutVoirPrix, retirerPrix } = require('../middleware/prix');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EPS  = 0.0005;
const DIRECTION = ['directeur', 'super_admin'];
const STATUTS = ['brouillon', 'envoye', 'confirme', 'receptionne_partiel', 'receptionne', 'annule'];

const num  = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt  = (v, d = 2) => num(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc  = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const userError = (msg, http = 500) => { const e = new Error(msg); e.userMessage = msg; e.http = http; return e; };
const err = (res, e, msg = '') => {
  console.error('[ACHAT-V2]', msg, e?.message || e);
  res.status(e?.http || 500).json({ error: e?.userMessage || msg || e?.message });
};

// ── PDF ───────────────────────────────────────────────────────
const CSS = `*{box-sizing:border-box;margin:0;padding:0}@page{size:A4;margin:12mm}
body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937}
.header{border-bottom:3px solid #6d28d9;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
.company{font-size:16pt;font-weight:900;color:#6d28d9}
.banner{background:#6d28d9;color:#fff;text-align:center;padding:7px;border-radius:4px;margin-bottom:8px;font-size:11pt;font-weight:700;text-transform:uppercase}
.num{font-size:17pt;font-weight:900;color:#6d28d9;text-align:center;margin:4px 0 10px;font-family:monospace}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}
.sec-h{background:#f3f4f6;padding:3px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb}
.sec-b{padding:6px 8px}.row{display:flex;justify-content:space-between;margin-bottom:3px}
.lbl{color:#6b7280;font-size:7.5pt}.val{font-weight:700;font-size:8pt}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#6d28d9;color:#fff;padding:5px 7px;text-align:left;font-size:7.5pt}
td{padding:5px 7px;border-bottom:1px solid #e5e7eb;font-size:8.5pt}
.r{text-align:right}.c{text-align:center}.b{font-weight:700}
.tots{margin-left:auto;width:270px}.tots div{display:flex;justify-content:space-between;padding:2px 0}
.tots .ttc{border-top:2px solid #6d28d9;margin-top:3px;padding-top:4px;font-weight:800;color:#6d28d9;font-size:10.5pt}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.sig{border:1px solid #d1d5db;border-radius:4px;padding:8px;min-height:60px;font-size:8pt}
.foot{border-top:1px solid #e5e7eb;margin-top:16px;padding-top:4px;text-align:center;font-size:6.5pt;color:#9ca3af}`;
const page = (title, body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head>
<body onload="window.print()">${body}<div class="foot">Genere le ${new Date().toLocaleString('fr-FR')} - NAIdo v3 - SOPHOPSY pour NAI</div></body></html>`;
const sendHtml = (res, html) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.send(html); };

// ══════════════════════════════════════════════════════════════
// COMMANDES
// ══════════════════════════════════════════════════════════════

// POST /commandes — le service achat cree : la commande attend la validation de la direction
router.post('/commandes', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const d = req.body || {};
    const lignes = (d.lignes || []).filter(l => num(l.quantite_commandee) > 0);
    if (!d.fournisseur_id) throw userError('Fournisseur obligatoire', 400);
    if (!lignes.length) throw userError('Ajoutez au moins une ligne avec une quantite', 400);

    let totalHT = 0, totalTVA = 0;
    for (const l of lignes) {
      if (num(l.prix_unitaire_ht) < 0) throw userError('Prix unitaire négatif refusé', 400);
      const tauxSaisi = l.taux_tva === undefined || l.taux_tva === '' ? 18 : num(l.taux_tva);
      if (tauxSaisi < 0 || tauxSaisi > 100) throw userError('Taux de TVA hors limites (0 à 100 %)', 400);
      const ht  = num(l.quantite_commandee) * num(l.prix_unitaire_ht);
      const tva = ht * (l.taux_tva === undefined || l.taux_tva === '' ? 18 : num(l.taux_tva)) / 100;
      l._ht = ht; l._tva = tva; totalHT += ht; totalTVA += tva;
    }
    if (!d.of_id && !d.libelle_frais_id) throw userError('Indiquez un OF ou un libellé de frais', 400);
    const statut = 'brouillon';
    const { rows: [cmd] } = await client.query(`
      INSERT INTO commandes_achat (statut,fournisseur_id,date_commande,date_livraison_prevue,montant_ht,taux_tva,montant_tva,montant_ttc,reference_fournisseur,notes,cree_par)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [statut, d.fournisseur_id, d.date_commande || new Date().toISOString().slice(0, 10), d.date_livraison_prevue || null,
       totalHT, d.taux_tva === undefined || d.taux_tva === '' ? 18 : num(d.taux_tva), totalTVA, totalHT + totalTVA,
       d.reference_fournisseur || null, d.notes || null, req.user?.id || null]);
    for (const l of lignes) {
      await client.query(`
        INSERT INTO lignes_achat (commande_id,article_id,designation,quantite_commandee,unite_id,prix_unitaire_ht,taux_tva,montant_ht,montant_ttc)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cmd.id, l.article_id || null, l.designation || '', num(l.quantite_commandee), l.unite_id || null,
         num(l.prix_unitaire_ht), l.taux_tva === undefined || l.taux_tva === '' ? 18 : num(l.taux_tva), l._ht, l._ht + l._tva]);
    }
    await client.query(`UPDATE commandes_achat SET validation='en_attente_direction', of_id=$2, libelle_frais_id=$3 WHERE id=$1`,
      [cmd.id, d.of_id || null, d.libelle_frais_id || null]);
    await client.query('COMMIT');
    res.status(201).json({ ...cmd, validation: 'en_attente_direction' });
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur creation commande'); }
  finally { client.release(); }
});

// PUT /commandes/:id/statut — transitions controlees
router.put('/commandes/:id/statut', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const cible = req.body?.statut;
    if (!STATUTS.includes(cible)) throw userError('Statut inconnu', 400);
    if (['receptionne_partiel', 'receptionne'].includes(cible)) throw userError('Ce statut est automatique : il change a chaque reception', 400);
    const r = await client.query('SELECT * FROM commandes_achat WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!r.rows.length) throw userError('Commande introuvable', 404);
    const cmd = r.rows[0];
    if (cible === 'envoye' && cmd.validation !== 'validee')
      throw userError('Bon de commande non validé : la direction doit le valider avant l\'envoi au fournisseur', 400);
    if (['receptionne', 'annule'].includes(cmd.statut)) throw userError(`Commande deja ${cmd.statut === 'annule' ? 'annulee' : 'entierement receptionnee'}`, 400);

    let sets = 'statut=$1', params = [cible];
    if (cible === 'confirme') {
      if (!DIRECTION.includes(req.user?.role)) throw userError('Seule la direction peut confirmer un bon de commande', 403);
      if (cmd.statut !== 'envoye') throw userError('Seule une commande envoyee peut etre confirmee', 400);
      sets += ', confirme_par=$2, confirme_at=NOW()'; params.push(req.user.id);
    } else if (cible === 'envoye') {
      if (cmd.statut !== 'brouillon') throw userError('Seul un brouillon peut etre envoye', 400);
    } else if (cible === 'annule') {
      if (cmd.statut === 'receptionne_partiel') throw userError('Commande deja partiellement receptionnee : impossible de l\'annuler', 400);
    } else if (cible === 'brouillon') {
      throw userError('Retour en brouillon non autorise', 400);
    }
    params.push(req.params.id);
    const { rows } = await client.query(`UPDATE commandes_achat SET ${sets} WHERE id=$${params.length} RETURNING *`, params);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur changement de statut'); }
  finally { client.release(); }
});

// PUT /commandes/:id/receptionner — receptions partielles cumulees
router.put('/commandes/:id/receptionner', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  if (Array.isArray(req.body?.lignes_recues) && !Array.isArray(req.body?.lignes)) return next();   // ancien format -> achat.js
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { date_reception, reference_bl, notes, lignes } = req.body || {};
    if (!Array.isArray(lignes)) throw userError('Aucune ligne a receptionner', 400);

    const cr = await client.query('SELECT * FROM commandes_achat WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!cr.rows.length) throw userError('Commande introuvable', 404);
    const cmd = cr.rows[0];
    if (!['confirme', 'receptionne_partiel'].includes(cmd.statut))
      throw userError(cmd.statut === 'receptionne' ? 'Commande deja entierement receptionnee' : 'La commande doit d\'abord etre confirmee par la direction', 400);

    const lr = await client.query('SELECT * FROM lignes_achat WHERE commande_id=$1 FOR UPDATE', [cmd.id]);
    const parId = Object.fromEntries(lr.rows.map(l => [l.id, l]));

    const aRecevoir = [], plafonnees = [];
    for (const inp of lignes) {
      const l = parId[inp.ligne_id];
      if (!l) continue;
      const demande = num(inp.quantite_recue);
      if (demande <= 0) continue;
      const restant = Math.max(0, num(l.quantite_commandee) - num(l.quantite_recue));
      const q = Math.min(demande, restant);
      if (q <= EPS) continue;
      if (demande > restant + EPS) plafonnees.push(l.designation);
      const prix = inp.prix_unitaire_ht === undefined || inp.prix_unitaire_ht === '' ? num(l.prix_unitaire_ht) : num(inp.prix_unitaire_ht);
      if (prix < 0) throw userError('Prix unitaire négatif refusé', 400);
      aRecevoir.push({ l, q, prix });
    }
    if (!aRecevoir.length) throw userError('Aucune quantite a receptionner (tout est deja recu, ou quantites nulles)', 400);

    const rec = await client.query(`
      INSERT INTO receptions_achat (commande_id,date_reception,reference_bl,notes,cree_par)
      VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [cmd.id, date_reception || new Date().toISOString().slice(0, 10), reference_bl || null, notes || null, req.user?.id || null]);
    const recId = rec.rows[0].id;

    // Le stock reçu doit aller dans l'emplacement de réception : sans lui, on refuse plutôt que de ranger au hasard
    const empl = await client.query(`SELECT id, type FROM emplacements_stock WHERE actif=true ORDER BY (type='reception') DESC LIMIT 1`);
    if (!empl.rows[0] || empl.rows[0].type !== 'reception')
      throw userError('Aucun emplacement de réception actif : créez-en un (type réception) avant de recevoir', 400);
    const emplId = empl.rows[0].id;
    const sansStock = [];
    let rang = 0;
    const fourn = await client.query('SELECT raison_sociale FROM fournisseurs WHERE id=$1', [cmd.fournisseur_id]);
    const fournisseurNom = fourn.rows[0]?.raison_sociale || null;
    for (const { l, q, prix } of aRecevoir) {
      await client.query(`INSERT INTO lignes_reception_achat (reception_id,ligne_achat_id,quantite_recue,prix_unitaire_ht) VALUES ($1,$2,$3,$4)`, [recId, l.id, q, prix]);
      await client.query(`UPDATE lignes_achat SET quantite_recue = COALESCE(quantite_recue,0) + $1 WHERE id=$2`, [q, l.id]);
      if (l.article_id) {
        // lot de stock : c'est lui que la DBM et le FIFO utilisent (sans lot, le magasin paraît vide)
        rang += 1;
        await client.query(`INSERT INTO lots_stock (article_id, emplacement_id, numero_lot, fournisseur_nom, date_reception, qte_initiale, qte_disponible, prix_unitaire, statut)
          VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$6,$7,'disponible')`,
          [l.article_id, emplId || null, `${cmd.numero_commande}-${recId.slice(0, 8)}-${rang}`, fournisseurNom, date_reception || null, q, prix]);
      }
      if (l.article_id) {
        if (emplId) {
          await client.query(`
            INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
            VALUES ($1,$2,$3::numeric,$3::numeric*$4::numeric,NOW())
            ON CONFLICT (article_id,emplacement_id)
            DO UPDATE SET qte_disponible = stock_articles.qte_disponible + $3::numeric,
                          valeur_stock   = COALESCE(stock_articles.valeur_stock,0) + $3::numeric*$4::numeric,
                          derniere_entree = NOW()`, [l.article_id, emplId, q, prix]);
        } else sansStock.push(l.designation);
      }
    }

    const bilan = await client.query(`SELECT COALESCE(BOOL_AND(COALESCE(quantite_recue,0) >= quantite_commandee - $2), false) AS complet FROM lignes_achat WHERE commande_id=$1`, [cmd.id, EPS]);
    const statut = bilan.rows[0].complet ? 'receptionne' : 'receptionne_partiel';
    await client.query(`UPDATE commandes_achat SET statut=$1, date_reception=$2 WHERE id=$3`, [statut, date_reception || new Date().toISOString().slice(0, 10), cmd.id]);
    await client.query('COMMIT');
    res.json({ message: statut === 'receptionne' ? 'Reception enregistree : commande complete' : 'Reception partielle enregistree',
               statut, reception_id: recId, plafonnees, stock_non_mis_a_jour: sansStock });
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur reception'); }
  finally { client.release(); }
});

// Receptions d'une commande, avec leurs lignes
async function chargerReceptions(commandeId) {
  const { rows: recs } = await db.query(`
    SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.commande_id ORDER BY r.created_at, r.id) AS rang,
           (u.prenom || ' ' || u.nom) AS cree_par_nom
    FROM receptions_achat r LEFT JOIN utilisateurs u ON u.id = r.cree_par
    WHERE r.commande_id = $1 ORDER BY r.created_at, r.id`, [commandeId]);
  if (!recs.length) return [];
  const { rows: lg } = await db.query(`
    SELECT lr.*, la.designation, la.quantite_commandee, a.code AS article_code
    FROM lignes_reception_achat lr
    JOIN lignes_achat la ON la.id = lr.ligne_achat_id
    LEFT JOIN articles a ON a.id = la.article_id
    WHERE lr.reception_id = ANY($1::uuid[]) ORDER BY la.created_at, lr.id`, [recs.map(r => r.id)]);
  return recs.map(r => ({ ...r, lignes: lg.filter(x => x.reception_id === r.id) }));
}

router.get('/commandes/:id/receptions', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  try {
    const c = await db.query('SELECT numero_commande FROM commandes_achat WHERE id=$1', [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: 'Commande introuvable' });
    const recs = await chargerReceptions(req.params.id);
    const liste = recs.map(r => ({ ...r, numero_reception: `${c.rows[0].numero_commande}-R${String(r.rang).padStart(2, '0')}` }));
    res.json(peutVoirPrix(req.user) ? liste : retirerPrix(liste));
  } catch (e) { err(res, e, 'Erreur historique receptions'); }
});

// GET /commandes/:id/pdf — bon de commande
// Signature image d'une personne (importee dans son compte), ou null
async function signatureDe(userId) {
  if (!userId) return null;
  const { rows } = await db.query('SELECT signature_path FROM utilisateurs WHERE id = $1', [userId]);
  const p = rows[0] && rows[0].signature_path;
  if (!p || !p.startsWith('/uploads/signatures/')) return null;
  try { return fs.readFileSync(path.join(__dirname, '../..', p)); } catch (e) { return null; }
}
// Bon de commande en PDF. Le QR code pointe vers un lien signe (lisible sans connexion, valable 30 jours).
const authOuLien = (req, res, next) => {
  if (req.query.t && lienSigne.verifier(req.params.id, req.query.t)) { req.lienSigne = true; return next(); }
  return auth(req, res, next);
};
router.get('/commandes/:id/pdf', authOuLien, async (req, res, next) => {
  if (!req.lienSigne && !peutVoirPrix(req.user)) return res.status(403).json({ error: 'Impression réservée aux rôles autorisés à voir les prix' });
  if (!UUID.test(req.params.id)) return next();
  try {
    const { rows: [cmd] } = await db.query(
      `SELECT ca.*, f.raison_sociale, f.adresse, f.telephone, f.email, f.ville, (u.prenom || ' ' || u.nom) AS cree_par_nom
       FROM commandes_achat ca
       LEFT JOIN fournisseurs f ON f.id = ca.fournisseur_id
       LEFT JOIN utilisateurs u ON u.id = ca.cree_par
       WHERE ca.id = $1`, [req.params.id]);
    if (!cmd) return res.status(404).json({ error: 'Commande introuvable' });
    const { rows: lignes } = await db.query(
      'SELECT l.*, a.code AS article_code, um.code AS unite_code FROM lignes_achat l LEFT JOIN articles a ON a.id = l.article_id LEFT JOIN unites_mesure um ON um.id = l.unite_id WHERE l.commande_id = $1 ORDER BY l.created_at', [cmd.id]);
    const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const urlQr = `${base}/api/achat/commandes/${cmd.id}/pdf?t=${lienSigne.signer(cmd.id)}`;
    const sign = { achat: await signatureDe(cmd.cree_par), direction: await signatureDe(cmd.validee_par) };
    const pdf = await pdfBonAchat(cmd, lignes, urlQr, sign);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cmd.numero_commande}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdf);
  } catch (e) { console.error('[ACHAT-V2] pdf bc', e.message); res.status(500).json({ error: 'Erreur PDF' }); }
});

// GET /receptions/:id/pdf — bordereau de reception
router.get('/receptions/:id/pdf', auth, async (req, res, next) => {
  if (!peutVoirPrix(req.user)) return res.status(403).json({ error: 'Impression réservée aux rôles autorisés à voir les prix' });
  if (!UUID.test(req.params.id)) return next();
  try {
    const r = await db.query(`SELECT commande_id FROM receptions_achat WHERE id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).send('<h1>Reception introuvable</h1>');
    const cmd = (await db.query(`SELECT ca.*, f.raison_sociale FROM commandes_achat ca LEFT JOIN fournisseurs f ON f.id=ca.fournisseur_id WHERE ca.id=$1`, [r.rows[0].commande_id])).rows[0];
    const rec = (await chargerReceptions(cmd.id)).find(x => x.id === req.params.id);
    const numRec = `${cmd.numero_commande}-R${String(rec.rang).padStart(2, '0')}`;
    // deja recu AVANT cette reception, par ligne
    const rowsHtml = (await Promise.all(rec.lignes.map(async lg => {
      const avant = (await db.query(`
        SELECT COALESCE(SUM(lr.quantite_recue),0) AS q FROM lignes_reception_achat lr
        JOIN receptions_achat r ON r.id=lr.reception_id
        WHERE lr.ligne_achat_id=$1 AND (r.created_at, r.id) < ($2::timestamptz, $3::uuid)`, [lg.ligne_achat_id, rec.created_at, rec.id])).rows[0].q;
      const restant = Math.max(0, num(lg.quantite_commandee) - num(avant) - num(lg.quantite_recue));
      return `<tr><td class="b">${esc(lg.article_code || '')}</td><td>${esc(lg.designation)}</td>
        <td class="r">${fmt(lg.quantite_commandee, 3)}</td><td class="r">${fmt(avant, 3)}</td>
        <td class="r b">${fmt(lg.quantite_recue, 3)}</td><td class="r">${fmt(restant, 3)}</td></tr>`;
    }))).join('');
    const body = `
      <div class="header"><div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280">Service Achats - Magasin</div></div>
        <div style="text-align:right;font-size:7.5pt;color:#6b7280">Reception du ${dateFr(rec.date_reception)}</div></div>
      <div class="banner">Bordereau de reception</div>
      <div class="num">${esc(numRec)}</div>
      <div class="grid">
        <div class="sec"><div class="sec-h">Commande</div><div class="sec-b">
          <div class="row"><span class="lbl">Bon de commande</span><span class="val">${esc(cmd.numero_commande)}</span></div>
          <div class="row"><span class="lbl">Fournisseur</span><span class="val">${esc(cmd.raison_sociale || '—')}</span></div></div></div>
        <div class="sec"><div class="sec-h">Livraison</div><div class="sec-b">
          <div class="row"><span class="lbl">Bon de livraison</span><span class="val">${esc(rec.reference_bl || '—')}</span></div>
          <div class="row"><span class="lbl">Recu par</span><span class="val">${esc(rec.cree_par_nom || '—')}</span></div></div></div>
      </div>
      <table><thead><tr><th>Code</th><th>Designation</th><th class="r">Commande</th><th class="r">Deja recu</th><th class="r">Recu ce jour</th><th class="r">Reste</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      ${rec.notes ? `<div class="sec"><div class="sec-h">Notes</div><div class="sec-b">${esc(rec.notes)}</div></div>` : ''}
      <div class="sigs"><div class="sig"><b>SERVICE ACHAT</b><br><br>Signature :</div><div class="sig"><b>MAGASIN</b><br><br>Signature :</div></div>`;
    sendHtml(res, page(`Reception ${numRec}`, body));
  } catch (e) { console.error('[ACHAT-V2] pdf reception', e); res.status(500).send('<h1>Erreur PDF : ' + esc(e.message) + '</h1>'); }
});

// ══════════════════════════════════════════════════════════════
// INDICATEURS
// ══════════════════════════════════════════════════════════════
const SQL_STOCK_BAS = `
  SELECT a.id, a.code, a.designation, a.type_article, a.stock_mini, a.stock_maxi, COALESCE(s.total,0) AS stock_actuel
  FROM articles a
  LEFT JOIN (SELECT article_id, SUM(qte_disponible) AS total FROM stock_articles GROUP BY article_id) s ON s.article_id = a.id
  WHERE a.actif = true AND a.stock_mini > 0 AND COALESCE(s.total,0) < a.stock_mini
  ORDER BY (COALESCE(s.total,0) / a.stock_mini) ASC`;

router.get('/dashboard', auth, async (req, res) => {
  try {
    const [c, f, sb, da] = await Promise.all([
      db.query(`SELECT COUNT(*) FILTER (WHERE statut='envoye')::int AS a_confirmer,
                       COUNT(*) FILTER (WHERE statut IN ('confirme','receptionne_partiel'))::int AS a_receptionner,
                       COALESCE(SUM(montant_ttc) FILTER (WHERE statut IN ('envoye','confirme','receptionne_partiel')),0) AS montant_engage
                FROM commandes_achat`),
      db.query(`SELECT COUNT(*)::int AS n FROM fournisseurs WHERE actif=true`),
      db.query(`SELECT COUNT(*)::int AS n FROM (${SQL_STOCK_BAS}) x`),
      db.query(`SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut='en_attente'`),
    ]);
    const kpi = { commandes_a_confirmer: c.rows[0].a_confirmer, commandes_a_receptionner: c.rows[0].a_receptionner,
               montant_engage: c.rows[0].montant_engage, fournisseurs_actifs: f.rows[0].n,
               articles_sous_stock_mini: sb.rows[0].n, demandes_en_attente: da.rows[0].n };
    res.json(peutVoirPrix(req.user) ? kpi : retirerPrix(kpi));
  } catch (e) { err(res, e, 'Erreur tableau de bord achat'); }
});

router.get('/articles-stock-bas', auth, async (req, res) => {
  try { res.json((await db.query(SQL_STOCK_BAS)).rows); } catch (e) { err(res, e, 'Erreur articles sous stock mini'); }
});

// Prix moyen PONDERE par les quantites recues
router.get('/articles-prix-moyen', auth, async (req, res) => {
  if (!peutVoirPrix(req.user)) return res.status(403).json({ error: 'Prix moyens réservés aux rôles autorisés à voir les prix' });
  try {
    const { rows } = await db.query(`
      SELECT la.article_id,
             SUM(lr.quantite_recue * lr.prix_unitaire_ht) / NULLIF(SUM(lr.quantite_recue),0) AS prix_moyen,
             COUNT(lr.id)::int AS nb_receptions
      FROM lignes_reception_achat lr JOIN lignes_achat la ON la.id = lr.ligne_achat_id
      WHERE la.article_id IS NOT NULL GROUP BY la.article_id`);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur prix moyen'); }
});

// ══════════════════════════════════════════════════════════════
// DEMANDES D'ACHAT (atelier -> achats) et transformation en bon de commande
// ══════════════════════════════════════════════════════════════
router.get('/demandes', auth, async (req, res) => {
  try {
    const { statut } = req.query;
    const p = []; let w = '';
    if (statut) { p.push(statut); w = 'WHERE da.statut = $1'; }
    const { rows } = await db.query(`
      SELECT da.*, (u.prenom || ' ' || u.nom) AS demandeur_nom,
             (SELECT COUNT(*)::int FROM lignes_demande_achat l WHERE l.demande_id = da.id) AS nb_lignes,
             ca.numero_commande
      FROM demandes_achat da
      LEFT JOIN utilisateurs u ON u.id = da.demandeur_id
      LEFT JOIN commandes_achat ca ON ca.id = da.commande_id
      ${w} ORDER BY da.created_at DESC LIMIT 200`, p);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur liste demandes'); }
});

router.get('/demandes/:id', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  try {
    const d = await db.query(`SELECT da.*, (u.prenom || ' ' || u.nom) AS demandeur_nom FROM demandes_achat da LEFT JOIN utilisateurs u ON u.id=da.demandeur_id WHERE da.id=$1`, [req.params.id]);
    if (!d.rows.length) return res.status(404).json({ error: 'Demande introuvable' });
    const l = await db.query(`SELECT l.*, a.code AS article_code, a.prix_achat FROM lignes_demande_achat l LEFT JOIN articles a ON a.id=l.article_id WHERE l.demande_id=$1 ORDER BY l.id`, [req.params.id]);
    const demande = { ...d.rows[0], lignes: l.rows };
    res.json(peutVoirPrix(req.user) ? demande : retirerPrix(demande));
  } catch (e) { err(res, e, 'Erreur detail demande'); }
});

router.post('/demandes', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { lignes, notes, of_id, libelle_frais_id } = req.body || {};
    if (!of_id && !libelle_frais_id) throw userError('Indiquez un OF ou un libellé de frais', 400);
    if (libelle_frais_id) {
      const lf = await client.query('SELECT id FROM libelles_frais WHERE id=$1 AND actif=true', [libelle_frais_id]);
      if (!lf.rows.length) throw userError('Libellé de frais inconnu ou désactivé', 400);
    }
    const ok = (lignes || []).filter(l => num(l.quantite_demandee) > 0 && (l.article_id || (l.designation || '').trim()));
    if (!ok.length) throw userError('Ajoutez au moins un article avec une quantite', 400);
    const n = await client.query(`SELECT 'DA-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('seq_demande_achat_num')::text,5,'0') AS num`);
    const { rows: [da] } = await client.query(
      `INSERT INTO demandes_achat (numero_demande, demandeur_id, statut, notes, of_id, libelle_frais_id) VALUES ($1,$2,'en_attente',$3,$4,$5) RETURNING *`,
      [n.rows[0].num, req.user?.id || null, notes || null, of_id || null, libelle_frais_id || null]);
    for (const l of ok) {
      await client.query(`INSERT INTO lignes_demande_achat (demande_id,article_id,designation,quantite_demandee,notes) VALUES ($1,$2,$3,$4,$5)`,
        [da.id, l.article_id || null, l.designation || '', num(l.quantite_demandee), l.notes || null]);
    }
    await client.query('COMMIT');
    res.status(201).json(da);
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur creation demande'); }
  finally { client.release(); }
});

router.put('/demandes/:id/annuler', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  try {
    const { rows } = await db.query(`UPDATE demandes_achat SET statut='annule' WHERE id=$1 AND statut='en_attente' RETURNING *`, [req.params.id]);
    if (!rows.length) return res.status(400).json({ error: 'Seule une demande en attente peut etre annulee' });
    res.json(rows[0]);
  } catch (e) { err(res, e, 'Erreur annulation demande'); }
});

// Le service achat choisit fournisseur, quantites et prix : la demande devient un bon de commande 'envoye'
router.post('/demandes/:id/transformer', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { fournisseur_id, date_livraison_prevue, taux_tva, lignes } = req.body || {};
    if (!fournisseur_id) throw userError('Fournisseur obligatoire', 400);
    const lg = (lignes || []).filter(l => num(l.quantite_commandee) > 0);
    if (!lg.length) throw userError('Aucune ligne avec une quantite', 400);

    const dr = await client.query('SELECT * FROM demandes_achat WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!dr.rows.length) throw userError('Demande introuvable', 404);
    if (dr.rows[0].statut !== 'en_attente') throw userError('Cette demande a deja ete traitee', 400);

    const tva = taux_tva === undefined || taux_tva === '' ? 18 : num(taux_tva);
    let ht = 0;
    lg.forEach(l => { l._ht = num(l.quantite_commandee) * num(l.prix_unitaire_ht); ht += l._ht; });
    const { rows: [cmd] } = await client.query(`
      INSERT INTO commandes_achat (statut,fournisseur_id,date_commande,date_livraison_prevue,montant_ht,taux_tva,montant_tva,montant_ttc,notes,cree_par)
      VALUES ('brouillon',$1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [fournisseur_id, date_livraison_prevue || null, ht, tva, ht * tva / 100, ht * (1 + tva / 100), `Issu de la demande ${dr.rows[0].numero_demande}`, req.user?.id || null]);
    await client.query(`UPDATE commandes_achat SET validation='en_attente_direction', of_id=$2, libelle_frais_id=$3 WHERE id=$1`,
      [cmd.id, dr.rows[0].of_id || null, dr.rows[0].libelle_frais_id || null]);
    for (const l of lg) {
      await client.query(`
        INSERT INTO lignes_achat (commande_id,article_id,designation,quantite_commandee,prix_unitaire_ht,taux_tva,montant_ht,montant_ttc)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cmd.id, l.article_id || null, l.designation || '', num(l.quantite_commandee), num(l.prix_unitaire_ht), tva, l._ht, l._ht * (1 + tva / 100)]);
    }
    await client.query(`UPDATE demandes_achat SET statut='traite', commande_id=$1, traite_par=$2, traite_at=NOW() WHERE id=$3`, [cmd.id, req.user?.id || null, req.params.id]);
    await client.query('COMMIT');
    // on renvoie le bon tel qu'il est enregistre (avec son statut de validation)
    const { rows: [cmdFinal] } = await db.query('SELECT * FROM commandes_achat WHERE id = $1', [cmd.id]);
    res.status(201).json(cmdFinal);
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur transformation en bon de commande'); }
  finally { client.release(); }
});

// ---------- Lot 3 : validation par la direction et libelles de frais ----------
const EST_DIRECTION = (u) => ['directeur', 'super_admin'].includes(String(u?.role || ''));

// POST /commandes/:id/envoyer : envoi au fournisseur. mode 'mail' = e-mail avec le detail du bon ; mode 'physique' = remis en main propre ou par courrier.
router.post('/commandes/:id/envoyer', auth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  try {
    const mode = req.body?.mode === 'mail' ? 'mail' : 'physique';
    const { rows: [cmd] } = await db.query(
      `SELECT ca.*, f.raison_sociale, f.email AS fournisseur_email
       FROM commandes_achat ca LEFT JOIN fournisseurs f ON f.id = ca.fournisseur_id WHERE ca.id = $1`, [req.params.id]);
    if (!cmd) return res.status(404).json({ error: 'Commande introuvable' });
    if (cmd.validation !== 'validee' || cmd.statut !== 'brouillon')
      return res.status(400).json({ error: 'Seul un bon valide et pas encore envoye peut etre envoye' });
    if (mode === 'mail') {
      const adresse = String(req.body?.email || cmd.fournisseur_email || '').trim();
      if (!adresse) return res.status(400).json({ error: 'Adresse e-mail du fournisseur manquante' });
      const lignes = (await db.query(
        'SELECT l.*, a.code AS article_code, um.code AS unite_code FROM lignes_achat l LEFT JOIN articles a ON a.id = l.article_id LEFT JOIN unites_mesure um ON um.id = l.unite_id WHERE l.commande_id = $1 ORDER BY l.created_at', [cmd.id])).rows;
      const lignesHtml = lignes.map(l => `<tr><td>${esc(l.designation)}</td><td style="text-align:right">${esc(l.quantite_commandee)}</td><td style="text-align:right">${esc(l.prix_unitaire_ht)}</td><td style="text-align:right">${esc(l.montant_ttc)}</td></tr>`).join('');
      const html = `<div style="font-family:Arial,sans-serif"><p>Bonjour ${esc(cmd.raison_sociale || '')},</p>`
        + `<p>Veuillez trouver ci-dessous notre bon de commande <b>${esc(cmd.numero_commande)}</b>.</p>`
        + `<table style="border-collapse:collapse;width:100%" border="1" cellpadding="6"><thead><tr><th>Designation</th><th>Quantite</th><th>P.U. HT</th><th>Montant TTC</th></tr></thead><tbody>${lignesHtml}</tbody></table>`
        + `<p><b>Total HT : ${esc(cmd.montant_ht)} FCFA &mdash; Total TTC : ${esc(cmd.montant_ttc)} FCFA</b></p><p>NAI &mdash; Service achats</p></div>`;
      const baseEnvoi = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const sign = { achat: await signatureDe(cmd.cree_par), direction: await signatureDe(cmd.validee_par) };
      const pdfBon = await pdfBonAchat(cmd, lignes, `${baseEnvoi}/api/achat/commandes/${cmd.id}/pdf?t=${lienSigne.signer(cmd.id)}`, sign);
      await envoyerDepuisCompte(req.user.id, { to: adresse, subject: 'Bon de commande ' + cmd.numero_commande + ' - NAI', html, attachments: [{ filename: cmd.numero_commande + '.pdf', content: pdfBon, contentType: 'application/pdf' }] });
    }
    // Un bon envoye est deja valide par la direction : il passe a « confirme », pret a etre receptionne
    await db.query("UPDATE commandes_achat SET statut = 'confirme' WHERE id = $1 AND statut = 'brouillon'", [cmd.id]);
    res.json({ ok: true, mode });
  } catch (err) { console.error('[ENVOI-BON]', err.message); res.status(500).json({ error: 'Envoi impossible' }); }
});

router.post('/commandes/:id/valider', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Seule la direction valide les bons de commande' });
  try {
    const { rows } = await db.query(
      `UPDATE commandes_achat SET validation='validee', validee_par=$2, validee_at=NOW(), motif_refus=NULL
       WHERE id=$1 AND validation='en_attente_direction' RETURNING *`, [req.params.id, req.user?.id || null]);
    if (!rows.length) return res.status(400).json({ error: 'Ce bon n\'est pas en attente de validation' });
    res.json(rows[0]);
  } catch (e) { err(res, e, 'Erreur validation'); }
});

router.post('/commandes/:id/refuser', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Seule la direction refuse les bons de commande' });
  const motif = String(req.body?.motif || '').trim();
  if (!motif) return res.status(400).json({ error: 'Le motif du refus est obligatoire' });
  try {
    const { rows } = await db.query(
      `UPDATE commandes_achat SET validation='refusee', motif_refus=$2, validee_par=$3, validee_at=NOW()
       WHERE id=$1 AND validation='en_attente_direction' RETURNING *`, [req.params.id, motif, req.user?.id || null]);
    if (!rows.length) return res.status(400).json({ error: 'Ce bon n\'est pas en attente de validation' });
    res.json(rows[0]);
  } catch (e) { err(res, e, 'Erreur refus'); }
});

router.get('/validations-attente', auth, async (req, res) => {
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Réservé à la direction' });
  try {
    const { rows } = await db.query(`SELECT c.id, c.numero_commande, c.montant_ttc, c.created_at, f.raison_sociale AS fournisseur,
        o.numero_of, lf.libelle AS libelle_frais
      FROM commandes_achat c LEFT JOIN fournisseurs f ON f.id=c.fournisseur_id
      LEFT JOIN ordres_fabrication o ON o.id=c.of_id LEFT JOIN libelles_frais lf ON lf.id=c.libelle_frais_id
      WHERE c.validation='en_attente_direction' ORDER BY c.created_at`);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur liste validations'); }
});

router.get('/libelles-frais', auth, async (req, res) => {
  try {
    const tous = EST_DIRECTION(req.user) && req.query.tous === '1';
    const { rows } = await db.query(`SELECT id, libelle, actif FROM libelles_frais ${tous ? '' : 'WHERE actif=true'} ORDER BY lower(libelle)`);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur libelles'); }
});

router.post('/libelles-frais', auth, async (req, res) => {
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Seule la direction gère les libellés de frais' });
  const libelle = String(req.body?.libelle || '').replace(/\s+/g, ' ').trim();
  if (!libelle) return res.status(400).json({ error: 'Le libellé est obligatoire' });
  try {
    const { rows } = await db.query('INSERT INTO libelles_frais (libelle) VALUES ($1) RETURNING id, libelle, actif', [libelle]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: `Le libellé « ${libelle} » existe déjà` });
    err(res, e, 'Erreur creation libelle');
  }
});

router.put('/libelles-frais/:id', auth, async (req, res) => {
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Seule la direction gère les libellés de frais' });
  const libelle = req.body?.libelle !== undefined ? String(req.body.libelle).replace(/\s+/g, ' ').trim() : null;
  if (libelle === '') return res.status(400).json({ error: 'Le libellé ne peut pas être vide' });
  try {
    const { rows } = await db.query(
      'UPDATE libelles_frais SET libelle=COALESCE($2, libelle), actif=COALESCE($3, actif) WHERE id=$1 RETURNING id, libelle, actif',
      [req.params.id, libelle, req.body?.actif === undefined ? null : !!req.body.actif]);
    if (!rows.length) return res.status(404).json({ error: 'Libellé introuvable' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: `Le libellé « ${libelle} » existe déjà` });
    err(res, e, 'Erreur modification libelle');
  }
});

// Supprimer : si le libelle a deja servi, on le desactive (l'historique reste lisible)
router.delete('/libelles-frais/:id', auth, async (req, res) => {
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Seule la direction gère les libellés de frais' });
  try {
    const utilise = await db.query(
      'SELECT (SELECT count(*) FROM demandes_achat WHERE libelle_frais_id=$1) + (SELECT count(*) FROM commandes_achat WHERE libelle_frais_id=$1) AS n', [req.params.id]);
    if (Number(utilise.rows[0].n) > 0) {
      await db.query('UPDATE libelles_frais SET actif=false WHERE id=$1', [req.params.id]);
      return res.json({ success: true, desactive: true, message: 'Utilisé dans des demandes : libellé désactivé, pas supprimé' });
    }
    await db.query('DELETE FROM libelles_frais WHERE id=$1', [req.params.id]);
    res.json({ success: true, desactive: false });
  } catch (e) { err(res, e, 'Erreur suppression libelle'); }
});

// Lot 3 : ordres de fabrication ouverts, pour rattacher une demande d'achat (lecture seule, tout utilisateur de l'achat)
router.get('/ofs-ouverts', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT o.id, o.numero_of, a.code AS article_code, a.designation AS article_designation
      FROM ordres_fabrication o LEFT JOIN articles a ON a.id = o.article_id
      WHERE o.statut NOT IN ('termine','annule') ORDER BY o.numero_of DESC LIMIT 500`);
    res.json(rows);
  } catch (e) { err(res, e, 'Erreur liste OF'); }
});

// ── Historique Sage (lecture seule : rien n'est ecrit, aucun mouvement de stock) ──
router.get('/historique-sage/recherche', auth, async (req, res) => {
  try {
    const motif = `%${String(req.query.q || '').trim()}%`;
    const { rows } = await db.query(`
      SELECT a.id, a.code, a.designation, COALESCE(SUM(sa.qte_disponible), 0) AS stock
      FROM articles a
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.code ILIKE $1 OR a.designation ILIKE $1
      GROUP BY a.id, a.code, a.designation
      ORDER BY a.code LIMIT 40`, [motif]);
    res.json(rows);
  } catch (e) { err(res, e, 'historique recherche'); }
});

router.get('/historique-sage/article/:id', auth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Article invalide' });
  try {
    const prix = peutVoirPrix(req.user);
    const { rows: [art] } = await db.query('SELECT id, code, designation, prix_achat, prix_vente FROM articles WHERE id = $1', [req.params.id]);
    if (!art) return res.status(404).json({ error: 'Article introuvable' });
    const { rows: stock } = await db.query(`
      SELECT e.code, e.libelle, SUM(sa.qte_disponible) AS quantite
      FROM stock_articles sa JOIN emplacements_stock e ON e.id = sa.emplacement_id
      WHERE sa.article_id = $1 GROUP BY e.code, e.libelle ORDER BY e.code`, [art.id]);
    const { rows: mouvements } = await db.query(`
      SELECT date_mouvement, type_document, numero_document, sens, quantite_signee, nom_depot,
             code_tiers, nom_tiers, numero_commande, numero_livraison, regle_clients_appliquee
      FROM mouvements_sage_2026
      WHERE UPPER(reference_article) = UPPER($1)
      ORDER BY date_mouvement DESC, id DESC LIMIT 1000`, [art.code]);
    const { rows: commandes } = await db.query(`
      SELECT c.numero_commande, c.reference_fournisseur, c.date_commande, c.statut,
             f.raison_sociale AS fournisseur_nom, l.quantite_commandee, l.quantite_recue,
             l.prix_unitaire_ht, l.montant_ttc
      FROM lignes_achat l
      JOIN commandes_achat c ON c.id = l.commande_id
      LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
      WHERE l.article_id = $1
      ORDER BY c.date_commande DESC LIMIT 300`, [art.id]);
    const { rows: receptions } = await db.query(`
      SELECT r.reference_bl, r.date_reception, c.reference_fournisseur AS commande_ref,
             lr.quantite_recue, lr.prix_unitaire_ht
      FROM lignes_reception_achat lr
      JOIN receptions_achat r ON r.id = lr.reception_id
      JOIN lignes_achat l ON l.id = lr.ligne_achat_id
      JOIN commandes_achat c ON c.id = l.commande_id
      WHERE l.article_id = $1
      ORDER BY r.date_reception DESC LIMIT 300`, [art.id]);
    res.json({
      article: prix ? art : { id: art.id, code: art.code, designation: art.designation },
      stock, mouvements,
      commandes: prix ? commandes : retirerPrix(commandes),
      receptions: prix ? receptions : retirerPrix(receptions),
    });
  } catch (e) { err(res, e, 'historique article'); }
});

module.exports = router;
