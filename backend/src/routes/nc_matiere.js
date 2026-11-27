'use strict';
// NAIdo - Non-conformites matieres (reception) : circuit declaration -> QHSE -> (direction) -> magasin -> cloture.
//   POST /api/nc-matiere                 declaration (magasin, reception fournisseur)
//   GET  /api/nc-matiere                 liste
//   GET  /api/nc-matiere/:id/pdf         fiche de non-conformite (PDF)
//   PUT  /api/nc-matiere/:id/qhse        QHSE : valider (vers magasin ou direction) / refuser
//   PUT  /api/nc-matiere/:id/direction   direction : valider / refuser
//   PUT  /api/nc-matiere/:id/retour      magasin : retour fournisseur effectue
//   PUT  /api/nc-matiere/:id/clore       QHSE : cloture
//   PUT  /api/nc-matiere/:id/vu          atelier / achat : prise de connaissance
// La declaration cote atelier se fait dans la reception d'une DBM (dbm_livraisons.js).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { pdfCommercial } = require('../utils/pdfBonAchat');
const { assurerTable, creerNc, nomUtilisateur } = require('../utils/ncMatiere');

const EPS = 0.0005;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v, d = 1) => num(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dateFr = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const userError = (msg, http = 400) => { const e = new Error(msg); e.userMessage = msg; e.http = http; return e; };
const role = (req) => String(req.user?.role || '').toLowerCase();

const R_QHSE = ['qhse', 'responsable_qhse', 'qualite', 'super_admin'];
const R_DIRECTION = ['directeur', 'super_admin'];
const R_MAGASIN = ['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'super_admin'];
const R_ATELIER = ['chef_atelier', 'super_admin'];
const R_ACHAT = ['achat', 'super_admin'];
const R_LECTURE = [...new Set([...R_QHSE, ...R_DIRECTION, ...R_MAGASIN, ...R_ATELIER, ...R_ACHAT])];
const exiger = (roles, texte) => (req, res, next) => roles.includes(role(req)) ? next() : res.status(403).json({ error: texte });

const fail = (res, e, msg) => {
  if (!e.userMessage) console.error('[NC-MATIERE]', msg, e.message);
  res.status(e.http || 500).json({ error: e.userMessage || (msg + ' : ' + e.message) });
};

assurerTable().catch(e => console.error('[NC-MATIERE] table :', e.message));

// ---- Mouvements de stock lies a la NC ----
// Fournisseur : a la declaration la matiere est sortie du stock disponible (quarantaine) ; au refus elle y revient
async function bloquerStockMagasin(client, nc) {
  const q = num(nc.qte_nc);
  const r = await client.query(`UPDATE lots_stock SET qte_disponible = qte_disponible - $1 WHERE article_id::text = $2 AND numero_lot = $3 AND qte_disponible >= $1`,
    [q, nc.article_id, nc.numero_lot]);
  if (!r.rowCount) throw userError(`Stock insuffisant sur le lot ${nc.numero_lot} pour ${fmt(q, 3)} kg`);
  let reste = q;
  const empl = await client.query(`SELECT id, qte_disponible FROM stock_articles WHERE article_id::text = $1 AND qte_disponible > 0 ORDER BY qte_disponible DESC, id FOR UPDATE`, [nc.article_id]);
  for (const e of empl.rows) {
    if (reste <= EPS) break;
    const prise = Math.min(reste, num(e.qte_disponible));
    await client.query(`UPDATE stock_articles SET qte_disponible = qte_disponible - $1 WHERE id = $2`, [prise, e.id]);
    reste -= prise;
  }
}
async function restituerStock(client, nc) {
  if (nc.stock_restitue) return;
  const q = num(nc.qte_nc);
  if (nc.origine === 'dbm') {
    // la matiere etait restee a l'atelier : elle devient utilisable (stock AT3) et la DBM est recomptee
    const st = await client.query(`SELECT id FROM stock_at3 WHERE article_id::text = $1 AND COALESCE(numero_lot,'') = $2 LIMIT 1`, [nc.article_id, nc.numero_lot || '']);
    if (st.rows.length) await client.query(`UPDATE stock_at3 SET qte_disponible = qte_disponible + $1, updated_at = NOW() WHERE id = $2`, [q, st.rows[0].id]);
    else await client.query(`INSERT INTO stock_at3 (article_id, famille_id, qte_disponible, numero_lot, dbm_id) VALUES ($1,$2,$3,$4,$5)`,
      [nc.article_id, nc.famille_id, q, nc.numero_lot || '', nc.dbm_id]);
    if (nc.ligne_id) await client.query(`UPDATE dbm_lignes SET qte_livree = COALESCE(qte_livree,0) + $1 WHERE id::text = $2`, [q, nc.ligne_id]);
    if (nc.dbm_id) {
      const b = await client.query(`SELECT COALESCE(BOOL_AND(COALESCE(qte_livree,0) >= qte_demandee - $2), false) AS tout_livre,
        COALESCE(SUM(COALESCE(qte_en_transit,0)), 0) AS en_transit FROM dbm_lignes WHERE dbm_id::text = $1`, [nc.dbm_id, EPS]);
      const { tout_livre, en_transit } = b.rows[0];
      const statut = num(en_transit) > EPS ? 'en_preparation' : (tout_livre ? 'livre' : 'partiel');
      await client.query(`UPDATE dbm SET statut = $1 WHERE id::text = $2 AND statut NOT IN ('annule')`, [statut, nc.dbm_id]);
    }
  } else {
    await client.query(`UPDATE lots_stock SET qte_disponible = qte_disponible + $1 WHERE article_id::text = $2 AND numero_lot = $3`, [q, nc.article_id, nc.numero_lot]);
    await client.query(`UPDATE stock_articles SET qte_disponible = qte_disponible + $1
      WHERE id = (SELECT id FROM stock_articles WHERE article_id::text = $2 ORDER BY qte_disponible DESC, id LIMIT 1)`, [q, nc.article_id]);
  }
  await client.query(`UPDATE nc_matiere SET stock_restitue = true WHERE id = $1`, [nc.id]);
}

async function transaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
async function charger(client, id, statuts) {
  const { rows } = await client.query(`SELECT * FROM nc_matiere WHERE id::text = $1 FOR UPDATE`, [String(id)]);
  if (!rows.length) throw userError('Non-conformité introuvable', 404);
  const nc = rows[0];
  if (statuts && !statuts.includes(nc.statut)) throw userError(`Action impossible : la non-conformité est « ${LIBELLE[nc.statut] || nc.statut} »`);
  return nc;
}

const LIBELLE = {
  declaree: 'En attente du QHSE', attente_direction: 'En attente de la direction', a_traiter_magasin: 'À retourner au fournisseur (magasin)',
  retour_effectue: 'Retour effectué : à clôturer', close: 'Clôturée', annulee: 'Annulée',
};

// ---- Declaration (reception fournisseur, par le magasin) ----
router.post('/', auth, exiger(R_MAGASIN, 'Seul le magasin déclare une non-conformité à la réception fournisseur'), async (req, res) => {
  try {
    const b = req.body || {};
    const qte = num(b.qte_nc);
    if (!b.article_id) throw userError('Choisissez la matière');
    if (!b.numero_lot) throw userError('Choisissez le lot');
    if (!(qte > 0)) throw userError('Indiquez la quantité non conforme');
    if (!String(b.motif || '').trim()) throw userError('Le motif est obligatoire');
    const nc = await transaction(async (client) => {
      const a = await client.query(`SELECT code, designation FROM articles WHERE id::text = $1`, [String(b.article_id)]);
      const l = await client.query(`SELECT fournisseur_nom FROM lots_stock WHERE article_id::text = $1 AND numero_lot = $2 LIMIT 1`, [String(b.article_id), b.numero_lot]);
      const created = await creerNc(client, {
        origine: 'fournisseur', article_id: b.article_id, code: a.rows[0]?.code, designation: a.rows[0]?.designation,
        numero_lot: b.numero_lot, qte_nc: qte, motif: b.motif, commande_id: b.commande_id, numero_commande: b.numero_commande,
        fournisseur_nom: b.fournisseur_nom || l.rows[0]?.fournisseur_nom, declarant_id: req.user.id,
      });
      await bloquerStockMagasin(client, created);
      return created;
    });
    res.status(201).json(nc);
  } catch (e) { fail(res, e, 'Erreur déclaration'); }
});

// ---- Liste ----
router.get('/', auth, exiger(R_LECTURE, 'Accès refusé'), async (req, res) => {
  try {
    await assurerTable();
    const { rows } = await db.query(`SELECT * FROM nc_matiere
      WHERE statut NOT IN ('close','annulee') OR COALESCE(close_at, qhse_at, direction_at, created_at) > now() - interval '60 days'
      ORDER BY created_at DESC LIMIT 200`);
    res.json(rows.map(r => ({ ...r, statut_libelle: LIBELLE[r.statut] || r.statut })));
  } catch (e) { fail(res, e, 'Erreur liste'); }
});

// ---- QHSE : valider / refuser ----
router.put('/:id/qhse', auth, exiger(R_QHSE, 'Seul le QHSE valide ou refuse une non-conformité'), async (req, res) => {
  try {
    const { decision, motif, vers_direction } = req.body || {};
    if (!['valider', 'refuser'].includes(decision)) throw userError('Décision invalide');
    if (decision === 'refuser' && !String(motif || '').trim()) throw userError('Le motif du refus est obligatoire');
    const out = await transaction(async (client) => {
      const nc = await charger(client, req.params.id, ['declaree']);
      const nom = await nomUtilisateur(client, req.user.id);
      let statut;
      if (decision === 'refuser') { statut = 'annulee'; await restituerStock(client, nc); }
      else statut = vers_direction ? 'attente_direction' : 'a_traiter_magasin';
      const r = await client.query(`UPDATE nc_matiere SET statut = $2, qhse_decision = $3, qhse_par = $4, qhse_nom = $5, qhse_at = NOW(), qhse_motif = $6
        WHERE id = $1 RETURNING *`, [nc.id, statut, decision === 'refuser' ? 'refusee' : (vers_direction ? 'transmise_direction' : 'validee'), String(req.user.id), nom, String(motif || '').trim() || null]);
      return r.rows[0];
    });
    res.json(out);
  } catch (e) { fail(res, e, 'Erreur décision QHSE'); }
});

// ---- Direction : valider / refuser ----
router.put('/:id/direction', auth, exiger(R_DIRECTION, 'Seule la direction traite cette étape'), async (req, res) => {
  try {
    const { decision, motif } = req.body || {};
    if (!['valider', 'refuser'].includes(decision)) throw userError('Décision invalide');
    if (decision === 'refuser' && !String(motif || '').trim()) throw userError('Le motif du refus est obligatoire');
    const out = await transaction(async (client) => {
      const nc = await charger(client, req.params.id, ['attente_direction']);
      const nom = await nomUtilisateur(client, req.user.id);
      if (decision === 'refuser') await restituerStock(client, nc);
      const r = await client.query(`UPDATE nc_matiere SET statut = $2, direction_decision = $3, direction_par = $4, direction_nom = $5, direction_at = NOW(), direction_motif = $6
        WHERE id = $1 RETURNING *`, [nc.id, decision === 'refuser' ? 'annulee' : 'a_traiter_magasin', decision === 'refuser' ? 'refusee' : 'validee', String(req.user.id), nom, String(motif || '').trim() || null]);
      return r.rows[0];
    });
    res.json(out);
  } catch (e) { fail(res, e, 'Erreur décision direction'); }
});

// ---- Magasin : retour fournisseur effectue ----
router.put('/:id/retour', auth, exiger(R_MAGASIN, 'Seul le magasin enregistre le retour'), async (req, res) => {
  try {
    const out = await transaction(async (client) => {
      const nc = await charger(client, req.params.id, ['a_traiter_magasin']);
      const nom = await nomUtilisateur(client, req.user.id);
      const r = await client.query(`UPDATE nc_matiere SET statut = 'retour_effectue', magasin_par = $2, magasin_nom = $3, retour_at = NOW(), retour_ref = $4 WHERE id = $1 RETURNING *`,
        [nc.id, String(req.user.id), nom, String(req.body?.commentaire || '').trim() || null]);
      return r.rows[0];
    });
    res.json(out);
  } catch (e) { fail(res, e, 'Erreur retour'); }
});

// ---- QHSE : cloture ----
router.put('/:id/clore', auth, exiger(R_QHSE, 'Seul le QHSE clôture une non-conformité'), async (req, res) => {
  try {
    const out = await transaction(async (client) => {
      const nc = await charger(client, req.params.id, ['retour_effectue']);
      const nom = await nomUtilisateur(client, req.user.id);
      const r = await client.query(`UPDATE nc_matiere SET statut = 'close', close_par = $2, close_nom = $3, close_at = NOW() WHERE id = $1 RETURNING *`, [nc.id, String(req.user.id), nom]);
      return r.rows[0];
    });
    res.json(out);
  } catch (e) { fail(res, e, 'Erreur clôture'); }
});

// ---- Atelier / Achat : prise de connaissance ----
router.put('/:id/vu', auth, exiger([...R_ATELIER, ...R_ACHAT], 'Accès refusé'), async (req, res) => {
  try {
    const col = R_ACHAT.includes(role(req)) && role(req) !== 'super_admin' ? 'vu_achat_at' : (req.body?.cote === 'achat' ? 'vu_achat_at' : 'vu_atelier_at');
    await db.query(`UPDATE nc_matiere SET ${col} = NOW() WHERE id::text = $1 AND ${col} IS NULL`, [String(req.params.id)]);
    res.json({ message: 'Pris en compte' });
  } catch (e) { fail(res, e, 'Erreur'); }
});

// ---- PDF ----
router.get('/:id/pdf', auth, exiger(R_LECTURE, 'Accès refusé'), async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM nc_matiere WHERE id::text = $1`, [String(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Non-conformité introuvable' });
    const n = rows[0];
    const origine = n.origine === 'dbm' ? 'Réception atelier (DBM)' : 'Réception fournisseur';
    const decisionQhse = n.qhse_decision === 'refusee' ? 'Refusée' : n.qhse_decision === 'transmise_direction' ? 'Validée, transmise à la direction' : n.qhse_decision === 'validee' ? 'Validée' : 'En attente';
    const pdf = await pdfCommercial({
      titre: 'NON-CONFORMITÉ MATIÈRE',
      numero: n.numero_nc,
      dateStr: dateFr(n.declare_at),
      statut: LIBELLE[n.statut] || n.statut,
      sousTitre: 'Qualité - Réception matières',
      titreGauche: 'MATIÈRE NON CONFORME', titreDroite: 'RÉFÉRENCES',
      qrUrl: `${n.numero_nc} | ${n.code || ''} | lot ${n.numero_lot || ''} | ${fmt(n.qte_nc, 3)} kg`,
      client: ['Code : ' + (n.code || '—'), 'Désignation : ' + (n.designation || '—'), 'Lot : ' + (n.numero_lot || '—'),
               'Fournisseur : ' + (n.fournisseur_nom || '—')],
      infos: ['Origine : ' + origine, n.numero_dbm ? 'DBM : ' + n.numero_dbm : null, n.numero_livraison ? 'Bon de livraison : ' + n.numero_livraison : null,
              n.numero_of ? 'OF : ' + n.numero_of : null, n.numero_commande ? 'Commande : ' + n.numero_commande : null,
              'Déclarée par : ' + (n.declarant_nom || '—')].filter(Boolean),
      entete: [{ t: 'Code', w: 85, al: 'left' }, { t: 'Désignation', w: 150, al: 'left' }, { t: 'Lot', w: 80, al: 'left' }, { t: 'Qté non conforme (kg)', w: 100, al: 'right' }, { t: 'Décision', w: 105, al: 'left' }],
      lignes: [[n.code || '—', n.designation || '—', n.numero_lot || '—', fmt(n.qte_nc, 3), 'Retour fournisseur']],
      totaux: [['Total non conforme', fmt(n.qte_nc, 3) + ' kg', true]],
      notes: ['Motif : ' + n.motif,
              'QHSE : ' + decisionQhse + (n.qhse_motif ? ' (' + n.qhse_motif + ')' : '') + (n.qhse_nom ? ' - ' + n.qhse_nom + ' le ' + dateFr(n.qhse_at) : ''),
              n.direction_decision ? 'Direction : ' + (n.direction_decision === 'refusee' ? 'Refusée' : 'Validée') + (n.direction_motif ? ' (' + n.direction_motif + ')' : '') + (n.direction_nom ? ' - ' + n.direction_nom + ' le ' + dateFr(n.direction_at) : '') : null,
              n.retour_at ? 'Retour fournisseur effectué le ' + dateFr(n.retour_at) + (n.magasin_nom ? ' par ' + n.magasin_nom : '') + (n.retour_ref ? ' (' + n.retour_ref + ')' : '') : null,
              n.close_at ? 'Clôturée le ' + dateFr(n.close_at) + (n.close_nom ? ' par ' + n.close_nom : '') : null].filter(Boolean).join('\n'),
      signatures: [
        { titre: 'DÉCLARANT', nom: n.declarant_nom || '', image: null },
        { titre: 'QHSE', nom: n.qhse_nom || 'En attente', image: null },
        { titre: 'DIRECTION', nom: n.direction_nom || (n.statut === 'attente_direction' ? 'En attente' : '—'), image: null },
        { titre: 'MAGASIN (retour)', nom: n.magasin_nom || '', image: null },
      ],
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `inline; filename="${n.numero_nc}.pdf"`);
    res.send(pdf);
  } catch (e) { fail(res, e, 'Erreur PDF'); }
});

module.exports = router;
