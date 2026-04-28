const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { auth, role } = require('../middleware/auth');

// Config upload photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/qualite');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/qualite — Créer un contrôle
router.post('/', auth, role('qualite', 'chef_atelier'), upload.array('photos', 10), async (req, res) => {
  try {
    const { of_id, session_id, decision, notes, signature_base64, quantite_approuvee, quantite_rejetee } = req.body;
    const photos = (req.files || []).map(f => `/uploads/qualite/${f.filename}`);

    const { rows } = await db.query(`
      INSERT INTO controles_qualite
        (of_id, controleur_id, session_id, decision, notes,
         photos, signature_base64, signature_at,
         quantite_approuvee, quantite_rejetee)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9)
      RETURNING *
    `, [of_id, req.user.id, session_id, decision, notes,
        JSON.stringify(photos), signature_base64,
        quantite_approuvee || 0, quantite_rejetee || 0]);

    const controle = rows[0];

    // Si approuvé → incrémenter stock produits finis
    if (decision === 'approuve' && quantite_approuvee > 0) {
      const ofRes = await db.query(
        'SELECT article_id FROM ordres_fabrication WHERE id=$1', [of_id]
      );
      await db.query(`
        INSERT INTO stock_produits_finis (article_id, of_id, controle_id, quantite)
        VALUES ($1,$2,$3,$4)
      `, [ofRes.rows[0].article_id, of_id, controle.id, quantite_approuvee]);
    }

    // Générer PDF
    const pdfPath = await genererPDFQualite(controle, req);
    await db.query(
      'UPDATE controles_qualite SET pdf_path=$1, pdf_genere_at=NOW() WHERE id=$2',
      [pdfPath, controle.id]
    );

    res.status(201).json({ ...controle, pdf_path: pdfPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/qualite/of/:of_id
router.get('/of/:of_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cq.*, u.nom || ' ' || u.prenom AS controleur_nom
      FROM controles_qualite cq
      JOIN utilisateurs u ON u.id = cq.controleur_id
      WHERE cq.of_id = $1 ORDER BY cq.created_at DESC
    `, [req.params.of_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/qualite/:id/pdf — Télécharger le PDF
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT pdf_path FROM controles_qualite WHERE id=$1', [req.params.id]
    );
    if (!rows.length || !rows[0].pdf_path)
      return res.status(404).json({ error: 'PDF non disponible' });
    const filePath = path.join(__dirname, '../..', rows[0].pdf_path);
    res.download(filePath);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function genererPDFQualite(controle, req) {
  return new Promise((resolve, reject) => {
    const dir = path.join(__dirname, '../../uploads/pdf');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `qualite-${controle.id}.pdf`;
    const filepath = path.join(dir, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(18).text('GREEN INDUSTRY - NAI', { align: 'center' });
    doc.fontSize(14).text('FICHE CONTRÔLE QUALITÉ - ATELIER 3', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date : ${new Date(controle.created_at).toLocaleString('fr-FR')}`);
    doc.text(`OF : ${controle.of_id}`);
    doc.text(`Décision : ${controle.decision.toUpperCase()}`);
    doc.text(`Qté approuvée : ${controle.quantite_approuvee} kg`);
    doc.text(`Qté rejetée : ${controle.quantite_rejetee} kg`);
    if (controle.notes) doc.text(`Notes : ${controle.notes}`);

    // Signature
    if (controle.signature_base64) {
      doc.moveDown();
      doc.text('Signature du contrôleur :');
      const imgData = controle.signature_base64.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(imgData, 'base64');
      doc.image(imgBuffer, { width: 200 });
    }

    doc.end();
    stream.on('finish', () => resolve(`/uploads/pdf/${filename}`));
    stream.on('error', reject);
  });
}

module.exports = router;
