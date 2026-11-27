'use strict';
// NAIdo - Arrivages import (conteneurs) : etat des arrivages, zone de quarantaine, transfert vers le magasin MP.
//   GET  /api/arrivages-import              etat des arrivages + lots en quarantaine + derniers transferts
//   POST /api/arrivages-import/transferer   transfert quarantaine -> magasin MP : { transferts: [{ lot_id, qte? }] } (qte absente = tout le lot)
// Lecture : magasin, achats, direction. Transfert : magasin MP et achats (le super_admin aussi).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { assurerStructure } = require('../utils/arrivagesImport');
const { nomUtilisateur } = require('../utils/ncMatiere');

const EPS = 0.0005;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v, d = 1) => num(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const userError = (msg, http = 400) => { const e = new Error(msg); e.userMessage = msg; e.http = http; return e; };
const role = (req) => String(req.user?.role || '').toLowerCase();

const R_MAGASIN = ['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp'];
const R_ACHAT = ['achat'];
const R_TRANSFERT = [...R_MAGASIN, ...R_ACHAT, 'super_admin'];
const R_LECTURE = [...R_TRANSFERT, 'directeur'];

const fail = (res, e, msg) => {
  if (!e.userMessage) console.error('[ARRIVAGES-IMPORT]', msg, e.message);
  res.status(e.http || 500).json({ error: e.userMessage || (msg + ' : ' + e.message) });
};

assurerStructure().catch(e => console.error('[ARRIVAGES-IMPORT] structure :', e.message));

const SQL_ARRIVAGES = (avecEtapes) => `
  SELECT ca.id, ca.numero_commande, ca.statut, ca.type_achat, ca.date_commande, ca.date_livraison_prevue, ca.numero_lot_conteneur,
         f.raison_sociale AS fournisseur,
         ${avecEtapes
    ? `(SELECT e.etape FROM evolution_commande_achat e WHERE e.commande_id = ca.id ORDER BY e.created_at DESC LIMIT 1) AS derniere_etape,
         (SELECT MAX(e.created_at) FROM evolution_commande_achat e WHERE e.commande_id = ca.id) AS derniere_etape_at,`
    : `NULL::text AS derniere_etape, NULL::timestamptz AS derniere_etape_at,`}
         COALESCE((SELECT SUM(la.quantite_commandee) FROM lignes_achat la WHERE la.commande_id = ca.id), 0) AS qte_commandee,
         COALESCE((SELECT SUM(la.quantite_recue) FROM lignes_achat la WHERE la.commande_id = ca.id), 0) AS qte_recue,
         COALESCE((SELECT SUM(l.qte_disponible) FROM lots_stock l WHERE l.commande_id = ca.id AND l.statut = 'quarantaine'), 0) AS qte_quarantaine,
         COALESCE((SELECT SUM(t.qte) FROM transferts_quarantaine t WHERE t.commande_id = ca.id), 0) AS qte_transferee,
         (SELECT MAX(t.at) FROM transferts_quarantaine t WHERE t.commande_id = ca.id) AS dernier_transfert,
         (SELECT string_agg(DISTINCT l.numero_conteneur, ', ') FROM lots_stock l WHERE l.commande_id = ca.id AND l.numero_conteneur IS NOT NULL) AS conteneurs
  FROM commandes_achat ca
  LEFT JOIN fournisseurs f ON f.id = ca.fournisseur_id
  WHERE (ca.type_achat = 'export' OR EXISTS (SELECT 1 FROM lots_stock l WHERE l.commande_id = ca.id))
    AND ca.statut NOT IN ('brouillon', 'annule')
  ORDER BY ca.date_livraison_prevue NULLS LAST, ca.created_at DESC`;

router.get('/', auth, async (req, res) => {
  try {
    if (!R_LECTURE.includes(role(req))) return res.status(403).json({ error: 'Acces non autorise' });
    await assurerStructure();
    let arr;
    try { arr = await db.query(SQL_ARRIVAGES(true)); }
    catch (e) { arr = await db.query(SQL_ARRIVAGES(false)); }   // table des etapes absente : on affiche sans
    const il_y_a_30j = Date.now() - 30 * 86400000;
    const arrivages = arr.rows.filter(a => a.statut !== 'receptionne' || num(a.qte_quarantaine) > EPS
      || (a.dernier_transfert && new Date(a.dernier_transfert).getTime() > il_y_a_30j)).map(a => {
      const quar = num(a.qte_quarantaine), recu = num(a.qte_recue);
      const phase = quar > EPS ? 'quarantaine' : (recu > EPS ? (a.statut === 'receptionne' ? 'transfere' : 'partiel') : 'en_route');
      return { ...a, phase };
    });
    const q = await db.query(`
      SELECT l.id, l.article_id, a.code, a.designation, l.numero_lot, l.qte_initiale, l.qte_disponible, l.date_reception, l.created_at,
             l.numero_conteneur, l.numero_plomb, l.fournisseur_nom, ca.id AS commande_id, ca.numero_commande,
             GREATEST(0, CURRENT_DATE - COALESCE(l.date_reception, l.created_at::date)) AS jours
      FROM lots_stock l
      LEFT JOIN articles a ON a.id = l.article_id
      LEFT JOIN commandes_achat ca ON ca.id = l.commande_id
      WHERE l.statut = 'quarantaine' AND l.qte_disponible > 0 AND l.commande_id IS NOT NULL
      ORDER BY l.date_reception, l.created_at`);
    const t = await db.query(`SELECT id, code, designation, numero_lot, numero_lot_stock, qte, numero_commande, numero_conteneur, par_nom, at
                              FROM transferts_quarantaine ORDER BY at DESC LIMIT 30`);
    res.json({ arrivages, quarantaine: q.rows, transferts: t.rows, peut_transferer: R_TRANSFERT.includes(role(req)) });
  } catch (e) { fail(res, e, 'Erreur arrivages import'); }
});

router.post('/transferer', auth, async (req, res) => {
  if (!R_TRANSFERT.includes(role(req))) return res.status(403).json({ error: 'Seuls le magasin MP et les achats peuvent transferer la quarantaine vers le stock' });
  let liste = Array.isArray(req.body?.transferts) ? req.body.transferts : (req.body?.lot_id ? [req.body] : []);
  liste = liste.filter(x => x && x.lot_id);
  if (!liste.length) return res.status(400).json({ error: 'Aucun lot a transferer' });
  const client = await db.connect();
  try {
    await assurerStructure();
    await client.query('BEGIN');
    const dest = await client.query(`SELECT id FROM emplacements_stock WHERE actif = true AND type = 'reception' ORDER BY id LIMIT 1`);
    if (!dest.rows[0]) throw userError("Aucun emplacement de reception actif : creez-en un (type reception) pour recevoir le stock du magasin MP");
    const destId = dest.rows[0].id;
    const par = await nomUtilisateur(client, req.user?.id);
    let total = 0; const faits = [];
    for (const it of liste) {
      const r = await client.query(`SELECT l.*, a.code, a.designation, ca.numero_commande FROM lots_stock l
        LEFT JOIN articles a ON a.id = l.article_id LEFT JOIN commandes_achat ca ON ca.id = l.commande_id
        WHERE l.id::text = $1 FOR UPDATE OF l`, [String(it.lot_id)]);
      const lot = r.rows[0];
      if (!lot) throw userError('Lot introuvable');
      if (lot.statut !== 'quarantaine' || !lot.commande_id) throw userError(`Le lot ${lot.numero_lot} n'est pas en quarantaine d'arrivage`);
      const dispo = num(lot.qte_disponible);
      const q = it.qte === undefined || it.qte === null || it.qte === '' ? dispo : num(it.qte);
      if (!(q > EPS)) throw userError(`${lot.code || lot.numero_lot} : quantite a transferer invalide`);
      if (q > dispo + EPS) throw userError(`${lot.code || lot.numero_lot} : ${fmt(q, 3)} kg demandes, ${fmt(dispo, 3)} kg seulement en quarantaine`);
      const tout = Math.abs(q - dispo) <= EPS;
      let numeroStock = lot.numero_lot;
      if (tout) {
        await client.query(`UPDATE lots_stock SET statut = 'disponible', emplacement_id = $1 WHERE id = $2`, [destId, lot.id]);
      } else {
        // transfert partiel : le reste demeure en quarantaine, la partie transferee devient un lot du stock (meme date : FIFO respecte)
        let rang = (await client.query(`SELECT COUNT(*)::int AS n FROM transferts_quarantaine WHERE lot_id = $1`, [lot.id])).rows[0].n + 1;
        for (;;) {
          numeroStock = `${lot.numero_lot}-T${String(rang).padStart(2, '0')}`;
          const ex = await client.query(`SELECT 1 FROM lots_stock WHERE article_id = $1 AND numero_lot = $2`, [lot.article_id, numeroStock]);
          if (!ex.rows.length) break;
          rang += 1;
        }
        await client.query(`UPDATE lots_stock SET qte_disponible = qte_disponible - $1 WHERE id = $2`, [q, lot.id]);
        await client.query(`INSERT INTO lots_stock (article_id, emplacement_id, numero_lot, fournisseur_id, fournisseur_nom, date_reception, qte_initiale, qte_disponible,
                              prix_unitaire, statut, commande_id, reception_id, numero_conteneur, numero_plomb, emplacement_atelier, created_at)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,'disponible',$9,$10,$11,$12,$13,$14)`,
        [lot.article_id, destId, numeroStock, lot.fournisseur_id, lot.fournisseur_nom, lot.date_reception, q, lot.prix_unitaire,
          lot.commande_id, lot.reception_id, lot.numero_conteneur, lot.numero_plomb, lot.emplacement_atelier, lot.created_at]);
      }
      const prix = num(lot.prix_unitaire);
      await client.query(`
        INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, valeur_stock, derniere_entree)
        VALUES ($1, $2, $3::numeric, $3::numeric * $4::numeric, NOW())
        ON CONFLICT (article_id, emplacement_id)
        DO UPDATE SET qte_disponible = stock_articles.qte_disponible + $3::numeric,
                      valeur_stock = COALESCE(stock_articles.valeur_stock, 0) + $3::numeric * $4::numeric,
                      derniere_entree = NOW()`, [lot.article_id, destId, q, prix]);
      await client.query(`INSERT INTO transferts_quarantaine (lot_id, article_id, code, designation, numero_lot, numero_lot_stock, qte, commande_id, numero_commande, numero_conteneur, par_id, par_nom)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [lot.id, lot.article_id, lot.code, lot.designation, lot.numero_lot, numeroStock, q, lot.commande_id, lot.numero_commande, lot.numero_conteneur, req.user?.id ? String(req.user.id) : null, par]);
      total += q; faits.push({ code: lot.code, qte: q, lot: numeroStock });
    }
    await client.query('COMMIT');
    res.json({ message: `${fmt(total, 3)} kg transferes de la quarantaine vers le stock du magasin MP`, transferts: faits });
  } catch (e) { await client.query('ROLLBACK'); fail(res, e, 'Erreur transfert quarantaine'); }
  finally { client.release(); }
});

module.exports = router;
