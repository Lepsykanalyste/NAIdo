#!/usr/bin/env python3
"""
Patch complet NAIdo - Familles / Groupes / Composition article / DetailOF
"""
import re

# ═══════════════════════════════════════════════════════════════
# 1. BACKEND — Route référentiels : ajouter sous-familles/groupes
# ═══════════════════════════════════════════════════════════════
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/referentiels.js', 'r') as f:
    ref = f.read()

# Ajouter routes groupes si pas déjà présentes
if '/groupes' not in ref:
    new_routes = """
// GET /api/referentiels/groupes — groupes par famille
router.get('/groupes', auth, async (req, res) => {
  try {
    const { famille_id } = req.query;
    let q = `
      SELECT sf.*, f.libelle AS famille_libelle,
             COUNT(a.id) AS nb_articles
      FROM sous_familles_articles sf
      LEFT JOIN familles_articles f ON f.id = sf.famille_id
      LEFT JOIN articles a ON a.sous_famille_id = sf.id AND a.actif = true
      WHERE sf.actif = true
    `;
    const params = [];
    if (famille_id) { params.push(parseInt(famille_id)); q += ` AND sf.famille_id = $${params.length}`; }
    q += ' GROUP BY sf.id, f.libelle ORDER BY f.libelle, sf.libelle';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/referentiels/groupes
router.post('/groupes', auth, async (req, res) => {
  try {
    const { famille_id, code, libelle } = req.body;
    if (!famille_id || !code || !libelle) return res.status(400).json({ error: 'famille_id, code et libelle requis' });
    const { rows } = await db.query(
      'INSERT INTO sous_familles_articles (famille_id, code, libelle) VALUES ($1,$2,$3) RETURNING *',
      [parseInt(famille_id), code.toUpperCase(), libelle]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/referentiels/groupes/:id
router.put('/groupes/:id', auth, async (req, res) => {
  try {
    const { libelle, actif } = req.body;
    const { rows } = await db.query(
      'UPDATE sous_familles_articles SET libelle=$1, actif=$2 WHERE id=$3 RETURNING *',
      [libelle, actif !== false, req.params.id]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

"""
    ref = ref.replace('module.exports = router;', new_routes + 'module.exports = router;')
    print("✓ Routes groupes ajoutées")
else:
    print("✓ Routes groupes déjà présentes")

with open('/home/sophopsy-ia/NAIdo/backend/src/routes/referentiels.js', 'w') as f:
    f.write(ref)

# ═══════════════════════════════════════════════════════════════
# 2. BACKEND — Route articles : ajouter composition_article
# ═══════════════════════════════════════════════════════════════
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'r') as f:
    art = f.read()

if '/composition' not in art:
    compo_routes = """
// GET /api/articles/:id/composition — composition par groupes
router.get('/:id/composition', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ca.*,
             sf.code AS groupe_code, sf.libelle AS groupe_libelle,
             f.libelle AS famille_libelle, f.code AS famille_code
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      JOIN familles_articles f ON f.id = ca.famille_id
      WHERE ca.article_id = $1
      ORDER BY ca.ordre, sf.libelle
    `, [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/articles/:id/composition — sauvegarder composition
router.put('/:id/composition', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { lignes } = req.body; // [{groupe_id, famille_id, pct, ordre}]
    // Supprimer l'ancienne composition
    await client.query('DELETE FROM composition_article WHERE article_id=$1', [req.params.id]);
    // Insérer la nouvelle
    for (let i=0; i<lignes.length; i++) {
      const l = lignes[i];
      await client.query(`
        INSERT INTO composition_article (article_id, groupe_id, famille_id, pct, poids_kg, ordre, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [req.params.id, l.groupe_id, l.famille_id, l.pct||0, l.poids_kg||null, i, l.notes||'']);
    }
    // Mettre à jour le JSONB composition_familles pour compatibilité
    const { rows } = await client.query(`
      SELECT ca.*, sf.code AS groupe_code, sf.libelle AS groupe_libelle
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      WHERE ca.article_id=$1 ORDER BY ca.ordre
    `, [req.params.id]);
    const compoJson = rows.map(r => ({
      famille_id: r.famille_id, groupe_id: r.groupe_id,
      famille_code: r.groupe_code, famille_libelle: r.groupe_libelle,
      pct: parseFloat(r.pct), pct_famille: parseFloat(r.pct),
      mp_choisies: []
    }));
    await client.query(
      'UPDATE articles SET composition_familles=$1 WHERE id=$2',
      [JSON.stringify(compoJson), req.params.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Composition sauvegardée', lignes: rows });
  } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

"""
    art = art.replace('module.exports = router;', compo_routes + 'module.exports = router;')
    print("✓ Routes composition article ajoutées")
else:
    print("✓ Routes composition déjà présentes")

# Enrichir GET /api/articles avec sous_famille_id et groupe
old_select = "        a.famille_id, a.unite_mesure_id, a.created_at,\n        f.libelle AS famille_libelle, f.code AS famille_code,"
new_select = "        a.famille_id, a.sous_famille_id, a.unite_mesure_id, a.created_at,\n        f.libelle AS famille_libelle, f.code AS famille_code,\n        sf.libelle AS groupe_libelle, sf.code AS groupe_code,"
if old_select in art and 'sous_famille_id' not in art[:art.find('LEFT JOIN familles_articles')]:
    art = art.replace(old_select, new_select)
    # Ajouter le JOIN sous_familles
    art = art.replace(
        "      LEFT JOIN familles_articles f ON f.id=a.famille_id\n      LEFT JOIN stock_articles sa ON sa.article_id=a.id",
        "      LEFT JOIN familles_articles f ON f.id=a.famille_id\n      LEFT JOIN sous_familles_articles sf ON sf.id=a.sous_famille_id\n      LEFT JOIN stock_articles sa ON sa.article_id=a.id"
    )
    print("✓ sous_famille/groupe ajoutés dans SELECT articles")

with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'w') as f:
    f.write(art)

# ═══════════════════════════════════════════════════════════════
# 3. BACKEND — Route AT3 : utiliser composition_article pour les besoins OF
# ═══════════════════════════════════════════════════════════════
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/at3_flux.js', 'r') as f:
    at3 = f.read()

old_besoins = """    // Utiliser la composition validée par le chef AT3 en priorité
    const compoOf = of.at3_composition_of || of.at3_composition_familles || [];
    const compoArr = Array.isArray(compoOf) ? compoOf : JSON.parse(compoOf || '[]');

    if (!compoArr.length) {
      return ok(res, { besoins: [], message: 'Aucune composition définie pour cet OF' });
    }

    // Calculer besoins par MP
    const besoins = [];
    for (const c of compoArr) {
      const pct = parseFloat(c.pct || 0);
      const qteNecessaire = (pct / 100) * poidsCible;

      // Stock AT3 disponible
      const stockRes = await db.query(`
        SELECT COALESCE(SUM(qte_disponible - qte_reservee), 0) AS qte_dispo_at3
        FROM stock_at3 WHERE article_id = $1
      `, [c.mp_id]);
      const qteDispo = parseFloat(stockRes.rows[0].qte_dispo_at3 || 0);

      // Stock Magasin MP
      const magRes = await db.query(`
        SELECT COALESCE(SUM(qte_disponible), 0) AS qte_mag
        FROM stock_articles WHERE article_id = $1
      `, [c.mp_id]);
      const qteMag = parseFloat(magRes.rows[0].qte_mag || 0);

      besoins.push({
        article_id:       c.mp_id,
        code:             c.code,
        designation:      c.designation,
        famille_id:       c.famille_id,
        famille_libelle:  c.famille_libelle,
        pct,
        qte_necessaire:   parseFloat(qteNecessaire.toFixed(3)),
        qte_dispo_at3:    parseFloat(qteDispo.toFixed(3)),
        qte_dispo_mag:    parseFloat(qteMag.toFixed(3)),
        qte_a_demander:   parseFloat(Math.max(0, qteNecessaire - qteDispo).toFixed(3)),
        suffisant:        qteDispo >= qteNecessaire,
      });
    }

    ok(res, { besoins, poids_cible: poidsCible, of_numero: of.numero_of });"""

new_besoins = """    // Charger la composition depuis composition_article (table propre)
    const compoRows = await db.query(`
      SELECT ca.*, sf.code AS groupe_code, sf.libelle AS groupe_libelle,
             f.libelle AS famille_libelle
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      JOIN familles_articles f ON f.id = ca.famille_id
      WHERE ca.article_id = (SELECT article_id FROM ordres_fabrication WHERE id=$1)
      ORDER BY ca.ordre
    `, [req.params.of_id]);

    // Aussi récupérer la composition validée par le chef (at3_composition_of)
    const compoOf = of.at3_composition_of;
    const compoArr = Array.isArray(compoOf) ? compoOf : (compoOf ? JSON.parse(compoOf) : []);

    if (!compoRows.rows.length && !compoArr.length) {
      return ok(res, { besoins: [], groupes: [], message: 'Aucune composition définie pour cet OF' });
    }

    // Si composition chef AT3 validée → utiliser pour besoins MP détaillés
    const besoins = [];
    if (compoArr.length > 0) {
      for (const c of compoArr) {
        const pct = parseFloat(c.pct || 0);
        const qteNecessaire = (pct / 100) * poidsCible;
        const stockRes = await db.query(
          'SELECT COALESCE(SUM(qte_disponible - qte_reservee),0) AS q FROM stock_at3 WHERE article_id=$1',
          [c.mp_id]
        );
        const magRes = await db.query(
          'SELECT COALESCE(SUM(qte_disponible),0) AS q FROM stock_articles WHERE article_id=$1',
          [c.mp_id]
        );
        const qteDispo = parseFloat(stockRes.rows[0].q||0);
        const qteMag   = parseFloat(magRes.rows[0].q||0);
        besoins.push({
          article_id: c.mp_id, code: c.code, designation: c.designation,
          groupe_id: c.famille_id, groupe_libelle: c.famille_libelle,
          pct, qte_necessaire: parseFloat(qteNecessaire.toFixed(3)),
          qte_dispo_at3: parseFloat(qteDispo.toFixed(3)),
          qte_dispo_mag: parseFloat(qteMag.toFixed(3)),
          qte_a_demander: parseFloat(Math.max(0, qteNecessaire-qteDispo).toFixed(3)),
          suffisant: qteDispo >= qteNecessaire,
        });
      }
    }

    // Groupes avec articles disponibles en stock AT3
    const groupes = [];
    for (const g of compoRows.rows) {
      const pct = parseFloat(g.pct||0);
      const qteNecessaire = (pct/100)*poidsCible;
      // Articles du groupe en stock AT3
      const artRes = await db.query(`
        SELECT a.id, a.code, a.designation,
               COALESCE(SUM(sa.qte_disponible),0) AS stock_magasin,
               COALESCE((SELECT SUM(qte_disponible) FROM stock_at3 WHERE article_id=a.id),0) AS stock_at3
        FROM articles a
        LEFT JOIN stock_articles sa ON sa.article_id=a.id
        WHERE a.sous_famille_id=$1 AND a.type_article='matiere_premiere' AND a.actif=true
        GROUP BY a.id, a.code, a.designation
        ORDER BY a.code
      `, [g.groupe_id]);
      groupes.push({
        groupe_id: g.groupe_id, groupe_code: g.groupe_code,
        groupe_libelle: g.groupe_libelle, famille_libelle: g.famille_libelle,
        pct, qte_necessaire: parseFloat(qteNecessaire.toFixed(3)),
        articles: artRes.rows,
      });
    }

    ok(res, { besoins, groupes, poids_cible: poidsCible, of_numero: of.numero_of });"""

if old_besoins in at3:
    at3 = at3.replace(old_besoins, new_besoins)
    print("✓ Route besoins OF mise à jour")
else:
    print("⚠ Route besoins non trouvée — déjà à jour ou pattern différent")

with open('/home/sophopsy-ia/NAIdo/backend/src/routes/at3_flux.js', 'w') as f:
    f.write(at3)

print("\n✅ Backend patché. Rebuilder avec: docker compose up -d --build backend")
