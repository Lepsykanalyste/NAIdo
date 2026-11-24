'use strict';
// NAIdo - photo de profil de chaque utilisateur (fichier dans uploads/profils, servi par /uploads, donc reserve aux connectes)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const DIR = path.join(__dirname, '../../uploads/profils');
const EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(DIR, { recursive: true }); cb(null, DIR); },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, EXT.includes(path.extname(file.originalname).toLowerCase())),
});

router.get('/moi', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT photo_path FROM utilisateurs WHERE id = $1', [req.user.id]);
    res.json({ photo: rows[0]?.photo_path || null });
  } catch (e) { console.error('[PROFIL]', e.message); res.status(500).json({ error: 'Lecture impossible' }); }
});

router.post('/photo', auth, (req, res) => {
  upload.single('photo')(req, res, async (e) => {
    if (e) return res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (2 Mo maximum)' : e.message });
    if (!req.file) return res.status(400).json({ error: 'Photo manquante ou format non accepté (jpg, png, webp)' });
    try {
      const chemin = '/uploads/profils/' + req.file.filename;
      const { rows } = await db.query('SELECT photo_path FROM utilisateurs WHERE id = $1', [req.user.id]);
      await db.query('UPDATE utilisateurs SET photo_path = $1 WHERE id = $2', [chemin, req.user.id]);
      const ancienne = rows[0]?.photo_path;
      if (ancienne && ancienne.startsWith('/uploads/profils/')) fs.unlink(path.join(__dirname, '../..', ancienne), () => {});
      res.json({ ok: true, photo: chemin });
    } catch (err) { console.error('[PROFIL]', err.message); res.status(500).json({ error: 'Enregistrement impossible' }); }
  });
});


// Signature de la personne : image (png, jpg, webp), 1 Mo maximum ; utilisee sur les bons et documents
const uploadSignature = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(__dirname, '../../uploads/signatures'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, EXT.includes(path.extname(file.originalname).toLowerCase())),
});

router.post('/signature', auth, (req, res) => {
  uploadSignature.single('signature')(req, res, async (e) => {
    if (e) return res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'Signature trop lourde (1 Mo maximum)' : e.message });
    if (!req.file) return res.status(400).json({ error: 'Image manquante ou format non accepté (png, jpg, webp)' });
    try {
      const chemin = '/uploads/signatures/' + req.file.filename;
      const { rows } = await db.query('SELECT signature_path FROM utilisateurs WHERE id = $1', [req.user.id]);
      await db.query('UPDATE utilisateurs SET signature_path = $1 WHERE id = $2', [chemin, req.user.id]);
      const ancienne = rows[0]?.signature_path;
      if (ancienne && ancienne.startsWith('/uploads/signatures/')) fs.unlink(path.join(__dirname, '../..', ancienne), () => {});
      res.json({ ok: true, signature: chemin });
    } catch (err) { console.error('[PROFIL]', err.message); res.status(500).json({ error: 'Enregistrement impossible' }); }
  });
});

router.get('/signature/moi', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT signature_path FROM utilisateurs WHERE id = $1', [req.user.id]);
    res.json({ signature: rows[0]?.signature_path || null });
  } catch (e) { res.status(500).json({ error: 'Lecture impossible' }); }
});
module.exports = router;
