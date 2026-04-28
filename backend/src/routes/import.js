const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const { auth, role } = require('../middleware/auth');

const upload = multer({ dest: '/tmp/naido-imports/' });

// POST /api/import/sage — Import fichier Excel Sage
router.post('/sage', auth, role('chef_atelier'), upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier Excel requis' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const wsOF = workbook.getWorksheet('OF') || workbook.worksheets[0];
    let nb_of = 0, nb_articles = 0;
    const erreurs = [];

    for (let i = 2; i <= wsOF.rowCount; i++) {
      const row = wsOF.getRow(i);
      const numero_of    = row.getCell(1).value;
      const client_code  = row.getCell(2).value;
      const client_nom   = row.getCell(3).value;
      const art_ref      = row.getCell(4).value;
      const art_nom      = row.getCell(5).value;
      const cadence      = row.getCell(6).value;
      const tps_reglage  = row.getCell(7).value;
      const quantite     = row.getCell(8).value;
      const date_livr    = row.getCell(9).value;

      if (!numero_of || !art_ref) continue;

      try {
        // Upsert client
        await db.query(`
          INSERT INTO clients (code_sage, nom) VALUES ($1,$2)
          ON CONFLICT (code_sage) DO UPDATE SET nom=EXCLUDED.nom
        `, [client_code?.toString(), client_nom?.toString()]);

        const clientRes = await db.query(
          'SELECT id FROM clients WHERE code_sage=$1', [client_code?.toString()]
        );

        // Upsert article
        await db.query(`
          INSERT INTO articles (reference, designation, cadence_heure, temps_reglage_min)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (reference) DO UPDATE SET
            designation=EXCLUDED.designation,
            cadence_heure=EXCLUDED.cadence_heure,
            temps_reglage_min=EXCLUDED.temps_reglage_min
        `, [art_ref?.toString(), art_nom?.toString(), parseFloat(cadence)||0, parseInt(tps_reglage)||30]);

        const artRes = await db.query(
          'SELECT id FROM articles WHERE reference=$1', [art_ref?.toString()]
        );

        // Calcul temps prévu
        const temps_prevu = Math.ceil(
          (parseFloat(quantite) / (parseFloat(cadence)||1) * 60) + parseInt(tps_reglage||30)
        );

        // Upsert OF
        await db.query(`
          INSERT INTO ordres_fabrication
            (numero_of, client_id, article_id, quantite_cible, date_livraison_prevue, temps_prevu_min)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (numero_of) DO UPDATE SET
            quantite_cible=EXCLUDED.quantite_cible,
            date_livraison_prevue=EXCLUDED.date_livraison_prevue
        `, [numero_of?.toString(), clientRes.rows[0].id, artRes.rows[0].id,
            parseFloat(quantite)||0, date_livr, temps_prevu]);

        nb_of++;
      } catch (rowErr) {
        erreurs.push(`Ligne ${i}: ${rowErr.message}`);
      }
    }

    // Enregistrer l'import
    await db.query(`
      INSERT INTO imports_sage (nom_fichier, nb_of_importes, nb_articles_importes, erreurs, importe_par)
      VALUES ($1,$2,$3,$4,$5)
    `, [req.file.originalname, nb_of, nb_articles, JSON.stringify(erreurs), req.user.id]);

    res.json({ succes: true, nb_of_importes: nb_of, erreurs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/import/historique
router.get('/historique', auth, role('chef_atelier'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT i.*, u.nom || ' ' || u.prenom AS importe_par_nom
      FROM imports_sage i JOIN utilisateurs u ON u.id = i.importe_par
      ORDER BY i.created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
