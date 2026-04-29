const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/articles');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/articles
router.get('/', auth, async (req, res) => {
  try {
    const { famille_id, type_article, search } = req.query;
    let q = `
      SELECT a.id, a.code, a.designation, a.couleur, a.matiere,
        a.poids_theorique_kg, a.poids_reel_kg, a.cadence_theorique_kg_h,
        a.temps_reglage_min, a.prix_cession_interne, a.prix_achat, a.prix_vente,
        a.stock_mini, a.type_article, a.tracabilite_type, a.actif,
        a.longueur_mm, a.largeur_mm, a.hauteur_mm, a.dimensions_libelle,
        a.photo_path, a.fiche_technique_path,
        a.dlc_jours, a.points_ccp, a.normes_iso,
        a.created_at,
        f.libelle AS famille_libelle, f.code AS famille_code,
        sf.libelle AS sous_famille_libelle,
        um.code AS unite_code, um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN sous_familles_articles sf ON sf.id = a.sous_famille_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.actif = true
    `;
    const params = [];
    if (famille_id) { params.push(famille_id); q += ` AND a.famille_id = $${params.length}`; }
    if (type_article) { params.push(type_article); q += ` AND a.type_article = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (a.code ILIKE $${params.length} OR a.designation ILIKE $${params.length} OR COALESCE(a.code_barre,'') ILIKE $${params.length})`;
    }
    q += ' GROUP BY a.id, f.libelle, f.code, sf.libelle, um.code, um.libelle ORDER BY a.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/articles/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*,
        f.libelle AS famille_libelle, f.code AS famille_code,
        sf.libelle AS sous_famille_libelle,
        cat.libelle AS categorie_libelle,
        um.code AS unite_code, um.libelle AS unite_libelle,
        uma.code AS unite_achat_code,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN sous_familles_articles sf ON sf.id = a.sous_famille_id
      LEFT JOIN categories_articles cat ON cat.id = a.categorie_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN unites_mesure uma ON uma.id = a.unite_mesure_achat_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, f.libelle, f.code, sf.libelle, cat.libelle, um.code, um.libelle, uma.code
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Article introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/articles — Créer un article
router.post('/', auth, upload.fields([
  { name: 'fiche_technique', maxCount: 1 },
  { name: 'plan', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), async (req, res) => {
  try {
    const d = req.body;
    const fiche = req.files?.fiche_technique?.[0] ? `/uploads/articles/${req.files.fiche_technique[0].filename}` : null;
    const plan  = req.files?.plan?.[0]  ? `/uploads/articles/${req.files.plan[0].filename}`  : null;
    const photo = req.files?.photo?.[0] ? `/uploads/articles/${req.files.photo[0].filename}` : null;

    if (!d.code || !d.designation) return res.status(400).json({ error: 'Code et désignation requis' });

    const { rows } = await db.query(`
      INSERT INTO articles (
        code, code_barre, designation, designation_fr, designation_ar,
        famille_id, sous_famille_id, categorie_id,
        unite_mesure_id, unite_mesure_achat_id,
        longueur_mm, largeur_mm, hauteur_mm, dimensions_libelle,
        poids_theorique_kg, poids_reel_kg, poids_tare_kg, poids_mandrin_kg,
        couleur, matiere, epaisseur_mm,
        cadence_theorique_kg_h, temps_reglage_min,
        prix_achat, prix_vente, prix_cession_interne, devise,
        stock_mini, stock_maxi, stock_securite, delai_appro_jours,
        dlc_jours, dluo_jours,
        temperature_stockage_min, temperature_stockage_max,
        allergenes, points_ccp, description_ccp, tracabilite_type,
        type_article, normes_iso,
        fiche_technique_path, plan_path, photo_path, actif
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,
        $35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46
      ) RETURNING *
    `, [
      d.code?.toUpperCase()?.trim(), d.code_barre||null,
      d.designation?.trim(), d.designation_fr||null, d.designation_ar||null,
      d.famille_id||null, d.sous_famille_id||null, d.categorie_id||null,
      d.unite_mesure_id||null, d.unite_mesure_achat_id||null,
      d.longueur_mm||null, d.largeur_mm||null, d.hauteur_mm||null, d.dimensions_libelle||null,
      d.poids_theorique_kg||null, d.poids_reel_kg||null, d.poids_tare_kg||null, d.poids_mandrin_kg||0,
      d.couleur||null, d.matiere||null, d.epaisseur_mm||null,
      d.cadence_theorique_kg_h||null, d.temps_reglage_min||30,
      d.prix_achat||0, d.prix_vente||0, d.prix_cession_interne||0, d.devise||'DZD',
      d.stock_mini||0, d.stock_maxi||null, d.stock_securite||0, d.delai_appro_jours||0,
      d.dlc_jours||null, d.dluo_jours||null,
      d.temperature_stockage_min||null, d.temperature_stockage_max||null,
      d.allergenes||null, d.points_ccp==='true'||false, d.description_ccp||null,
      d.tracabilite_type||'lot', d.type_article||'produit_fini', d.normes_iso||null,
      fiche, plan, photo, true
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ce code article existe déjà' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/articles/:id — Modifier un article
router.put('/:id', auth, upload.fields([
  { name: 'fiche_technique', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), async (req, res) => {
  try {
    const d = req.body;
    const sets = [];
    const vals = [];
    const add = (col, val) => { if (val !== undefined && val !== '') { vals.push(val); sets.push(`${col}=$${vals.length}`); } };

    add('designation', d.designation);
    add('couleur', d.couleur);
    add('matiere', d.matiere);
    add('famille_id', d.famille_id||null);
    add('sous_famille_id', d.sous_famille_id||null);
    add('unite_mesure_id', d.unite_mesure_id||null);
    add('poids_theorique_kg', d.poids_theorique_kg);
    add('poids_reel_kg', d.poids_reel_kg);
    add('poids_mandrin_kg', d.poids_mandrin_kg);
    add('cadence_theorique_kg_h', d.cadence_theorique_kg_h);
    add('temps_reglage_min', d.temps_reglage_min);
    add('longueur_mm', d.longueur_mm);
    add('largeur_mm', d.largeur_mm);
    add('hauteur_mm', d.hauteur_mm);
    add('dimensions_libelle', d.dimensions_libelle);
    add('prix_achat', d.prix_achat);
    add('prix_vente', d.prix_vente);
    add('prix_cession_interne', d.prix_cession_interne);
    add('stock_mini', d.stock_mini);
    add('stock_maxi', d.stock_maxi);
    add('type_article', d.type_article);
    add('tracabilite_type', d.tracabilite_type);
    add('normes_iso', d.normes_iso);
    add('dlc_jours', d.dlc_jours);
    add('allergenes', d.allergenes);
    if (d.actif !== undefined) { vals.push(d.actif === 'true' || d.actif === true); sets.push(`actif=$${vals.length}`); }
    if (req.files?.photo?.[0]) { vals.push(`/uploads/articles/${req.files.photo[0].filename}`); sets.push(`photo_path=$${vals.length}`); }
    if (req.files?.fiche_technique?.[0]) { vals.push(`/uploads/articles/${req.files.fiche_technique[0].filename}`); sets.push(`fiche_technique_path=$${vals.length}`); }

    vals.push(new Date()); sets.push(`updated_at=$${vals.length}`);
    vals.push(req.params.id);

    if (sets.length === 1) return res.status(400).json({ error: 'Aucun champ à modifier' });

    const { rows } = await db.query(
      `UPDATE articles SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Article introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/articles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE articles SET actif=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
