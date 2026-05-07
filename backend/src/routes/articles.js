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
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
const uploadFields = upload.fields([
  { name:'fiche_technique', maxCount:1 },
  { name:'fiche_securite', maxCount:1 },
  { name:'plan', maxCount:1 },
  { name:'photo', maxCount:1 }
]);

// Parser JSON sécurisé - accepte string, array, undefined
const safeJSON = (val, fallback=[]) => {
  if (val === null || val === undefined || val === '' || val === 'undefined' || val === 'null') return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

const num = (v) => (v===''||v===null||v===undefined) ? null : (parseFloat(v)||null);
const numD = (v, d=0) => (v===''||v===null||v===undefined) ? d : (parseFloat(v)||d);
const fp = (req, name) => req.files?.[name]?.[0] ? `/uploads/articles/${req.files[name][0].filename}` : null;

// GET /api/articles
router.get('/', auth, async (req, res) => {
  try {
    const { famille_id, type_article, search, exclure_mp } = req.query;
    let q = `
      SELECT a.id, a.code, a.designation, a.couleur, a.type_article,
        a.poids_theorique_kg, a.poids_reel_kg, a.cadence_theorique_kg_h,
        a.temps_reglage_min, a.prix_achat, a.prix_vente, a.prix_cession_interne,
        a.stock_mini, a.tracabilite_type, a.format_lot, a.actif,
        a.longueur_mm, a.largeur_mm, a.hauteur_mm,
        a.photo_path, a.fiche_technique_path, a.fiche_securite_path,
        a.dlc_jours, a.points_ccp, a.normes_iso, a.certifications,
        a.fournisseur, a.reference_fournisseur, a.densite,
        a.temperature_fusion, a.temperature_traitement,
        a.conditions_stockage, a.risques_securite, a.epi_requis,
        a.composition, a.notes, a.atelier_production_id,
        a.famille_id, a.sous_famille_id, a.unite_mesure_id, a.created_at,
        f.libelle AS famille_libelle, f.code AS famille_code,
        sf.libelle AS groupe_libelle, sf.code AS groupe_code,
        um.code AS unite_code, um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible),0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id=a.famille_id
      LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id=a.id
      WHERE a.actif=true
    `;
    const params = [];
    if (exclure_mp==='true') q += ` AND a.type_article!='matiere_premiere'`;
    if (famille_id) { params.push(famille_id); q+=` AND a.famille_id=$${params.length}`; }
    if (type_article) { params.push(type_article); q+=` AND a.type_article=$${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q+=` AND (a.code ILIKE $${params.length} OR a.designation ILIKE $${params.length} OR COALESCE(a.fournisseur,'') ILIKE $${params.length})`;
    }
    q+=' GROUP BY a.id,f.libelle,f.code,um.code,um.libelle ORDER BY a.type_article,a.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(err) { console.error('GET articles:',err.message); res.status(500).json({ error:err.message }); }
});

// GET /api/articles/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, f.libelle AS famille_libelle,
        um.code AS unite_code, um.libelle AS unite_libelle,
        COALESCE(SUM(sa.qte_disponible),0) AS stock_total
      FROM articles a
      LEFT JOIN familles_articles f ON f.id=a.famille_id
      LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
      LEFT JOIN stock_articles sa ON sa.article_id=a.id
      WHERE a.id=$1
      GROUP BY a.id,f.libelle,um.code,um.libelle
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error:'Article introuvable' });
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error:err.message }); }
});

// POST /api/articles - accepte JSON et multipart
const handleUploadOrJSON = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return uploadFields(req, res, next);
  }
  next(); // JSON : express.json() déjà parsé en amont
};

router.post('/', auth, handleUploadOrJSON, async (req, res) => {
  try {
    const d = req.body;
    if (!d.code||!d.designation) return res.status(400).json({ error:'Code et désignation requis' });

    const { rows } = await db.query(`
      INSERT INTO articles (
        code,code_barre,designation,
        famille_id,unite_mesure_id,type_article,tracabilite_type,format_lot,
        longueur_mm,largeur_mm,hauteur_mm,
        poids_theorique_kg,poids_reel_kg,poids_mandrin_kg,
        couleur,epaisseur_mm,densite,
        cadence_theorique_kg_h,temps_reglage_min,
        prix_achat,prix_vente,prix_cession_interne,
        stock_mini,stock_maxi,delai_appro_jours,
        dlc_jours,dluo_jours,
        temperature_stockage_min,temperature_stockage_max,conditions_stockage,
        temperature_fusion,temperature_traitement,
        fournisseur,reference_fournisseur,
        allergenes,points_ccp,normes_iso,certifications,
        risques_securite,epi_requis,
        composition,notes,
        atelier_production_id,
        fiche_technique_path,fiche_securite_path,plan_path,photo_path,
        actif
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48
      ) RETURNING id,code,designation,type_article
    `, [
      d.code?.toUpperCase()?.trim(), d.code_barre||null, d.designation?.trim(),
      (d.famille_id&&d.famille_id!=='')?parseInt(d.famille_id)||null:null, (d.unite_mesure_id&&d.unite_mesure_id!=='')?parseInt(d.unite_mesure_id)||null:null,
      d.type_article||'produit_fini', d.tracabilite_type||'lot', d.format_lot||'LOT-YYYYMMDD-001',
      num(d.longueur_mm), num(d.largeur_mm), num(d.hauteur_mm),
      num(d.poids_theorique_kg), num(d.poids_reel_kg), num(d.poids_mandrin_kg),
      d.couleur||null, num(d.epaisseur_mm), num(d.densite),
      num(d.cadence_theorique_kg_h), numD(d.temps_reglage_min,30),
      numD(d.prix_achat,0), numD(d.prix_vente,0), numD(d.prix_cession_interne,0),
      numD(d.stock_mini,0), num(d.stock_maxi), numD(d.delai_appro_jours,0),
      num(d.dlc_jours), num(d.dluo_jours),
      num(d.temperature_stockage_min), num(d.temperature_stockage_max), d.conditions_stockage||null,
      num(d.temperature_fusion), num(d.temperature_traitement),
      d.fournisseur||null, d.reference_fournisseur||null,
      d.allergenes||null, d.points_ccp==='true'||d.points_ccp===true,
      d.normes_iso||null, d.certifications||null,
      d.risques_securite||null, d.epi_requis||null,
      (() => { const v = safeJSON(d.composition,[]); return Array.isArray(v)?v:[]; })(),
      d.notes||null,
      (d.atelier_production_id && d.atelier_production_id !== '') ? (parseInt(d.atelier_production_id)||null) : null,
      fp(req,'fiche_technique'), fp(req,'fiche_securite'), fp(req,'plan'), fp(req,'photo'),
      true
    ]);
    res.status(201).json(rows[0]);
  } catch(err) {
    console.error('POST article ERROR:',err.message,'| composition type:',typeof req.body?.composition, '| val:',JSON.stringify(req.body?.composition)?.slice(0,50));
    if (err.code==='23505') return res.status(400).json({ error:`Code "${req.body?.code}" déjà existant` });
    res.status(500).json({ error:err.message });
  }
});

// PUT /api/articles/:id

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

router.put('/:id', auth, handleUploadOrJSON, async (req, res) => {
  try {
    const d = req.body;
    const sets=[], vals=[];
    const add = (col,val) => { vals.push(val); sets.push(`${col}=$${vals.length}`); };
    const addIf = (col,val,transform=v=>v) => { if(val!==undefined) add(col,transform(val)); };

    addIf('designation',d.designation);
    // famille_id et unite_mesure_id gérés plus bas avec parseInt
    addIf('type_article',d.type_article);
    addIf('couleur',d.couleur,v=>v||null);
    addIf('fournisseur',d.fournisseur,v=>v||null);
    addIf('reference_fournisseur',d.reference_fournisseur,v=>v||null);
    addIf('poids_theorique_kg',d.poids_theorique_kg,num);
    addIf('poids_reel_kg',d.poids_reel_kg,num);
    addIf('cadence_theorique_kg_h',d.cadence_theorique_kg_h,num);
    addIf('temps_reglage_min',d.temps_reglage_min,v=>numD(v,30));
    addIf('prix_achat',d.prix_achat,v=>numD(v,0));
    addIf('prix_vente',d.prix_vente,v=>numD(v,0));
    addIf('prix_cession_interne',d.prix_cession_interne,v=>numD(v,0));
    addIf('stock_mini',d.stock_mini,v=>numD(v,0));
    addIf('normes_iso',d.normes_iso,v=>v||null);
    addIf('certifications',d.certifications,v=>v||null);
    addIf('risques_securite',d.risques_securite,v=>v||null);
    addIf('epi_requis',d.epi_requis,v=>v||null);
    addIf('conditions_stockage',d.conditions_stockage,v=>v||null);
    addIf('notes',d.notes,v=>v||null);
    addIf('atelier_production_id',d.atelier_production_id,v=>v===''||v===null||v===undefined?null:parseInt(v)||null);
    addIf('famille_id',d.famille_id,v=>v===''||v===null?null:parseInt(v)||null);
    addIf('unite_mesure_id',d.unite_mesure_id,v=>v===''||v===null?null:parseInt(v)||null);
    // composition + matieres_principales : forcer en objet JS (JSONB)
    const compoVal = safeJSON(d.composition, []);
    add('composition', compoVal);
    if (d.matieres_principales !== undefined) {
      add('matieres_principales', safeJSON(d.matieres_principales, []));
    }
    addIf('actif',d.actif,v=>v==='true'||v===true);
    if(fp(req,'fiche_technique')) add('fiche_technique_path',fp(req,'fiche_technique'));
    if(fp(req,'fiche_securite')) add('fiche_securite_path',fp(req,'fiche_securite'));
    if(fp(req,'photo')) add('photo_path',fp(req,'photo'));
    add('updated_at',new Date());
    // ID mis directement dans la requête SQL - évite le bug Markdown SSH
    const articleId = String(req.params.id);
    const { rows } = await db.query(
      `UPDATE articles SET ${sets.join(',')} WHERE id='${articleId}' RETURNING id,code,designation`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error:'Article introuvable' });
    res.json(rows[0]);
  } catch(err) { console.error('PUT article ERROR:',err.message, '| body keys:', Object.keys(req.body||{})); res.status(500).json({ error:err.message }); }
});

// DELETE /api/articles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE articles SET actif=false WHERE id=$1',[req.params.id]);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

module.exports = router;
