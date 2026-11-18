// ============================================================
// NAIdo — envoi des fichiers d'un article (fiche technique, fiche de securite, photo)
// Fichier : backend/src/routes/fichiers_article.js  (monte sur /api/fichiers-article)
//   POST /api/fichiers-article/:id   (multipart : fiche_technique, fiche_securite, photo)
// Les fichiers sont ranges dans uploads/articles et servis sous /uploads/articles/...
// Cette route existe a part car /api/articles est traite par le backend Python (JSON seulement).
// ============================================================
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIR = path.join(__dirname, '../../uploads/articles');
const EXT = { fiche_technique: ['.pdf', '.doc', '.docx'], fiche_securite: ['.pdf', '.doc', '.docx'], photo: ['.jpg', '.jpeg', '.png', '.webp'] };
const COLONNE = { fiche_technique: 'fiche_technique_path', fiche_securite: 'fiche_securite_path', photo: 'photo_path' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(DIR, { recursive: true }); cb(null, DIR); },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const ok = (EXT[file.fieldname] || []).includes(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error(`Format non accepte pour ${file.fieldname} (${(EXT[file.fieldname] || ['champ inconnu']).join(', ')})`));
  }
}).fields([{ name: 'fiche_technique', maxCount: 1 }, { name: 'fiche_securite', maxCount: 1 }, { name: 'photo', maxCount: 1 }]);

router.post('/:id', auth, (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  upload(req, res, async (e) => {
    if (e) return res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop gros (20 Mo maximum)' : e.message });
    try {
      const sets = [], vals = [], chemins = {};
      for (const champ of Object.keys(COLONNE)) {
        const f = req.files?.[champ]?.[0];
        if (!f) continue;
        const url = `/uploads/articles/${f.filename}`;
        vals.push(url); sets.push(`${COLONNE[champ]}=$${vals.length}`); chemins[COLONNE[champ]] = url;
      }
      if (!sets.length) return res.status(400).json({ error: 'Aucun fichier recu' });
      vals.push(req.params.id);
      const r = await db.query(`UPDATE articles SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id`, vals);
      if (!r.rows.length) return res.status(404).json({ error: 'Article introuvable' });
      res.json({ ok: true, ...chemins });
    } catch (err) { console.error('[FICHIERS-ARTICLE]', err.message); res.status(500).json({ error: err.message }); }
  });
});

module.exports = router;
