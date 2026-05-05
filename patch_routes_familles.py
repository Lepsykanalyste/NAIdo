import re

# ─────────────────────────────────────────────────────────────
# 1. Route GET /api/at3/of — ajouter composition_familles et at3_composition_familles
# ─────────────────────────────────────────────────────────────
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/at3_flux.js', 'r') as f:
    content = f.read()

old = "             a.composition, a.couleur, a.longueur_mm, a.largeur_mm,"
new = "             a.composition, a.composition_familles, a.couleur, a.longueur_mm, a.largeur_mm,\n             o.at3_composition_familles,"
content = content.replace(old, new)

# Route GET /api/at3/of/:id — ajouter aussi
old2 = "             a.composition, a.poids_mandrin_kg, a.couleur,"
new2 = "             a.composition, a.composition_familles, a.poids_mandrin_kg, a.couleur,\n             o.at3_composition_familles,"
content = content.replace(old2, new2)

# Route PUT configurer — ajouter at3_composition_familles
old3 = "    if (composition_of && Array.isArray(composition_of) && composition_of.length > 0) {\n      params.push(JSON.stringify(composition_of));\n      sets.push(`at3_composition_of = $${params.length}`);\n    }"
new3 = """    if (composition_of && Array.isArray(composition_of) && composition_of.length > 0) {
      params.push(JSON.stringify(composition_of));
      sets.push(`at3_composition_of = $${params.length}`);
    }
    if (req.body.at3_composition_familles && Array.isArray(req.body.at3_composition_familles)) {
      params.push(JSON.stringify(req.body.at3_composition_familles));
      sets.push(`at3_composition_familles = $${params.length}`);
    }"""
content = content.replace(old3, new3)

with open('/home/sophopsy-ia/NAIdo/backend/src/routes/at3_flux.js', 'w') as f:
    f.write(content)
print("✓ at3_flux.js mis à jour")

# ─────────────────────────────────────────────────────────────
# 2. Route GET /api/articles/:id — créer si elle n'existe pas
#    (pour charger la composition_familles d'un article)
# ─────────────────────────────────────────────────────────────
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'r') as f:
    art_content = f.read()

# Vérifier si la route GET /:id existe
if "router.get('/:id'" not in art_content and 'router.get("/:id"' not in art_content:
    # Ajouter avant module.exports
    new_route = """
// GET /api/articles/:id — détail d'un article
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, f.libelle AS famille_libelle, f.code AS famille_code
       FROM articles a
       LEFT JOIN familles_articles f ON f.id = a.famille_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article introuvable' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

"""
    art_content = art_content.replace('module.exports = router;', new_route + 'module.exports = router;')
    with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'w') as f:
        f.write(art_content)
    print("✓ Route GET /api/articles/:id ajoutée")
else:
    print("✓ Route GET /api/articles/:id déjà présente")

# ─────────────────────────────────────────────────────────────
# 3. Route GET /api/stock/liste — pour récupérer stock MP
#    (si elle n'existe pas)
# ─────────────────────────────────────────────────────────────
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/stock.js', 'r') as f:
    stock_content = f.read()

if '/liste' not in stock_content:
    new_stock_route = """
// GET /api/stock/liste — liste stock avec article info
router.get('/liste', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sa.*, a.code, a.designation, a.type_article, a.famille_id,
             f.libelle AS famille_libelle, f.code AS famille_code
      FROM stock_articles sa
      JOIN articles a ON a.id = sa.article_id
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      ORDER BY a.type_article, a.code
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/stock/matieres — stock MP uniquement
router.get('/matieres', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sa.article_id, sa.qte_disponible, sa.qte_reservee,
             a.code, a.designation, a.famille_id,
             f.libelle AS famille_libelle, f.code AS famille_code
      FROM stock_articles sa
      JOIN articles a ON a.id = sa.article_id
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      WHERE a.type_article = 'matiere_premiere'
      ORDER BY a.famille_id, a.code
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

"""
    # Insérer avant le premier router.get existant
    stock_content = stock_content.replace('module.exports = router;', new_stock_route + 'module.exports = router;')
    with open('/home/sophopsy-ia/NAIdo/backend/src/routes/stock.js', 'w') as f:
        f.write(stock_content)
    print("✓ Routes /api/stock/liste et /api/stock/matieres ajoutées")
else:
    print("✓ Routes stock déjà présentes")

# ─────────────────────────────────────────────────────────────
# 4. Vérifier que composition_familles est dans PUT articles
# ─────────────────────────────────────────────────────────────
with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'r') as f:
    art_content = f.read()

if 'composition_familles' not in art_content:
    # Ajouter dans le PUT articles
    art_content = re.sub(
        r"composition\s*=\s*payload\.composition",
        "composition = payload.composition,\n               composition_familles = payload.composition_familles",
        art_content
    )
    with open('/home/sophopsy-ia/NAIdo/backend/src/routes/articles.js', 'w') as f:
        f.write(art_content)
    print("✓ composition_familles ajouté dans PUT articles")
else:
    print("✓ composition_familles déjà dans articles")

print("\n✅ Toutes les routes mises à jour")
