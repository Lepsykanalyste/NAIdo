const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { auth, role } = require('../middleware/auth');

// GET /api/rapports-journaliers
router.get('/', auth, async (req, res) => {
  try {
    const { date_debut, date_fin, atelier_id, statut } = req.query;
    let q = 'SELECT * FROM vue_rapports_journaliers WHERE 1=1';
    const params = [];
    if (date_debut) { params.push(date_debut); q += ` AND date_rapport>=$${params.length}`; }
    if (date_fin)   { params.push(date_fin);   q += ` AND date_rapport<=$${params.length}`; }
    if (atelier_id) { params.push(atelier_id); q += ` AND atelier_id=$${params.length}`; }
    if (statut)     { params.push(statut);     q += ` AND statut=$${params.length}`; }
    q += ' ORDER BY date_rapport DESC, created_at DESC LIMIT 100';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports-journaliers/today — Rapport du jour
router.get('/today', auth, async (req, res) => {
  try {
    const { atelier_id } = req.query;
    const params = [new Date().toISOString().split('T')[0]];
    let q = 'SELECT * FROM vue_rapports_journaliers WHERE date_rapport=$1';
    if (atelier_id) { params.push(atelier_id); q += ` AND atelier_id=$${params.length}`; }
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports-journaliers/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM vue_rapports_journaliers WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Rapport introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rapports-journaliers — Créer
router.post('/', auth, role('chef_atelier','operateur','super_admin'), async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      INSERT INTO rapports_journaliers (
        date_rapport, atelier_id, shift_id, chef_atelier_id,
        of_id, article_id, machine_id,
        qte_produite, poids_net_kg, poids_brut_kg,
        matiere_prevue_kg, matiere_reelle_kg,
        qte_dechets, poids_dechets_kg, motif_dechets,
        qte_pertes, poids_pertes_kg, motif_pertes,
        qte_rebus, poids_rebus_kg, motif_rebus,
        temps_prod_prevu_min, temps_prod_reel_min,
        temps_arret_min, temps_reglage_min,
        nb_operateurs, heures_travaillees,
        observations, problemes_rencontres, actions_correctives,
        statut
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
      ) RETURNING *
    `, [
      d.date_rapport || new Date().toISOString().split('T')[0],
      d.atelier_id, d.shift_id, req.user.id,
      d.of_id || null, d.article_id || null, d.machine_id || null,
      d.qte_produite || 0, d.poids_net_kg || 0, d.poids_brut_kg || 0,
      d.matiere_prevue_kg || 0, d.matiere_reelle_kg || 0,
      d.qte_dechets || 0, d.poids_dechets_kg || 0, d.motif_dechets,
      d.qte_pertes || 0, d.poids_pertes_kg || 0, d.motif_pertes,
      d.qte_rebus || 0, d.poids_rebus_kg || 0, d.motif_rebus,
      d.temps_prod_prevu_min || 0, d.temps_prod_reel_min || 0,
      d.temps_arret_min || 0, d.temps_reglage_min || 0,
      d.nb_operateurs || 0, d.heures_travaillees || 0,
      d.observations, d.problemes_rencontres, d.actions_correctives,
      'brouillon'
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rapports-journaliers/:id — Modifier
router.put('/:id', auth, role('chef_atelier','super_admin'), async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE rapports_journaliers SET
        qte_produite=$1, poids_net_kg=$2, poids_brut_kg=$3,
        matiere_prevue_kg=$4, matiere_reelle_kg=$5,
        qte_dechets=$6, poids_dechets_kg=$7, motif_dechets=$8,
        qte_pertes=$9, poids_pertes_kg=$10, motif_pertes=$11,
        qte_rebus=$12, poids_rebus_kg=$13, motif_rebus=$14,
        temps_prod_reel_min=$15, temps_arret_min=$16,
        nb_operateurs=$17, heures_travaillees=$18,
        observations=$19, problemes_rencontres=$20, actions_correctives=$21
      WHERE id=$22 RETURNING *
    `, [
      d.qte_produite, d.poids_net_kg, d.poids_brut_kg,
      d.matiere_prevue_kg, d.matiere_reelle_kg,
      d.qte_dechets, d.poids_dechets_kg, d.motif_dechets,
      d.qte_pertes, d.poids_pertes_kg, d.motif_pertes,
      d.qte_rebus, d.poids_rebus_kg, d.motif_rebus,
      d.temps_prod_reel_min, d.temps_arret_min,
      d.nb_operateurs, d.heures_travaillees,
      d.observations, d.problemes_rencontres, d.actions_correctives,
      req.params.id
    ]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rapports-journaliers/:id/soumettre
router.put('/:id/soumettre', auth, async (req, res) => {
  try {
    await db.query("UPDATE rapports_journaliers SET statut='soumis' WHERE id=$1 AND statut='brouillon'", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rapports-journaliers/:id/valider
router.put('/:id/valider', auth, role('chef_atelier','directeur','super_admin'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE rapports_journaliers SET statut='valide', valide_par=$1, valide_at=NOW()
      WHERE id=$2 RETURNING *
    `, [req.user.id, req.params.id]);

    // Générer PDF
    const pdfPath = await genererRapportJournalierPDF(rows[0]);
    await db.query('UPDATE rapports_journaliers SET pdf_path=$1 WHERE id=$2', [pdfPath, req.params.id]);

    res.json({ success: true, pdf_path: pdfPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/rapports-journaliers/:id/rejeter
router.put('/:id/rejeter', auth, role('chef_atelier','directeur','super_admin'), async (req, res) => {
  try {
    await db.query(`
      UPDATE rapports_journaliers SET statut='rejete', valide_par=$1, valide_at=NOW()
      WHERE id=$2
    `, [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports-journaliers/:id/pdf
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT pdf_path FROM rapports_journaliers WHERE id=$1', [req.params.id]);
    if (!rows.length || !rows[0].pdf_path) return res.status(404).json({ error: 'PDF non disponible' });
    res.download(path.join(__dirname, '../..', rows[0].pdf_path));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports-journaliers/stats/periode — Statistiques
router.get('/stats/periode', auth, async (req, res) => {
  try {
    const { debut, fin, atelier_id } = req.query;
    const params = [debut || new Date().toISOString().split('T')[0],
                    fin   || new Date().toISOString().split('T')[0]];
    let q = `
      SELECT
        atelier_id, atelier_nom,
        COUNT(*) AS nb_rapports,
        SUM(poids_net_kg) AS total_poids_net,
        SUM(poids_dechets_kg) AS total_dechets,
        SUM(poids_pertes_kg) AS total_pertes,
        SUM(poids_rebus_kg) AS total_rebus,
        SUM(matiere_reelle_kg) AS total_matiere,
        ROUND(AVG(trs_calcule),2) AS trs_moyen,
        ROUND(AVG(taux_rebus_calcule),2) AS rebus_moyen,
        ROUND(AVG(rendement_matiere_pct),2) AS rendement_moyen,
        SUM(temps_prod_reel_min) AS temps_prod_total,
        SUM(temps_arret_min) AS temps_arret_total
      FROM vue_rapports_journaliers
      WHERE date_rapport BETWEEN $1 AND $2
        AND statut IN ('valide','soumis')
    `;
    if (atelier_id) { params.push(atelier_id); q += ` AND atelier_id=$${params.length}`; }
    q += ' GROUP BY atelier_id, atelier_nom ORDER BY total_poids_net DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Génération PDF rapport journalier
async function genererRapportJournalierPDF(rapport) {
  const dir = path.join(__dirname, '../../uploads/rapports-journaliers');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `RJ-${rapport.numero_rapport}.pdf`;
  const filepath = path.join(dir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // En-tête vert
    doc.fillColor('#14532d').rect(0, 0, 595, 90).fill();
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold')
       .text('RAPPORT JOURNALIER DE PRODUCTION', 50, 18);
    doc.fontSize(11).font('Helvetica')
       .text(`${rapport.atelier_nom || 'Atelier'}`, 50, 45)
       .text(`N° ${rapport.numero_rapport}`, 400, 18)
       .text(`Date : ${new Date(rapport.date_rapport).toLocaleDateString('fr-FR')}`, 400, 35)
       .text(`Statut : ${rapport.statut.toUpperCase()}`, 400, 52);

    doc.fillColor('#000');

    // KPI principaux
    const kpis = [
      ['Production nette', `${rapport.poids_net_kg} kg`, '#15803d'],
      ['Matière consommée', `${rapport.matiere_reelle_kg} kg`, '#1d4ed8'],
      ['Déchets', `${rapport.poids_dechets_kg} kg`, '#d97706'],
      ['Pertes', `${rapport.poids_pertes_kg} kg`, '#dc2626'],
      ['Rebus', `${rapport.poids_rebus_kg} kg`, '#7c3aed'],
      ['TRS', `${rapport.trs_calcule}%`, rapport.trs_calcule >= 80 ? '#15803d' : '#dc2626'],
      ['Taux rebus', `${rapport.taux_rebus_calcule}%`, rapport.taux_rebus_calcule > 5 ? '#dc2626' : '#15803d'],
      ['Rendement matière', `${rapport.rendement_matiere_pct}%`, '#0369a1'],
    ];

    let x = 50, y = 110;
    kpis.forEach((k, i) => {
      if (i % 4 === 0 && i > 0) { x = 50; y += 55; }
      doc.fillColor('#f0fdf4').rect(x, y, 115, 44).fill();
      doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text(k[0], x+6, y+6, { width: 103 });
      doc.fillColor(k[2]).fontSize(16).font('Helvetica-Bold').text(k[1], x+6, y+20);
      x += 125;
    });

    y += 70;

    // Temps
    doc.fillColor('#374151').fontSize(11).font('Helvetica-Bold').text('Temps', 50, y);
    y += 16;
    const temps = [
      ['Production prévu', `${rapport.temps_prod_prevu_min} min`],
      ['Production réel', `${rapport.temps_prod_reel_min} min`],
      ['Arrêts', `${rapport.temps_arret_min} min`],
      ['Réglage', `${rapport.temps_reglage_min} min`],
      ['Opérateurs', `${rapport.nb_operateurs}`],
      ['Heures travaillées', `${rapport.heures_travaillees} h`],
    ];
    temps.forEach(([label, val]) => {
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(label + ' :', 50, y);
      doc.fillColor('#374151').font('Helvetica-Bold').text(val, 200, y);
      y += 14;
    });

    y += 10;

    // Observations
    if (rapport.observations) {
      doc.fillColor('#374151').fontSize(11).font('Helvetica-Bold').text('Observations', 50, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text(rapport.observations, 50, y, { width: 495 });
      y += doc.heightOfString(rapport.observations, { width: 495 }) + 10;
    }

    // Problèmes
    if (rapport.problemes_rencontres) {
      doc.fillColor('#dc2626').fontSize(11).font('Helvetica-Bold').text('Problèmes rencontrés', 50, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text(rapport.problemes_rencontres, 50, y, { width: 495 });
      y += doc.heightOfString(rapport.problemes_rencontres, { width: 495 }) + 10;
    }

    // Actions correctives
    if (rapport.actions_correctives) {
      doc.fillColor('#15803d').fontSize(11).font('Helvetica-Bold').text('Actions correctives', 50, y);
      y += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text(rapport.actions_correctives, 50, y, { width: 495 });
      y += doc.heightOfString(rapport.actions_correctives, { width: 495 }) + 20;
    }

    // Zone signature
    if (y > 680) { doc.addPage(); y = 50; }
    doc.fillColor('#f0fdf4').rect(45, y, 505, 70).fill();
    doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold')
       .text('Chef Atelier :', 60, y + 10).text('Validé par :', 280, y + 10);
    doc.font('Helvetica').fontSize(9)
       .text('Nom & Signature :', 60, y + 50).text('Nom & Signature :', 280, y + 50);

    doc.fontSize(7).fillColor('#9ca3af')
       .text('© 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry', 50, 810, { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(`/uploads/rapports-journaliers/${filename}`));
    stream.on('error', reject);
  });
}

module.exports = router;
