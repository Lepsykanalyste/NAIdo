const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, role } = require('../middleware/auth');

const upload = multer({
  dest: '/tmp/naido-uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /api/nc
router.get('/', auth, async (req, res) => {
  try {
    const { statut, gravite, type, atelier_id } = req.query;
    let q = `
      SELECT nc.*,
        at.libelle AS atelier_libelle,
        a.code AS article_code, a.designation AS article_designation,
        o.numero_of,
        u1.nom||' '||u1.prenom AS detecte_par_nom,
        u2.nom||' '||u2.prenom AS responsable_nom
      FROM non_conformites nc
      LEFT JOIN ateliers at ON at.id = nc.atelier_id
      LEFT JOIN articles a ON a.id = nc.article_id
      LEFT JOIN ordres_fabrication o ON o.id = nc.of_id
      LEFT JOIN utilisateurs u1 ON u1.id = nc.detecte_par
      LEFT JOIN utilisateurs u2 ON u2.id = nc.responsable_traitement
      WHERE 1=1
    `;
    const params = [];
    if (statut)     { params.push(statut);     q += ` AND nc.statut=$${params.length}`; }
    if (gravite)    { params.push(gravite);    q += ` AND nc.gravite=$${params.length}`; }
    if (type)       { params.push(type);       q += ` AND nc.type=$${params.length}`; }
    if (atelier_id) { params.push(atelier_id); q += ` AND nc.atelier_id=$${params.length}`; }
    q += ' ORDER BY nc.created_at DESC LIMIT 100';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/nc/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vue_qhse_dashboard');
    const { rows: par_gravite } = await db.query(`
      SELECT gravite, COUNT(*) AS nb
      FROM non_conformites WHERE statut!='clos'
      GROUP BY gravite ORDER BY gravite
    `);
    const { rows: par_type } = await db.query(`
      SELECT type, COUNT(*) AS nb
      FROM non_conformites WHERE statut!='clos'
      GROUP BY type ORDER BY nb DESC
    `);
    const { rows: recentes } = await db.query(`
      SELECT nc.numero_nc, nc.titre, nc.gravite, nc.statut, nc.date_detection, at.libelle AS atelier
      FROM non_conformites nc
      LEFT JOIN ateliers at ON at.id = nc.atelier_id
      ORDER BY nc.created_at DESC LIMIT 5
    `);
    res.json({ kpi: rows[0], par_gravite, par_type, recentes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/nc/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT nc.*,
        at.libelle AS atelier_libelle,
        a.code AS article_code, a.designation AS article_designation,
        o.numero_of,
        u1.nom||' '||u1.prenom AS detecte_par_nom,
        u2.nom||' '||u2.prenom AS responsable_nom
      FROM non_conformites nc
      LEFT JOIN ateliers at ON at.id = nc.atelier_id
      LEFT JOIN articles a ON a.id = nc.article_id
      LEFT JOIN ordres_fabrication o ON o.id = nc.of_id
      LEFT JOIN utilisateurs u1 ON u1.id = nc.detecte_par
      LEFT JOIN utilisateurs u2 ON u2.id = nc.responsable_traitement
      WHERE nc.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'NC introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/nc
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const d = req.body;
    const photos = (req.files || []).map(f => {
      const dest = path.join(__dirname, '../../uploads/nc', f.filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(f.path, dest);
      return `/uploads/nc/${f.filename}`;
    });

    const { rows } = await db.query(`
      INSERT INTO non_conformites (
        type, gravite, atelier_id, of_id, article_id, machine_id,
        titre, description, causes_identifiees,
        qte_impactee, valeur_impactee,
        action_immediate, action_corrective, action_preventive,
        detecte_par, responsable_traitement,
        gravite_amdec, occurrence_amdec, detectabilite_amdec,
        photos, date_detection
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [
      d.type, d.gravite || 'mineure',
      d.atelier_id || null, d.of_id || null, d.article_id || null, d.machine_id || null,
      d.titre, d.description, d.causes_identifiees,
      d.qte_impactee || null, d.valeur_impactee || null,
      d.action_immediate, d.action_corrective, d.action_preventive,
      req.user.id, d.responsable_traitement || null,
      d.gravite_amdec || null, d.occurrence_amdec || null, d.detectabilite_amdec || null,
      JSON.stringify(photos), d.date_detection || new Date().toISOString().split('T')[0]
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/nc/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE non_conformites SET
        statut=COALESCE($1,statut),
        action_corrective=COALESCE($2,action_corrective),
        action_preventive=COALESCE($3,action_preventive),
        causes_identifiees=COALESCE($4,causes_identifiees),
        responsable_traitement=COALESCE($5,responsable_traitement),
        gravite_amdec=COALESCE($6,gravite_amdec),
        occurrence_amdec=COALESCE($7,occurrence_amdec),
        detectabilite_amdec=COALESCE($8,detectabilite_amdec),
        date_cloture=CASE WHEN $1='clos' THEN CURRENT_DATE ELSE date_cloture END
      WHERE id=$9 RETURNING *
    `, [d.statut, d.action_corrective, d.action_preventive, d.causes_identifiees,
        d.responsable_traitement, d.gravite_amdec, d.occurrence_amdec, d.detectabilite_amdec,
        req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
