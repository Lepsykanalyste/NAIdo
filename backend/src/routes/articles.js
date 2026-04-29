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
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
const uploadFields = upload.fields([
  { name: 'fiche_technique', maxCount: 1 },
  { name: 'fiche_securite', maxCount: 1 },
  { name: 'plan', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]);

// GET /api/articles
router.get('/', auth, async (req, res) => {
  try {
    const { famille_id, type_article, search, exclure_mp } = req.query;
    let q = `
      SELECT a.id, a.code, a.code_barre, a.designation, a.couleur,
        a.poids_theorique_kg, a.poids_reel_kg, a.cadence_theorique_kg_h,
        a.temps_reglage_min, a.prix_achat, a.prix_vente, a.prix_cession_interne,
        a.stock_mini, a.type_article, a.tracabilite_type, a.format_lot, a.actif,
        a.longueur_mm, a.largeur_mm, a.hauteur_mm, a.dimensions_libelle,
        a.photo_path, a.fiche_technique_path, a.fiche_securite_path,
        a.dlc_jours, a.dluo_jours, a.points_ccp, a.normes_iso, a.certifications,
        a.fournisseur, a.reference_fournisseur, a.densite,
        a.temperature_fusion, a.temperature_traitement,
        a.conditions_stockage, a.risques_securite, a.epi_requis,
        a.composition, a.matieres_principales, a.notes,
        a.atelier_production_id, a.created_at,
        f.libelle AS famille_libelle, f.code AS famille_code,
        um.code AS unite_code, um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.actif = true
    `;
    const params = [];
    if (famille_id) { params.push(famille_id); q += ` AND a.famille_id = $${params.length}`; }
    if (type_article) { params.push(type_article); q += ` AND a.type_article = $${params.length}`; }
    // Exclure les matières premières de la liste Articles (elles ont leur propre module)
    if (exclure_mp === 'true') { q += ` AND a.type_article != 'matiere_premiere'`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (a.code ILIKE $${params.length} OR a.designation ILIKE $${params.length} OR COALESCE(a.fournisseur,'') ILIKE $${params.length})`;
    }
    q += ' GROUP BY a.id, f.libelle, f.code, um.code, um.libelle ORDER BY a.type_article, a.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/articles/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*,
        f.libelle AS famille_libelle,
        um.code AS unite_code, um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible), 0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id = a.famille_id
      LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, f.libelle, um.code, um.libelle
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Article introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/articles
router.post('/', auth, uploadFields, async (req, res) => {
  try {
    const d = req.body;
    if (!d.code || !d.designation) return res.status(400).json({ error: 'Code et désignation requis' });

    const fp = (name) => req.files?.[name]?.[0] ? `/uploads/articles/${req.files[name][0].filename}` : null;

    const { rows } = await db.query(`
      INSERT INTO articles (
        code, code_barre, designation,
        famille_id, unite_mesure_id, type_article, tracabilite_type, format_lot,
        longueur_mm, largeur_mm, hauteur_mm,
        poids_theorique_kg, poids_reel_kg, poids_mandrin_kg,
        couleur, epaisseur_mm, densite,
        cadence_theorique_kg_h, temps_reglage_min,
        prix_achat, prix_vente, prix_cession_interne,
        stock_mini, stock_maxi, delai_appro_jours,
        dlc_jours, dluo_jours,
        temperature_stockage_min, temperature_stockage_max, conditions_stockage,
        temperature_fusion, temperature_traitement,
        fournisseur, reference_fournisseur,
        allergenes, points_ccp, normes_iso, certifications,
        risques_securite, epi_requis,
        composition, matieres_principales, notes,
        atelier_production_id,
        fiche_technique_path, fiche_securite_path, plan_path, photo_path,
        actif
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49
      ) RETURNING *
    `, [
      d.code?.toUpperCase()?.trim(), d.code_barre||null, d.designation?.trim(),
      d.famille_id||null, d.unite_mesure_id||null,
      d.type_article||'produit_fini', d.tracabilite_type||'lot',
      d.format_lot||'LOT-YYYYMMDD-001',
      d.longueur_mm||null, d.largeur_mm||null, d.hauteur_mm||null,
      d.poids_theorique_kg||null, d.poids_reel_kg||null, d.poids_mandrin_kg||null,
      d.couleur||null, d.epaisseur_mm||null, d.densite||null,
      d.cadence_theorique_kg_h||null, d.temps_reglage_min||30,
      d.prix_achat||0, d.prix_vente||0, d.prix_cession_interne||0,
      d.stock_mini||0, d.stock_maxi||null, d.delai_appro_jours||0,
      d.dlc_jours||null, d.dluo_jours||null,
      d.temperature_stockage_min||null, d.temperature_stockage_max||null,
      d.conditions_stockage||null,
      d.temperature_fusion||null, d.temperature_traitement||null,
      d.fournisseur||null, d.reference_fournisseur||null,
      d.allergenes||null, d.points_ccp==='true'||false,
      d.normes_iso||null, d.certifications||null,
      d.risques_securite||null, d.epi_requis||null,
      (() => { try { return d.composition && d.composition !== '' ? JSON.parse(d.composition) : []; } catch { return []; } })(),
      (() => { try { return d.matieres_principales && d.matieres_principales !== '' ? JSON.parse(d.matieres_principales) : []; } catch { return []; } })(),
      d.notes||null,
      d.atelier_production_id||null,
      fp('fiche_technique'), fp('fiche_securite'), fp('plan'), fp('photo'),
      true
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `Code "${req.body.code}" déjà existant` });
    console.error('Article POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/articles/:id
router.put('/:id', auth, uploadFields, async (req, res) => {
  try {
    const d = req.body;
    const cols = [];
    const vals = [];
    const add = (col, val) => {
      if (val !== undefined) {
        vals.push(val === '' ? null : val);
        cols.push(`${col}=$${vals.length}`);
      }
    };
    const fp = (name) => req.files?.[name]?.[0] ? `/uploads/articles/${req.files[name][0].filename}` : undefined;

    add('designation', d.designation);
    add('famille_id', d.famille_id||null);
    add('unite_mesure_id', d.unite_mesure_id||null);
    add('type_article', d.type_article);
    add('couleur', d.couleur);
    add('fournisseur', d.fournisseur);
    add('poids_theorique_kg', d.poids_theorique_kg);
    add('poids_reel_kg', d.poids_reel_kg);
    add('cadence_theorique_kg_h', d.cadence_theorique_kg_h);
    add('prix_achat', d.prix_achat);
    add('prix_vente', d.prix_vente);
    add('prix_cession_interne', d.prix_cession_interne);
    add('stock_mini', d.stock_mini);
    add('normes_iso', d.normes_iso);
    add('actif', d.actif !== undefined ? (d.actif === 'true' || d.actif === true) : undefined);
    if (d.composition) add('composition', JSON.parse(d.composition));
    if (fp('fiche_technique')) add('fiche_technique_path', fp('fiche_technique'));
    if (fp('fiche_securite')) add('fiche_securite_path', fp('fiche_securite'));
    if (fp('photo')) add('photo_path', fp('photo'));
    vals.push(new Date()); cols.push(`updated_at=$${vals.length}`);
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE articles SET ${cols.join(',')} WHERE id=$${vals.length} RETURNING *`, vals
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE articles SET actif=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// Cette ligne sera ignorée - voir le fix inline ci-dessous
