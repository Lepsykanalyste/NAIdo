const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { auth, role } = require('../middleware/auth');

// ── GÉNÉRATION RAPPORT PDF ────────────────────────────────────

async function genererRapportPDF(debut, fin, userId) {
  const dir = path.join(__dirname, '../../uploads/rapports');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `rapport-${debut}-${fin}.pdf`;
  const filepath = path.join(dir, filename);

  // Charger données
  const [trsData, rebusData, bilanData, alertesData] = await Promise.all([
    db.query(`SELECT * FROM vue_trs WHERE date_session BETWEEN $1 AND $2 ORDER BY date_session, machine_code`, [debut, fin]),
    db.query(`SELECT * FROM vue_trs WHERE date_session BETWEEN $1 AND $2 AND taux_rebus_pct > 0 ORDER BY taux_rebus_pct DESC LIMIT 10`, [debut, fin]),
    db.query(`SELECT * FROM vue_bilan_matiere WHERE date_jour BETWEEN $1 AND $2`, [debut, fin]),
    db.query(`SELECT COUNT(*) as total, type FROM alertes WHERE DATE(created_at) BETWEEN $1 AND $2 GROUP BY type`, [debut, fin]),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // En-tête
    doc.fillColor('#14532d').rect(0, 0, 595, 80).fill();
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('NAIdo — Rapport de Production', 50, 25);
    doc.fontSize(12).font('Helvetica')
       .text(`Période : ${debut} au ${fin}`, 50, 52);
    doc.text('Green Industry · Atelier 3', 50, 66);

    doc.fillColor('#000000').moveDown(3);

    // Résumé KPI
    const totalPoids = bilanData.rows.reduce((s, r) => s + parseFloat(r.produit_fini_kg || 0), 0);
    const totalDechets = bilanData.rows.reduce((s, r) => s + parseFloat(r.dechets_kg || 0), 0);
    const trsmoyen = trsData.rows.length > 0
      ? (trsData.rows.reduce((s, r) => s + parseFloat(r.trs_pct || 0), 0) / trsData.rows.length).toFixed(1)
      : 0;

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#14532d').text('Résumé de la période', 50, 100);
    doc.fontSize(10).font('Helvetica').fillColor('#000000');

    const kpis = [
      ['Production totale', `${totalPoids.toFixed(1)} kg`],
      ['Déchets totaux', `${totalDechets.toFixed(1)} kg`],
      ['TRS moyen', `${trsmoyen}%`],
      ['Taux de rebus moyen', totalPoids > 0 ? `${(totalDechets/totalPoids*100).toFixed(2)}%` : '0%'],
      ['Nombre de tickets', `${trsData.rows.reduce((s,r) => s + parseInt(r.nb_tickets||0), 0)}`],
    ];

    kpis.forEach(([label, val], i) => {
      const y = 120 + i * 22;
      doc.fillColor('#f0fdf4').rect(50, y, 495, 20).fill();
      doc.fillColor('#374151').text(label, 60, y + 5);
      doc.fillColor('#14532d').font('Helvetica-Bold').text(val, 400, y + 5);
      doc.font('Helvetica');
    });

    // TRS par machine
    doc.fillColor('#000000').moveDown();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#14532d').text('TRS par Machine', 50, 240);

    const headers = ['Date', 'Machine', 'Shift', 'TRS%', 'Rebus%', 'Poids net'];
    const colWidths = [70, 70, 70, 60, 60, 70];
    let x = 50, y = 260;

    doc.fillColor('#14532d').rect(50, y, 495, 16).fill();
    headers.forEach((h, i) => {
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(h, x, y + 4, { width: colWidths[i] });
      x += colWidths[i];
    });

    trsData.rows.slice(0, 15).forEach((row, idx) => {
      y += 16; x = 50;
      if (y > 700) { doc.addPage(); y = 50; }
      doc.fillColor(idx % 2 === 0 ? '#f9fef9' : '#ffffff').rect(50, y, 495, 16).fill();
      const vals = [row.date_session, row.machine_code, row.shift_nom, row.trs_pct + '%', row.taux_rebus_pct + '%', row.poids_net_total_kg + ' kg'];
      vals.forEach((v, i) => {
        const color = i === 3 && row.trs_pct < 70 ? '#dc2626' : i === 4 && row.taux_rebus_pct > 5 ? '#dc2626' : '#374151';
        doc.fillColor(color).fontSize(8).font('Helvetica').text(String(v || ''), x, y + 4, { width: colWidths[i] });
        x += colWidths[i];
      });
    });

    // Alertes
    if (alertesData.rows.length > 0) {
      y += 40;
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#14532d').text('Alertes déclenchées', 50, y);
      y += 20;
      alertesData.rows.forEach(a => {
        doc.fontSize(10).font('Helvetica').fillColor('#374151')
           .text(`• ${a.type.replace(/_/g,' ')} : ${a.total} occurrence(s)`, 60, y);
        y += 16;
      });
    }

    // Footer
    doc.fillColor('#9ca3af').fontSize(8)
       .text('© 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry', 50, 800, { align: 'center' });

    doc.end();
    stream.on('finish', async () => {
      await db.query(`
        INSERT INTO rapports (type, periode_debut, periode_fin, genere_par, pdf_path)
        VALUES ('hebdo', $1, $2, $3, $4)
      `, [debut, fin, userId, `/uploads/rapports/${filename}`]);
      resolve(`/uploads/rapports/${filename}`);
    });
    stream.on('error', reject);
  });
}

// ── GÉNÉRATION RAPPORT EXCEL ──────────────────────────────────

async function genererRapportExcel(debut, fin, userId) {
  const dir = path.join(__dirname, '../../uploads/rapports');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `rapport-${debut}-${fin}.xlsx`;
  const filepath = path.join(dir, filename);

  const [trsData, bilanData, rebusData] = await Promise.all([
    db.query(`SELECT * FROM vue_trs WHERE date_session BETWEEN $1 AND $2 ORDER BY date_session, machine_code`, [debut, fin]),
    db.query(`SELECT * FROM vue_bilan_matiere WHERE date_jour BETWEEN $1 AND $2`, [debut, fin]),
    db.query(`SELECT * FROM vue_trs WHERE date_session BETWEEN $1 AND $2 ORDER BY taux_rebus_pct DESC`, [debut, fin]),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NAIdo — SOPHOPSY';

  // Onglet TRS
  const wsTRS = wb.addWorksheet('TRS Machines');
  wsTRS.columns = [
    { header: 'Date', key: 'date_session', width: 12 },
    { header: 'Machine', key: 'machine_code', width: 12 },
    { header: 'Shift', key: 'shift_nom', width: 12 },
    { header: 'Temps prod (min)', key: 'temps_prod_min', width: 16 },
    { header: 'Temps arrêt (min)', key: 'temps_arret_min', width: 18 },
    { header: 'TRS (%)', key: 'trs_pct', width: 10 },
    { header: 'Poids net (kg)', key: 'poids_net_total_kg', width: 14 },
    { header: 'Déchets (kg)', key: 'poids_dechets_kg', width: 12 },
    { header: 'Rebus (%)', key: 'taux_rebus_pct', width: 10 },
  ];
  wsTRS.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsTRS.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  trsData.rows.forEach(r => {
    const row = wsTRS.addRow(r);
    if (r.trs_pct < 70) row.getCell('trs_pct').font = { color: { argb: 'FFDC2626' }, bold: true };
    if (r.taux_rebus_pct > 5) row.getCell('taux_rebus_pct').font = { color: { argb: 'FFDC2626' }, bold: true };
  });

  // Onglet Bilan Matière
  const wsBilan = wb.addWorksheet('Bilan Matière');
  wsBilan.columns = [
    { header: 'Date', key: 'date_jour', width: 12 },
    { header: 'Machine', key: 'machine_code', width: 12 },
    { header: 'OF', key: 'numero_of', width: 15 },
    { header: 'Article', key: 'article', width: 25 },
    { header: 'Matière entrée (kg)', key: 'matiere_entree_kg', width: 18 },
    { header: 'Produit fini (kg)', key: 'produit_fini_kg', width: 16 },
    { header: 'Déchets (kg)', key: 'dechets_kg', width: 12 },
    { header: 'Taux transfo (%)', key: 'taux_transformation_pct', width: 16 },
  ];
  wsBilan.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsBilan.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  bilanData.rows.forEach(r => wsBilan.addRow(r));

  // Onglet Rebus
  const wsRebus = wb.addWorksheet('Top Rebus');
  wsRebus.columns = [
    { header: 'Date', key: 'date_session', width: 12 },
    { header: 'Machine', key: 'machine_code', width: 12 },
    { header: 'Shift', key: 'shift_nom', width: 12 },
    { header: 'Rebus (%)', key: 'taux_rebus_pct', width: 12 },
    { header: 'Déchets (kg)', key: 'poids_dechets_kg', width: 14 },
  ];
  wsRebus.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsRebus.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  rebusData.rows.filter(r => r.taux_rebus_pct > 0).forEach(r => wsRebus.addRow(r));

  await wb.xlsx.writeFile(filepath);

  await db.query(`
    INSERT INTO rapports (type, periode_debut, periode_fin, genere_par, excel_path)
    VALUES ('hebdo', $1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `, [debut, fin, userId, `/uploads/rapports/${filename}`]);

  return `/uploads/rapports/${filename}`;
}

// ── ROUTES ────────────────────────────────────────────────────

// POST /api/rapports/generer
router.post('/generer', auth, role('chef_atelier', 'super_admin', 'directeur'), async (req, res) => {
  try {
    const { debut, fin } = req.body;
    const [pdfPath, excelPath] = await Promise.all([
      genererRapportPDF(debut, fin, req.user.id),
      genererRapportExcel(debut, fin, req.user.id),
    ]);
    res.json({ pdf_path: pdfPath, excel_path: excelPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports — Liste rapports générés
router.get('/', auth, role('chef_atelier', 'super_admin', 'directeur'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, u.nom || ' ' || u.prenom AS genere_par_nom
      FROM rapports r LEFT JOIN utilisateurs u ON u.id = r.genere_par
      ORDER BY r.created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports/:id/pdf
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT pdf_path FROM rapports WHERE id=$1', [req.params.id]);
    if (!rows.length || !rows[0].pdf_path) return res.status(404).json({ error: 'PDF non disponible' });
    res.download(path.join(__dirname, '../..', rows[0].pdf_path));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rapports/:id/excel
router.get('/:id/excel', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT excel_path FROM rapports WHERE id=$1', [req.params.id]);
    if (!rows.length || !rows[0].excel_path) return res.status(404).json({ error: 'Excel non disponible' });
    res.download(path.join(__dirname, '../..', rows[0].excel_path));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CRON : rapport automatique chaque lundi à 6h ──────────────
cron.schedule('0 6 * * 1', async () => {
  console.log('Génération rapport hebdomadaire automatique...');
  const fin = new Date();
  fin.setDate(fin.getDate() - 1);
  const debut = new Date(fin);
  debut.setDate(debut.getDate() - 6);
  const debutStr = debut.toISOString().split('T')[0];
  const finStr = fin.toISOString().split('T')[0];

  // Récupérer admin pour attribution
  const adminRes = await db.query(`SELECT id FROM utilisateurs WHERE login='admin' LIMIT 1`);
  const adminId = adminRes.rows[0]?.id;
  if (!adminId) return;

  try {
    await genererRapportPDF(debutStr, finStr, adminId);
    await genererRapportExcel(debutStr, finStr, adminId);
    console.log(`Rapport hebdo généré : ${debutStr} → ${finStr}`);
  } catch (err) {
    console.error('Erreur rapport hebdo:', err.message);
  }
});

// ── CRON : vérification alertes toutes les 10 min ─────────────
cron.schedule('*/10 * * * *', async () => {
  try {
    await db.query('SELECT verifier_alertes()');
  } catch (err) {
    console.error('Erreur vérification alertes:', err.message);
  }
});

module.exports = router;
