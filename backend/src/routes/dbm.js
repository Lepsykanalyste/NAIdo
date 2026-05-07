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

// PUT /api/dbm/:id/livrer — Magasinier MP livre les MP
router.put('/:id/livrer', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { livraisons, notes_magasin } = req.body;
    // livraisons = [{ ligne_id, article_id, famille_id, qte_livree, numero_lot }]
    const mag_id = req.user?.id;

    // Récupérer la DBM
    const dbmRes = await client.query('SELECT * FROM dbm WHERE id=$1', [req.params.id]);
    if (!dbmRes.rows.length) throw new Error('DBM introuvable');
    const dbm = dbmRes.rows[0];

    let toutLivre = true;

    for (const l of livraisons) {
      if (!l.qte_livree || parseFloat(l.qte_livree) <= 0) continue;

      // Mettre à jour la ligne DBM
      await client.query(`
        UPDATE dbm_lignes
        SET qte_livree = qte_livree + $1
        WHERE id = $2
      `, [l.qte_livree, l.ligne_id]);

      // Vérifier si tout est livré
      const ligneRes = await client.query(
        'SELECT qte_demandee, qte_livree FROM dbm_lignes WHERE id=$1', [l.ligne_id]
      );
      if (parseFloat(ligneRes.rows[0].qte_livree) < parseFloat(ligneRes.rows[0].qte_demandee)) {
        toutLivre = false;
      }

      // Créditer le stock AT3
      const stockRes = await client.query(
        'SELECT id FROM stock_at3 WHERE article_id=$1 LIMIT 1', [l.article_id]
      );
      if (stockRes.rows.length) {
        await client.query(`
          UPDATE stock_at3
          SET qte_disponible = qte_disponible + $1, updated_at = NOW()
          WHERE article_id = $2
        `, [l.qte_livree, l.article_id]);
      } else {
        await client.query(`
          INSERT INTO stock_at3 (article_id, famille_id, qte_disponible, numero_lot, dbm_id)
          VALUES ($1,$2,$3,$4,$5)
        `, [l.article_id, l.famille_id||null, l.qte_livree, l.numero_lot||'', dbm.id]);
      }

      // Déduire du stock Magasin MP (stock_articles)
      await client.query(`
        UPDATE stock_articles
        SET qte_disponible = GREATEST(0, qte_disponible - $1)
        WHERE article_id = $2
      `, [l.qte_livree, l.article_id]);

      // Mouvement stock AT3
      const numMvt = await client.query(
        "SELECT 'MSAT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_stock_at3_num')::text,4,'0') AS num"
      );
      await client.query(`
        INSERT INTO mouvements_stock_at3 (numero_mvt, type_mvt, article_id, quantite, dbm_id, of_id, operateur_id, notes)
        VALUES ($1,'entree_dbm',$2,$3,$4,$5,$6,$7)
      `, [numMvt.rows[0].num, l.article_id, l.qte_livree, dbm.id, dbm.of_id, mag_id, `Livraison DBM ${dbm.numero_dbm}`]);
    }

    // Mettre à jour statut DBM
    const nouveauStatut = toutLivre ? 'livre' : 'partiel';
    await client.query(`
      UPDATE dbm SET statut=$1, livre_par=$2, date_livraison=NOW(), notes_magasin=$3 WHERE id=$4
    `, [nouveauStatut, mag_id, notes_magasin||'', req.params.id]);

    await client.query('COMMIT');
    ok(res, { message: `Livraison enregistrée — statut : ${nouveauStatut} ✓` });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur livraison DBM'); }
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

// GET /api/dbm/stock-at3 — stock MP interne AT3
router.get('/stock-at3/liste', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*,
             a.code, a.designation, a.type_article,
             f.libelle AS famille_libelle, f.code AS famille_code
      FROM stock_at3 s
      JOIN articles a ON a.id = s.article_id
      LEFT JOIN familles_articles f ON f.id = s.famille_id
      WHERE s.qte_disponible > 0 OR s.qte_reservee > 0
      ORDER BY f.libelle, a.code
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur stock AT3'); }
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

// GET /api/dbm/stock-at3/mouvements — historique mouvements
router.get('/stock-at3/mouvements', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*, a.code, a.designation,
             u.nom || ' ' || u.prenom AS operateur_nom,
             o.numero_of
      FROM mouvements_stock_at3 m
      LEFT JOIN articles a ON a.id = m.article_id
      LEFT JOIN utilisateurs u ON u.id = m.operateur_id
      LEFT JOIN ordres_fabrication o ON o.id = m.of_id
      ORDER BY m.date_mvt DESC
      LIMIT 100
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur mouvements stock AT3'); }
});

// ══════════════════════════════════════════════════════════════
// 3. DÉCLARATIONS DE PRODUCTION
// ══════════════════════════════════════════════════════════════

// GET /api/dbm/declarations — liste
router.get('/declarations/liste', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, o.numero_of,
             u.nom || ' ' || u.prenom AS declare_par_nom,
             a.code AS article_code, a.designation AS article_nom
      FROM declarations_production d
      LEFT JOIN ordres_fabrication o ON o.id = d.of_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN utilisateurs u ON u.id = d.declare_par
      ORDER BY d.created_at DESC
      LIMIT 100
    `);
    ok(res, rows);
  } catch(e) { err(res, e, 'Erreur liste déclarations'); }
});

// POST /api/dbm/declarations — créer déclaration
router.post('/declarations', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { of_id, poids_produit_kg, poids_dechets_kg, poids_rebuts_kg,
            temps_reel_min, lignes_mp, notes } = req.body;
    const declare_par = req.user?.id;

    const numRes = await client.query("SELECT gen_numero_decl() AS num");
    const numero_decl = numRes.rows[0].num;

    const { rows: [decl] } = await client.query(`
      INSERT INTO declarations_production (
        numero_decl, of_id, atelier_id,
        poids_produit_kg, poids_dechets_kg, poids_rebuts_kg,
        temps_reel_min, statut, declare_par, notes
      ) VALUES ($1,$2,1,$3,$4,$5,$6,'soumis',$7,$8)
      RETURNING *
    `, [numero_decl, of_id,
        poids_produit_kg||0, poids_dechets_kg||0, poids_rebuts_kg||0,
        temps_reel_min||0, declare_par, notes||'']);

    // Lignes MP consommées
    for (const l of (lignes_mp||[])) {
      const qteRestante = Math.max(0, parseFloat(l.qte_prevue_kg||0) - parseFloat(l.qte_reelle_kg||0));
      await client.query(`
        INSERT INTO declaration_lignes_mp (
          declaration_id, article_id, famille_id,
          qte_prevue_kg, qte_reelle_kg, qte_restante_kg, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [decl.id, l.article_id, l.famille_id||null,
          l.qte_prevue_kg||0, l.qte_reelle_kg||0, qteRestante, l.notes||'']);

      // Sortir du stock AT3 la quantité consommée
      await client.query(`
        UPDATE stock_at3
        SET qte_disponible = GREATEST(0, qte_disponible - $1),
            qte_consommee  = qte_consommee + $1,
            updated_at     = NOW()
        WHERE article_id = $2 AND qte_disponible > 0
      `, [l.qte_reelle_kg||0, l.article_id]);

      // Le reliquat reste en stock AT3 (rien à faire, il y est déjà)
      // Mouvement sortie
      const numMvt = await client.query(
        "SELECT 'MSAT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_stock_at3_num')::text,4,'0') AS num"
      );
      await client.query(`
        INSERT INTO mouvements_stock_at3 (numero_mvt, type_mvt, article_id, quantite, of_id, operateur_id, notes)
        VALUES ($1,'sortie_production',$2,$3,$4,$5,$6)
      `, [numMvt.rows[0].num, l.article_id, l.qte_reelle_kg||0, of_id, declare_par,
          `Déclaration ${numero_decl}`]);
    }

    // Mettre à jour le poids produit sur l'OF
    await client.query(`
      UPDATE ordres_fabrication
      SET poids_reel_total_kg = COALESCE(poids_reel_total_kg,0) + $1
      WHERE id = $2
    `, [poids_produit_kg||0, of_id]);

    await client.query('COMMIT');
    ok(res, { declaration: decl, message: `Déclaration ${numero_decl} enregistrée ✓` });
  } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur déclaration'); }
  finally { client.release(); }
});

module.exports = router;
