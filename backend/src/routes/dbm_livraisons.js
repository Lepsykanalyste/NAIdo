// ============================================================
// NAIdo — DBM : livraisons partielles par bon (L001, L002, ...)
// Fichier : backend/src/routes/dbm_livraisons.js
//
// Ce fichier est monte AVANT dbm.js (voir server.js). Il gere :
//   GET  /api/dbm/livraisons                 liste des bons de livraison
//   GET  /api/dbm/livraisons/:numero         detail d'un bon
//   GET  /api/dbm/livraisons/:numero/pdf     bon de livraison imprimable
//   GET  /api/dbm/:id/pdf                    fiche DBM imprimable
//   GET  /api/dbm/:id                        detail DBM + lignes + livraisons
//   PUT  /api/dbm/:id/livrer                 le magasin livre (1 bon par envoi)
//   PUT  /api/dbm/:id/receptionner           l'atelier AT3 receptionne
// Tout ce qui n'est pas gere ici passe a dbm.js (next()).
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EPS  = 0.0005;

const ok  = (res, data) => res.json(data);
const err = (res, e, msg = '') => {
  console.error('[DBM-LIV]', msg, e?.message || e);
  res.status(500).json({ error: e?.userMessage || msg || e?.message });
};
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v, d = 1) => num(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const userError = msg => { const e = new Error(msg); e.userMessage = msg; return e; };
const dateFr = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ── Style commun des PDF ──────────────────────────────────────
const CSS = `*{box-sizing:border-box;margin:0;padding:0}@page{size:A4;margin:12mm}
body{font-family:Arial,sans-serif;font-size:9pt;color:#1f2937}
.header{border-bottom:3px solid #0369a1;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
.company{font-size:16pt;font-weight:900;color:#0369a1}
.banner{background:#0369a1;color:#fff;text-align:center;padding:7px;border-radius:4px;margin-bottom:8px;font-size:11pt;font-weight:700;text-transform:uppercase}
.num{font-size:17pt;font-weight:900;color:#0369a1;text-align:center;margin:4px 0 10px;font-family:monospace}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.sec{border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}
.sec-h{background:#f3f4f6;padding:3px 8px;font-size:7pt;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e5e7eb}
.sec-b{padding:6px 8px}.row{display:flex;justify-content:space-between;margin-bottom:3px}
.lbl{color:#6b7280;font-size:7.5pt}.val{font-weight:700;font-size:8pt}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#0369a1;color:#fff;padding:5px 7px;text-align:left;font-size:7.5pt}
td{padding:5px 7px;border-bottom:1px solid #e5e7eb;font-size:8.5pt}
.r{text-align:right}.c{text-align:center}.b{font-weight:700}
.tot{margin-left:auto;width:260px;border-top:2px solid #0369a1;padding-top:4px;font-weight:800;color:#0369a1;display:flex;justify-content:space-between}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.sig{border:1px solid #d1d5db;border-radius:4px;padding:8px;min-height:55px;font-size:8pt}
.foot{border-top:1px solid #e5e7eb;margin-top:16px;padding-top:4px;text-align:center;font-size:6.5pt;color:#9ca3af}`;

const page = (title, body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head>
<body onload="window.print()">${body}
<div class="foot">Genere le ${new Date().toLocaleString('fr-FR')} - NAIdo v3 - SOPHOPSY pour NAI</div></body></html>`;

const sendHtml = (res, html) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
};

// ══════════════════════════════════════════════════════════════
// BONS DE LIVRAISON  (doivent etre declares AVANT /:id)
// ══════════════════════════════════════════════════════════════

// GET /api/dbm/livraisons — un bon par numero_livraison
router.get('/livraisons', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT dv.numero_livraison, dv.dbm_id, d.numero_dbm, o.numero_of,
             MIN(dv.date_livraison)                       AS date_livraison,
             COUNT(dv.id)::int                            AS nb_lignes,
             COALESCE(SUM(dv.qte_livree), 0)              AS poids_livre,
             COALESCE(SUM(CASE WHEN dv.receptionne THEN COALESCE(dv.qte_recue, dv.qte_livree) ELSE 0 END), 0) AS poids_recu,
             BOOL_AND(COALESCE(dv.receptionne, false))    AS tout_receptionne,
             MAX(u.prenom || ' ' || u.nom)                AS livre_par_nom
      FROM dbm_livraisons dv
      JOIN dbm d ON d.id = dv.dbm_id
      LEFT JOIN ordres_fabrication o ON o.id = d.of_id
      LEFT JOIN utilisateurs u ON u.id = dv.livre_par
      WHERE dv.numero_livraison IS NOT NULL
      GROUP BY dv.numero_livraison, dv.dbm_id, d.numero_dbm, o.numero_of
      ORDER BY MIN(dv.date_livraison) DESC
      LIMIT 300
    `);
    ok(res, rows);
  } catch (e) { err(res, e, 'Erreur liste livraisons'); }
});

// Lignes d'un bon (utilise par le detail et le PDF)
async function chargerBon(numero) {
  const { rows } = await db.query(`
    SELECT dv.*, a.code, a.designation, d.numero_dbm, d.notes_magasin, d.of_id,
           o.numero_of, (u.prenom || ' ' || u.nom) AS livre_par_nom
    FROM dbm_livraisons dv
    JOIN dbm d ON d.id = dv.dbm_id
    LEFT JOIN articles a ON a.id = dv.article_id
    LEFT JOIN ordres_fabrication o ON o.id = d.of_id
    LEFT JOIN utilisateurs u ON u.id = dv.livre_par
    WHERE dv.numero_livraison = $1
    ORDER BY a.code, dv.date_livraison, dv.id
  `, [numero]);
  return rows;
}

// GET /api/dbm/livraisons/:numero — detail d'un bon
router.get('/livraisons/:numero', auth, async (req, res) => {
  try {
    const lignes = await chargerBon(req.params.numero);
    if (!lignes.length) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    ok(res, { numero_livraison: req.params.numero, numero_dbm: lignes[0].numero_dbm, numero_of: lignes[0].numero_of, lignes });
  } catch (e) { err(res, e, 'Erreur detail livraison'); }
});

// GET /api/dbm/livraisons/:numero/pdf — bon imprimable (ouvert via window.open, sans en-tete auth)
router.get('/livraisons/:numero/pdf', auth, async (req, res) => {
  try {
    const lignes = await chargerBon(req.params.numero);
    if (!lignes.length) return res.status(404).send('<h1>Bon de livraison introuvable</h1>');
    const h = lignes[0];
    const totLivre = lignes.reduce((s, l) => s + num(l.qte_livree), 0);
    const totRecu  = lignes.reduce((s, l) => s + (l.receptionne ? num(l.qte_recue ?? l.qte_livree) : 0), 0);
    const rowsHtml = lignes.map(l => {
      const recu = l.receptionne ? num(l.qte_recue ?? l.qte_livree) : null;
      const ecart = l.receptionne && Math.abs(recu - num(l.qte_livree)) > EPS;
      return `<tr>
        <td class="b">${esc(l.code)}</td><td>${esc(l.designation)}</td>
        <td>${esc(l.numero_lot || '—')}</td>
        <td class="r">${fmt(l.qte_livree, 3)}</td>
        <td class="r">${recu === null ? '—' : fmt(recu, 3)}</td>
        <td class="c">${l.receptionne ? (ecart ? 'Recu (ecart)' : 'Recu') : 'En transit'}</td>
      </tr>${ecart && l.observation_reception ? `<tr><td colspan="6" style="font-size:7.5pt;color:#92400e">Observation : ${esc(l.observation_reception)}</td></tr>` : ''}`;
    }).join('');
    const body = `
      <div class="header"><div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280">Magasin MP - Atelier 3</div></div>
        <div style="text-align:right;font-size:7.5pt;color:#6b7280">Date : ${dateFr(h.date_livraison)}</div></div>
      <div class="banner">Bon de livraison matieres premieres</div>
      <div class="num">${esc(req.params.numero)}</div>
      <div class="grid">
        <div class="sec"><div class="sec-h">Demande</div><div class="sec-b">
          <div class="row"><span class="lbl">DBM</span><span class="val">${esc(h.numero_dbm)}</span></div>
          <div class="row"><span class="lbl">Ordre de fabrication</span><span class="val">${esc(h.numero_of || '—')}</span></div></div></div>
        <div class="sec"><div class="sec-h">Livraison</div><div class="sec-b">
          <div class="row"><span class="lbl">Livre par</span><span class="val">${esc(h.livre_par_nom || '—')}</span></div>
          <div class="row"><span class="lbl">Notes</span><span class="val">${esc(h.notes_magasin || '—')}</span></div></div></div>
      </div>
      <table><thead><tr><th>Code</th><th>Designation</th><th>N° lot</th><th class="r">Livre (kg)</th><th class="r">Recu (kg)</th><th class="c">Statut</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
      <div class="tot"><span>Total livre / recu</span><span>${fmt(totLivre, 3)} / ${fmt(totRecu, 3)} kg</span></div>
      <div class="sigs">
        <div class="sig"><b>MAGASINIER MP</b><br><br>Signature :</div>
        <div class="sig"><b>CHEF ATELIER 3 (reception)</b><br><br>Signature :</div>
      </div>`;
    sendHtml(res, page(`Bon ${req.params.numero}`, body));
  } catch (e) { console.error('[DBM-LIV] pdf bon', e); res.status(500).send('<h1>Erreur PDF : ' + esc(e.message) + '</h1>'); }
});

// ══════════════════════════════════════════════════════════════
// FICHE DBM
// ══════════════════════════════════════════════════════════════

async function chargerDbm(id) {
  const dRes = await db.query(`SELECT * FROM vue_dbm WHERE id = $1`, [id]);
  if (!dRes.rows.length) return null;
  const [lRes, vRes] = await Promise.all([
    db.query(`
      SELECT dl.*, a.code, a.designation, f.libelle AS famille_libelle
      FROM dbm_lignes dl
      LEFT JOIN articles a ON a.id = dl.article_id
      LEFT JOIN familles_articles f ON f.id = dl.famille_id
      WHERE dl.dbm_id = $1
      ORDER BY f.libelle, a.code
    `, [id]),
    db.query(`
      SELECT dv.*, a.code, a.designation
      FROM dbm_livraisons dv
      LEFT JOIN articles a ON a.id = dv.article_id
      WHERE dv.dbm_id = $1
      ORDER BY dv.date_livraison, dv.numero_livraison, a.code, dv.id
    `, [id]),
  ]);
  // Reste a livrer = demande - deja recu - en transit (jamais negatif)
  const lignes = lRes.rows.map(l => ({
    ...l,
    qte_restante: Math.max(0, num(l.qte_demandee) - num(l.qte_livree) - num(l.qte_en_transit)),
  }));
  return { ...dRes.rows[0], lignes, livraisons: vRes.rows };
}

// GET /api/dbm/:id/pdf — fiche DBM imprimable
router.get('/:id/pdf', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  try {
    const d = await chargerDbm(req.params.id);
    if (!d) return res.status(404).send('<h1>DBM introuvable</h1>');
    const rowsHtml = d.lignes.map(l => `<tr>
      <td class="b">${esc(l.code)}</td><td>${esc(l.designation)}</td>
      <td class="r">${fmt(l.qte_demandee, 3)}</td><td class="r">${fmt(l.qte_livree, 3)}</td>
      <td class="r">${fmt(l.qte_en_transit, 3)}</td><td class="r b">${fmt(l.qte_restante, 3)}</td></tr>`).join('');
    const body = `
      <div class="header"><div><div class="company">NAI</div><div style="font-size:7pt;color:#6b7280">Atelier 3 - Demande de besoin en matieres</div></div>
        <div style="text-align:right;font-size:7.5pt;color:#6b7280">Date : ${dateFr(d.date_demande || d.created_at)}</div></div>
      <div class="banner">Demande de besoin en matieres (DBM)</div>
      <div class="num">${esc(d.numero_dbm)}</div>
      <div class="grid">
        <div class="sec"><div class="sec-h">Demande</div><div class="sec-b">
          <div class="row"><span class="lbl">OF</span><span class="val">${esc(d.numero_of || '—')}</span></div>
          <div class="row"><span class="lbl">Statut</span><span class="val">${esc(d.statut)}</span></div>
          <div class="row"><span class="lbl">Urgence</span><span class="val">${d.urgence ? 'OUI' : 'non'}</span></div></div></div>
        <div class="sec"><div class="sec-h">Notes</div><div class="sec-b">
          <div class="row"><span class="lbl">Demandeur</span><span class="val">${esc(d.notes_demandeur || '—')}</span></div>
          <div class="row"><span class="lbl">Magasin</span><span class="val">${esc(d.notes_magasin || '—')}</span></div></div></div>
      </div>
      <table><thead><tr><th>Code</th><th>Designation</th><th class="r">Demande (kg)</th><th class="r">Recu (kg)</th><th class="r">En transit (kg)</th><th class="r">Reste (kg)</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
      <div class="sigs"><div class="sig"><b>CHEF ATELIER 3</b><br><br>Signature :</div><div class="sig"><b>MAGASINIER MP</b><br><br>Signature :</div></div>`;
    sendHtml(res, page(`DBM ${d.numero_dbm}`, body));
  } catch (e) { console.error('[DBM-LIV] pdf dbm', e); res.status(500).send('<h1>Erreur PDF : ' + esc(e.message) + '</h1>'); }
});

// GET /api/dbm/:id — detail DBM (lignes + livraisons)
router.get('/:id', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  try {
    const d = await chargerDbm(req.params.id);
    if (!d) return res.status(404).json({ error: 'DBM introuvable' });
    ok(res, d);
  } catch (e) { err(res, e, 'Erreur detail DBM'); }
});

// ══════════════════════════════════════════════════════════════
// LIVRER — le magasin envoie (un bon par envoi, plusieurs lots possibles)
// ══════════════════════════════════════════════════════════════
router.put('/:id/livrer', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { livraisons, notes_magasin } = req.body || {};
    if (!Array.isArray(livraisons)) throw userError('Aucune livraison fournie');
    const mag_id = req.user?.id;

    const dbmRes = await client.query('SELECT * FROM dbm WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!dbmRes.rows.length) throw userError('DBM introuvable');
    const dbm = dbmRes.rows[0];
    if (['livre', 'annule'].includes(dbm.statut)) throw userError(`Cette DBM est deja ${dbm.statut}`);

    const items = livraisons.map(l => ({ ligne_id: l.ligne_id, lot: String(l.numero_lot || '').trim(), qte: num(l.qte_livree) }))
                            .filter(l => l.qte > 0 && l.ligne_id);
    if (!items.length) throw userError('Aucune quantite a livrer');

    // Verifier le reste a livrer de chaque ligne
    const parLigne = {};
    items.forEach(l => { parLigne[l.ligne_id] = (parLigne[l.ligne_id] || 0) + l.qte; });
    const lignes = {};
    for (const ligneId of Object.keys(parLigne)) {
      const r = await client.query(`
        SELECT dl.*, a.code FROM dbm_lignes dl LEFT JOIN articles a ON a.id = dl.article_id
        WHERE dl.id = $1 AND dl.dbm_id = $2 FOR UPDATE OF dl`, [ligneId, dbm.id]);
      if (!r.rows.length) throw userError('Ligne de DBM introuvable');
      const l = r.rows[0];
      const reste = num(l.qte_demandee) - num(l.qte_livree) - num(l.qte_en_transit);
      if (parLigne[ligneId] > reste + EPS) throw userError(`${l.code} : quantite trop elevee (reste a livrer ${fmt(Math.max(0, reste), 3)} kg)`);
      lignes[ligneId] = l;
    }

    // Numero du bon : DBM-...-L001, L002, ... (compteur par DBM)
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [dbm.id]);
    const cnt = await client.query('SELECT COUNT(DISTINCT numero_livraison)::int AS n FROM dbm_livraisons WHERE dbm_id = $1', [dbm.id]);
    const numeroLivraison = `${dbm.numero_dbm}-L${String(cnt.rows[0].n + 1).padStart(3, '0')}`;

    for (const it of items) {
      const l = lignes[it.ligne_id];
      await client.query(`
        INSERT INTO dbm_livraisons (dbm_id, ligne_id, article_id, numero_lot, qte_livree, livre_par, numero_livraison, receptionne)
        VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
        [dbm.id, it.ligne_id, l.article_id, it.lot, it.qte, mag_id, numeroLivraison]);
      await client.query(`UPDATE dbm_lignes SET qte_en_transit = COALESCE(qte_en_transit,0) + $1, numero_lot = $2 WHERE id = $3`,
        [it.qte, it.lot, it.ligne_id]);
      if (it.lot) {
        await client.query(`UPDATE lots_stock SET qte_disponible = GREATEST(0, qte_disponible - $1) WHERE article_id = $2 AND numero_lot = $3`,
          [it.qte, l.article_id, it.lot]);
      }
      // Stock magasin : la quantite est prise UNE SEULE FOIS, emplacement le plus garni d'abord
      // (et non retiree en entier de chaque emplacement)
      let aPrendre = it.qte;
      const empl = await client.query(`SELECT id, qte_disponible FROM stock_articles WHERE article_id = $1 AND qte_disponible > 0 ORDER BY qte_disponible DESC, id FOR UPDATE`, [l.article_id]);
      for (const e of empl.rows) {
        if (aPrendre <= EPS) break;
        const prise = Math.min(aPrendre, num(e.qte_disponible));
        await client.query(`UPDATE stock_articles SET qte_disponible = qte_disponible - $1 WHERE id = $2`, [prise, e.id]);
        aPrendre -= prise;
      }
    }

    await client.query(`UPDATE dbm SET statut='en_preparation', livre_par=$1, date_livraison=NOW(), notes_magasin=$2 WHERE id=$3`,
      [mag_id, notes_magasin || '', dbm.id]);
    await client.query('COMMIT');
    ok(res, { message: `Bon ${numeroLivraison} envoye - en attente de reception par l'Atelier 3`, numero_livraison: numeroLivraison });
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur livraison DBM'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// RECEPTIONNER — l'atelier AT3 valide ce qu'il a reellement recu
// ══════════════════════════════════════════════════════════════
router.put('/:id/receptionner', auth, async (req, res, next) => {
  if (!UUID.test(req.params.id)) return next();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { receptions } = req.body || {};
    if (!Array.isArray(receptions)) throw userError('Aucune reception fournie');
    const chef_id = req.user?.id;

    const dbmRes = await client.query('SELECT * FROM dbm WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!dbmRes.rows.length) throw userError('DBM introuvable');
    const dbm = dbmRes.rows[0];
    let nbTraitees = 0;

    for (const r of receptions) {
      const q = parseFloat(r.qte_recue);
      if (!Number.isFinite(q) || q < 0 || !r.ligne_id) continue;
      const lot = String(r.numero_lot || '').trim();

      const ligneRes = await client.query('SELECT * FROM dbm_lignes WHERE id = $1 AND dbm_id = $2 FOR UPDATE', [r.ligne_id, dbm.id]);
      if (!ligneRes.rows.length) continue;
      const ligne = ligneRes.rows[0];

      // Livraison en attente correspondante (meme ligne, meme lot)
      const livRes = await client.query(`
        SELECT id, qte_livree FROM dbm_livraisons
        WHERE dbm_id = $1 AND ligne_id = $2 AND COALESCE(numero_lot,'') = $3 AND COALESCE(receptionne,false) = false
        ORDER BY date_livraison, id LIMIT 1 FOR UPDATE`, [dbm.id, r.ligne_id, lot]);
      const liv = livRes.rows[0];
      const envoye = liv ? num(liv.qte_livree) : num(r.qte_en_transit);
      if (!liv && envoye <= 0 && q <= 0) continue;
      if (q > envoye + EPS) throw userError(`Quantite recue superieure a la quantite livree (${fmt(envoye, 3)} kg)`);

      if (liv) {
        await client.query(`UPDATE dbm_livraisons SET receptionne = true, qte_recue = $1, observation_reception = $2, date_reception = NOW() WHERE id = $3`,
          [q, String(r.observation || '').trim() || null, liv.id]);
      }
      await client.query(`UPDATE dbm_lignes SET qte_livree = COALESCE(qte_livree,0) + $1, qte_en_transit = GREATEST(0, COALESCE(qte_en_transit,0) - $2) WHERE id = $3`,
        [q, envoye, r.ligne_id]);

      if (q > 0) {
        // Stock AT3 par lot
        const st = await client.query(`SELECT id FROM stock_at3 WHERE article_id = $1 AND COALESCE(numero_lot,'') = $2 LIMIT 1`, [ligne.article_id, lot]);
        if (st.rows.length) {
          await client.query(`UPDATE stock_at3 SET qte_disponible = qte_disponible + $1, updated_at = NOW() WHERE id = $2`, [q, st.rows[0].id]);
        } else {
          await client.query(`INSERT INTO stock_at3 (article_id, famille_id, qte_disponible, numero_lot, dbm_id) VALUES ($1,$2,$3,$4,$5)`,
            [ligne.article_id, ligne.famille_id || r.famille_id || null, q, lot, dbm.id]);
        }
        // Journal des mouvements (ne doit jamais bloquer la reception)
        await client.query('SAVEPOINT mvt');
        try {
          const seq = await client.query(`SELECT to_regclass('seq_mvt_stock_at3_num') AS s`);
          const numMvt = seq.rows[0].s
            ? (await client.query(`SELECT 'MSAT3-'||TO_CHAR(NOW(),'YYYYMMDD')||'-'||LPAD(nextval('seq_mvt_stock_at3_num')::text,4,'0') AS num`)).rows[0].num
            : `MSAT3-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
          await client.query(`INSERT INTO mouvements_stock_at3 (numero_mvt,type_mvt,article_id,quantite,dbm_id,of_id,operateur_id,notes) VALUES ($1,'entree_dbm',$2,$3,$4,$5,$6,$7)`,
            [numMvt, ligne.article_id, q, dbm.id, dbm.of_id, chef_id, `Reception DBM ${dbm.numero_dbm}${lot ? ' lot ' + lot : ''}${r.observation ? ' - ' + r.observation : ''}`]);
          await client.query('RELEASE SAVEPOINT mvt');
        } catch (e) {
          console.error('[DBM-LIV] journal mouvement ignore :', e.message);
          await client.query('ROLLBACK TO SAVEPOINT mvt');
        }
      }
      nbTraitees++;
    }
    if (!nbTraitees) throw userError('Aucune ligne a receptionner');

    // Statut : tant qu'il reste de la marchandise en transit -> en_preparation
    const bilan = await client.query(`
      SELECT COALESCE(BOOL_AND(COALESCE(qte_livree,0) >= qte_demandee - $2), false) AS tout_livre,
             COALESCE(SUM(COALESCE(qte_en_transit,0)), 0) AS en_transit
      FROM dbm_lignes WHERE dbm_id = $1`, [dbm.id, EPS]);
    const { tout_livre, en_transit } = bilan.rows[0];
    const statut = num(en_transit) > EPS ? 'en_preparation' : (tout_livre ? 'livre' : 'partiel');
    await client.query('UPDATE dbm SET statut = $1 WHERE id = $2', [statut, dbm.id]);

    await client.query('COMMIT');
    ok(res, { message: statut === 'livre' ? 'Reception validee - DBM complete' : 'Reception validee', statut });
  } catch (e) { await client.query('ROLLBACK'); err(res, e, 'Erreur reception DBM'); }
  finally { client.release(); }
});

module.exports = router;
