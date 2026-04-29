const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, role } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/articles');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// GET /api/articles
router.get('/', auth, async (req, res) => {
  try {
    const { famille_id, type_article, search, actif } = req.query;
    let q = `
      SELECT a.*,
        f.libelle AS famille_libelle,
        sf.libelle AS sous_famille_libelle,
        um.code AS unite_code,
        um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN sous_familles_articles sf ON sf.id = a.sous_famille_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE 1=1
    `;
    const params = [];
    if (actif !== 'false') { q += ' AND a.actif = true'; }
    if (famille_id) { params.push(famille_id); q += ` AND a.famille_id = $${params.length}`; }
    if (type_article) { params.push(type_article); q += ` AND a.type_article = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (a.code ILIKE $${params.length} OR a.designation ILIKE $${params.length} OR a.code_barre ILIKE $${params.length})`;
    }
    q += ' GROUP BY a.id, f.libelle, sf.libelle, um.code, um.libelle ORDER BY a.code';
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
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total,
        COALESCE(SUM(sa.valeur_stock), 0) AS valeur_stock_total
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

// POST /api/articles
router.post('/', auth, role('super_admin','chef_atelier','achat','qualite'),
  upload.fields([
    { name: 'fiche_technique', maxCount: 1 },
    { name: 'plan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const d = req.body;
      const fiche = req.files?.fiche_technique?.[0]?.filename ? `/uploads/articles/${req.files.fiche_technique[0].filename}` : null;
      const plan  = req.files?.plan?.[0]?.filename ? `/uploads/articles/${req.files.plan[0].filename}` : null;
      const photo = req.files?.photo?.[0]?.filename ? `/uploads/articles/${req.files.photo[0].filename}` : null;

      const { rows } = await db.query(`
        INSERT INTO articles (
          code, code_barre, designation, designation_fr, designation_ar,
          famille_id, sous_famille_id, categorie_id,
          unite_mesure_id, unite_mesure_achat_id, unite_mesure_vente_id,
          longueur_mm, largeur_mm, hauteur_mm, dimensions_libelle,
          poids_theorique_kg, poids_reel_kg, poids_tare_kg, poids_mandrin_kg,
          couleur, matiere, epaisseur_mm,
          cadence_theorique_kg_h, temps_reglage_min,
          prix_achat, prix_vente, prix_cession_interne, devise,
          stock_mini, stock_maxi, stock_securite, delai_appro_jours,
          dlc_jours, dluo_jours, temperature_stockage_min, temperature_stockage_max,
          allergenes, points_ccp, description_ccp, tracabilite_type,
          type_article, normes_iso,
          fiche_technique_path, plan_path, photo_path, actif
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
          $37,$38,$39,$40,$41,$42,$43,$44,$45,$46
        ) RETURNING *
      `, [
        d.code?.toUpperCase(), d.code_barre, d.designation, d.designation_fr, d.designation_ar,
        d.famille_id||null, d.sous_famille_id||null, d.categorie_id||null,
        d.unite_mesure_id||null, d.unite_mesure_achat_id||null, d.unite_mesure_vente_id||null,
        d.longueur_mm||null, d.largeur_mm||null, d.hauteur_mm||null, d.dimensions_libelle,
        d.poids_theorique_kg||null, d.poids_reel_kg||null, d.poids_tare_kg||null, d.poids_mandrin_kg||0,
        d.couleur, d.matiere, d.epaisseur_mm||null,
        d.cadence_theorique_kg_h||null, d.temps_reglage_min||30,
        d.prix_achat||0, d.prix_vente||0, d.prix_cession_interne||0, d.devise||'DZD',
        d.stock_mini||0, d.stock_maxi||null, d.stock_securite||0, d.delai_appro_jours||0,
        d.dlc_jours||null, d.dluo_jours||null, d.temperature_stockage_min||null, d.temperature_stockage_max||null,
        d.allergenes, d.points_ccp==='true', d.description_ccp, d.tracabilite_type||'lot',
        d.type_article||'produit_fini', d.normes_iso,
        fiche, plan, photo, true
      ]);
      res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// PUT /api/articles/:id
router.put('/:id', auth, role('super_admin','chef_atelier','achat','qualite'),
  upload.fields([
    { name: 'fiche_technique', maxCount: 1 },
    { name: 'plan', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const d = req.body;
      const updates = [];
      const params = [];
      const addField = (col, val) => { if (val !== undefined) { params.push(val); updates.push(`${col}=$${params.length}`); } };

      addField('designation', d.designation);
      addField('couleur', d.couleur);
      addField('matiere', d.matiere);
      addField('poids_theorique_kg', d.poids_theorique_kg);
      addField('poids_reel_kg', d.poids_reel_kg);
      addField('cadence_theorique_kg_h', d.cadence_theorique_kg_h);
      addField('prix_achat', d.prix_achat);
      addField('prix_vente', d.prix_vente);
      addField('prix_cession_interne', d.prix_cession_interne);
      addField('stock_mini', d.stock_mini);
      addField('actif', d.actif);
      addField('normes_iso', d.normes_iso);

      if (req.files?.fiche_technique?.[0]) addField('fiche_technique_path', `/uploads/articles/${req.files.fiche_technique[0].filename}`);
      if (req.files?.photo?.[0]) addField('photo_path', `/uploads/articles/${req.files.photo[0].filename}`);

      params.push(new Date()); updates.push(`updated_at=$${params.length}`);
      params.push(req.params.id);

      const { rows } = await db.query(
        `UPDATE articles SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`,
        params
      );
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/articles/:id (désactivation)
router.delete('/:id', auth, role('super_admin'), async (req, res) => {
  try {
    await db.query('UPDATE articles SET actif=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
