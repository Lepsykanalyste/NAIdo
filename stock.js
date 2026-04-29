const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// ── INVENTAIRE ────────────────────────────────────────────────
router.get('/inventaire', auth, async (req, res) => {
  try {
    const { search } = req.query;
    let q = `
      SELECT
        a.id, a.code, a.designation, a.stock_mini,
        f.libelle AS famille,
        um.code AS unite,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total_dispo,
        COALESCE(SUM(sa.qte_reservee), 0) AS stock_total_reserve,
        COALESCE(SUM(sa.valeur_stock), 0) AS valeur_totale,
        CASE WHEN COALESCE(SUM(sa.qte_disponible),0) <= COALESCE(a.stock_mini,0)
             THEN true ELSE false END AS alerte_stock_bas
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.actif = true
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (a.code ILIKE $1 OR a.designation ILIKE $1)`;
    }
    q += ' GROUP BY a.id, f.libelle, um.code ORDER BY a.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LOTS ─────────────────────────────────────────────────────
router.get('/lots', auth, async (req, res) => {
  try {
    const { statut, search } = req.query;
    let q = `
      SELECT l.*,
        a.code AS article_code, a.designation AS article_designation,
        e.code AS emplacement_code, e.libelle AS emplacement_libelle
      FROM lots_stock l
      JOIN articles a ON a.id = l.article_id
      LEFT JOIN emplacements_stock e ON e.id = l.emplacement_id
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); q += ` AND l.statut = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (a.code ILIKE $${params.length} OR a.designation ILIKE $${params.length} OR l.numero_lot ILIKE $${params.length})`;
    }
    q += ' ORDER BY l.date_reception DESC, l.created_at DESC LIMIT 200';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lots', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const d = req.body;

    // Créer le lot
    const { rows: [lot] } = await client.query(`
      INSERT INTO lots_stock (
        article_id, emplacement_id, numero_lot,
        qte_initiale, qte_disponible,
        prix_unitaire, date_fabrication, date_dlc, date_dluo,
        date_reception, statut
      ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,CURRENT_DATE,'disponible')
      RETURNING *
    `, [
      d.article_id, d.emplacement_id || null, d.numero_lot,
      d.qte_initiale, d.prix_unitaire || 0,
      d.date_fabrication || null, d.date_dlc || null, d.date_dluo || null
    ]);

    // Mettre à jour le stock global
    if (d.emplacement_id) {
      await client.query(`
        INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, valeur_stock, derniere_entree)
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (article_id, emplacement_id)
        DO UPDATE SET
          qte_disponible = stock_articles.qte_disponible + $3,
          valeur_stock = stock_articles.valeur_stock + ($3 * $4),
          derniere_entree = NOW()
      `, [d.article_id, d.emplacement_id, d.qte_initiale, d.prix_unitaire || 0]);
    }

    // Enregistrer le mouvement
    await client.query(`
      INSERT INTO mouvements_stock_simple
        (article_id, emplacement_id, type, qte, numero_lot, prix_unitaire, notes, cree_par)
      VALUES ($1,$2,'entree',$3,$4,$5,$6,$7)
    `, [d.article_id, d.emplacement_id || null, d.qte_initiale,
        d.numero_lot, d.prix_unitaire || 0, `Création lot ${d.numero_lot}`, req.user.id])
    .catch(() => {}); // Table optionnelle

    await client.query('COMMIT');
    res.status(201).json(lot);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'Ce numéro de lot existe déjà' });
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

router.put('/lots/:id', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const { rows } = await db.query(
      'UPDATE lots_stock SET statut=$1 WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ENTRÉE STOCK ─────────────────────────────────────────────
router.post('/entree', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { article_id, emplacement_id, qte, numero_lot, date_dlc, prix_unitaire, notes } = req.body;

    if (!article_id || !qte || parseFloat(qte) <= 0)
      return res.status(400).json({ error: 'Article et quantité requis' });

    // Si numéro de lot fourni, créer ou mettre à jour le lot
    if (numero_lot) {
      const { rows: existing } = await client.query(
        'SELECT id FROM lots_stock WHERE numero_lot=$1 AND article_id=$2', [numero_lot, article_id]
      );
      if (existing.length > 0) {
        await client.query(
          'UPDATE lots_stock SET qte_disponible = qte_disponible + $1 WHERE id=$2',
          [qte, existing[0].id]
        );
      } else {
        await client.query(`
          INSERT INTO lots_stock (article_id, emplacement_id, numero_lot, qte_initiale, qte_disponible, prix_unitaire, date_dlc, statut)
          VALUES ($1,$2,$3,$4,$4,$5,$6,'disponible')
        `, [article_id, emplacement_id || null, numero_lot, qte, prix_unitaire || 0, date_dlc || null]);
      }
    }

    // Mettre à jour le stock
    if (emplacement_id) {
      await client.query(`
        INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, valeur_stock, derniere_entree)
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (article_id, emplacement_id)
        DO UPDATE SET
          qte_disponible = stock_articles.qte_disponible + $3,
          valeur_stock = stock_articles.valeur_stock + ($3 * $4),
          derniere_entree = NOW()
      `, [article_id, emplacement_id, qte, prix_unitaire || 0]);
    } else {
      // Sans emplacement : juste initialiser l'article dans stock_articles
      const { rows: empls } = await client.query(
        'SELECT id FROM emplacements_stock WHERE actif=true LIMIT 1'
      );
      const emplId = empls[0]?.id;
      if (emplId) {
        await client.query(`
          INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible, derniere_entree)
          VALUES ($1,$2,$3,NOW())
          ON CONFLICT (article_id, emplacement_id)
          DO UPDATE SET qte_disponible = stock_articles.qte_disponible + $3, derniere_entree = NOW()
        `, [article_id, emplId, qte]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Entrée de ${qte} enregistrée` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── SORTIE STOCK ─────────────────────────────────────────────
router.post('/sortie', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { article_id, emplacement_id, qte, notes } = req.body;

    if (!article_id || !qte || parseFloat(qte) <= 0)
      return res.status(400).json({ error: 'Article et quantité requis' });

    // Vérifier stock disponible
    const { rows: stock } = await client.query(
      `SELECT COALESCE(SUM(qte_disponible),0) AS total FROM stock_articles WHERE article_id=$1 ${emplacement_id ? 'AND emplacement_id=$2' : ''}`,
      emplacement_id ? [article_id, emplacement_id] : [article_id]
    );
    const disponible = parseFloat(stock[0]?.total || 0);
    if (disponible < parseFloat(qte)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Stock insuffisant : ${disponible} disponible, ${qte} demandé` });
    }

    // Déduire du stock (FIFO sur les lots)
    if (emplacement_id) {
      await client.query(`
        UPDATE stock_articles SET
          qte_disponible = GREATEST(0, qte_disponible - $1),
          derniere_sortie = NOW()
        WHERE article_id=$2 AND emplacement_id=$3
      `, [qte, article_id, emplacement_id]);
    } else {
      await client.query(`
        UPDATE stock_articles SET
          qte_disponible = GREATEST(0, qte_disponible - $1),
          derniere_sortie = NOW()
        WHERE article_id=$2
      `, [qte, article_id]);
    }

    // Déduire du lot le plus ancien (FIFO)
    const { rows: lotsDispos } = await client.query(`
      SELECT id, qte_disponible FROM lots_stock
      WHERE article_id=$1 AND statut='disponible' AND qte_disponible > 0
      ORDER BY date_reception ASC, created_at ASC
    `, [article_id]);

    let reste = parseFloat(qte);
    for (const lot of lotsDispos) {
      if (reste <= 0) break;
      const deduire = Math.min(reste, parseFloat(lot.qte_disponible));
      await client.query(
        'UPDATE lots_stock SET qte_disponible = qte_disponible - $1 WHERE id=$2',
        [deduire, lot.id]
      );
      // Marquer épuisé si 0
      await client.query(
        "UPDATE lots_stock SET statut='epuise' WHERE id=$1 AND qte_disponible <= 0",
        [lot.id]
      );
      reste -= deduire;
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Sortie de ${qte} enregistrée` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── MOUVEMENTS (journal) ──────────────────────────────────────
router.get('/mouvements', auth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    // Vue unifiée des entrées/sorties depuis mouvements_stock
    const { rows } = await db.query(`
      SELECT
        ms.id, ms.created_at, ms.type_mouvement AS type,
        ms.notes, ms.cree_par,
        a.code AS article_code, a.designation AS article_designation,
        e1.code AS emplacement_code,
        lm.qte_prevue AS qte,
        lm.lot_id,
        ls.numero_lot,
        u.nom||' '||u.prenom AS cree_par_nom
      FROM mouvements_stock ms
      JOIN lignes_mouvement lm ON lm.mouvement_id = ms.id
      JOIN articles a ON a.id = lm.article_id
      LEFT JOIN emplacements_stock e1 ON e1.id = ms.emplacement_dest_id
      LEFT JOIN lots_stock ls ON ls.id = lm.lot_id
      LEFT JOIN utilisateurs u ON u.id = ms.cree_par
      WHERE ms.statut IN ('valide','receptionne')
      ORDER BY ms.created_at DESC
      LIMIT $1
    `, [limit]);

    // Déterminer type entrée/sortie
    const enriched = rows.map(r => ({
      ...r,
      type: ['reception_achat','livraison_mp','production'].includes(r.type) ? 'entree' : 'sortie'
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
