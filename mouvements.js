const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { auth, role } = require('../middleware/auth');

// GET /api/mouvements
router.get('/', auth, async (req, res) => {
  try {
    const { type_mouvement, statut, atelier_id, date_debut, date_fin } = req.query;
    let q = 'SELECT * FROM vue_mouvements WHERE 1=1';
    const params = [];
    if (type_mouvement) { params.push(type_mouvement); q += ` AND type_mouvement=$${params.length}`; }
    if (statut)         { params.push(statut);         q += ` AND statut=$${params.length}`; }
    if (atelier_id)     { params.push(atelier_id);     q += ` AND (atelier_source_id=$${params.length} OR atelier_dest_id=$${params.length})`; }
    if (date_debut)     { params.push(date_debut);     q += ` AND date_mouvement>=$${params.length}`; }
    if (date_fin)       { params.push(date_fin);       q += ` AND date_mouvement<=$${params.length}`; }
    q += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/mouvements/:id avec lignes
router.get('/:id', auth, async (req, res) => {
  try {
    const [mvt, lignes] = await Promise.all([
      db.query(`
        SELECT ms.*,
          as1.code AS source_code, as1.libelle AS source_libelle,
          as2.code AS dest_code, as2.libelle AS dest_libelle,
          u1.nom||' '||u1.prenom AS cree_par_nom,
          u2.nom||' '||u2.prenom AS valide_par_nom,
          u3.nom||' '||u3.prenom AS receptionne_par_nom
        FROM mouvements_stock ms
        LEFT JOIN ateliers as1 ON as1.id = ms.atelier_source_id
        LEFT JOIN ateliers as2 ON as2.id = ms.atelier_dest_id
        LEFT JOIN utilisateurs u1 ON u1.id = ms.cree_par
        LEFT JOIN utilisateurs u2 ON u2.id = ms.valide_par
        LEFT JOIN utilisateurs u3 ON u3.id = ms.receptionne_par
        WHERE ms.id=$1
      `, [req.params.id]),
      db.query(`
        SELECT lm.*, a.code AS article_code, a.designation, um.code AS unite_code,
          l.numero_lot
        FROM lignes_mouvement lm
        JOIN articles a ON a.id = lm.article_id
        LEFT JOIN unites_mesure um ON um.id = lm.unite_id
        LEFT JOIN lots_stock l ON l.id = lm.lot_id
        WHERE lm.mouvement_id=$1 ORDER BY lm.created_at
      `, [req.params.id])
    ]);
    if (!mvt.rows.length) return res.status(404).json({ error: 'Mouvement introuvable' });
    res.json({ ...mvt.rows[0], lignes: lignes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/mouvements — Créer un bon
router.post('/', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { type_mouvement, atelier_source_id, atelier_dest_id,
            emplacement_source_id, emplacement_dest_id,
            client_id, of_id, date_mouvement, notes, lignes } = req.body;

    // Créer le mouvement
    const { rows: [mvt] } = await client.query(`
      INSERT INTO mouvements_stock
        (type_mouvement, atelier_source_id, atelier_dest_id,
         emplacement_source_id, emplacement_dest_id, client_id, of_id,
         date_mouvement, notes, cree_par)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [type_mouvement, atelier_source_id, atelier_dest_id,
        emplacement_source_id||null, emplacement_dest_id||null, client_id||null, of_id||null,
        date_mouvement || new Date().toISOString().split('T')[0],
        notes, req.user.id]);

    // Créer les lignes
    for (const ligne of (lignes || [])) {
      await client.query(`
        INSERT INTO lignes_mouvement
          (mouvement_id, article_id, lot_id, qte_prevue, unite_id,
           poids_theorique_kg, prix_unitaire, montant_total)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [mvt.id, ligne.article_id, ligne.lot_id || null,
          ligne.qte_prevue, ligne.unite_id || null,
          ligne.poids_theorique_kg || null,
          ligne.prix_unitaire || 0,
          (ligne.qte_prevue * (ligne.prix_unitaire || 0))]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...mvt, nb_lignes: lignes?.length || 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/mouvements/:id/valider — Valider le bon
router.put('/:id/valider', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [mvt] } = await client.query(
      'SELECT * FROM mouvements_stock WHERE id=$1', [req.params.id]
    );
    if (!mvt) return res.status(404).json({ error: 'Mouvement introuvable' });
    if (mvt.statut !== 'brouillon') return res.status(400).json({ error: 'Mouvement déjà validé' });

    // Mettre à jour le mouvement
    await client.query(`
      UPDATE mouvements_stock SET statut='valide', valide_par=$1, date_validation=NOW()
      WHERE id=$2
    `, [req.user.id, req.params.id]);

    // Mettre à jour le stock
    const { rows: lignes } = await client.query(
      'SELECT * FROM lignes_mouvement WHERE mouvement_id=$1', [req.params.id]
    );

    for (const ligne of lignes) {
      // Sortie de la source
      if (mvt.emplacement_source_id) {
        await client.query(`
          INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible)
          VALUES ($1,$2,$3)
          ON CONFLICT (article_id, emplacement_id)
          DO UPDATE SET qte_disponible = stock_articles.qte_disponible - $3, derniere_sortie=NOW()
        `, [ligne.article_id, mvt.emplacement_source_id, ligne.qte_prevue]);
      }
      // Entrée à la destination
      if (mvt.emplacement_dest_id) {
        await client.query(`
          INSERT INTO stock_articles (article_id, emplacement_id, qte_disponible)
          VALUES ($1,$2,$3)
          ON CONFLICT (article_id, emplacement_id)
          DO UPDATE SET qte_disponible = stock_articles.qte_disponible + $3, derniere_entree=NOW()
        `, [ligne.article_id, mvt.emplacement_dest_id, ligne.qte_prevue]);
      }
    }

    await client.query('COMMIT');

    // Générer PDF
    const { rows: [mvtComplet] } = await db.query(
      'SELECT * FROM vue_mouvements WHERE id=$1', [req.params.id]
    );
    const pdfPath = await genererBonPDF(req.params.id, mvt, lignes);
    await db.query('UPDATE mouvements_stock SET pdf_path=$1 WHERE id=$2', [pdfPath, req.params.id]);

    res.json({ success: true, pdf_path: pdfPath });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/mouvements/:id/receptionner — Réception & confirmation quantités
router.put('/:id/receptionner', auth, async (req, res) => {
  try {
    const { lignes_recues } = req.body;
    const { rows: [mvt] } = await db.query(
      'SELECT * FROM mouvements_stock WHERE id=$1', [req.params.id]
    );
    if (!mvt || mvt.statut !== 'valide')
      return res.status(400).json({ error: 'Mouvement non validé ou introuvable' });

    // Mettre à jour quantités réelles
    for (const l of (lignes_recues || [])) {
      await db.query(
        'UPDATE lignes_mouvement SET qte_reelle=$1, poids_reel_kg=$2, motif_ecart=$3 WHERE id=$4',
        [l.qte_reelle, l.poids_reel_kg, l.motif_ecart, l.id]
      );
    }

    await db.query(`
      UPDATE mouvements_stock SET statut='receptionne', receptionne_par=$1, date_reception=NOW()
      WHERE id=$2
    `, [req.user.id, req.params.id]);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/mouvements/:id/pdf
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT pdf_path FROM mouvements_stock WHERE id=$1', [req.params.id]);
    if (!rows.length || !rows[0].pdf_path) return res.status(404).json({ error: 'PDF non disponible' });
    res.download(path.join(__dirname, '../..', rows[0].pdf_path));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Génération PDF bon de cession
async function genererBonPDF(id, mvt, lignes) {
  const dir = path.join(__dirname, '../../uploads/bons');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `bon-${mvt.numero_bon}.pdf`;
  const filepath = path.join(dir, filename);

  const typeLabel = {
    cession_atelier: 'BON DE CESSION',
    livraison_mp: 'BON DE LIVRAISON MATIÈRE',
    livraison_pf_interne: 'BON DE LIVRAISON INTERNE',
    reception_achat: 'BON DE RÉCEPTION',
    expedition_vente: "BON D'EXPÉDITION",
    retour_atelier: 'BON DE RETOUR',
  }[mvt.type_mouvement] || 'BON DE MOUVEMENT';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // En-tête
    doc.fillColor('#14532d').rect(0, 0, 595, 90).fill();
    doc.fillColor('#fff').fontSize(20).font('Helvetica-Bold')
       .text('GREEN INDUSTRY — NAI', 50, 20);
    doc.fontSize(14).text(typeLabel, 50, 45);
    doc.fontSize(11).font('Helvetica')
       .text(`N° ${mvt.numero_bon}`, 400, 20)
       .text(`Date : ${new Date(mvt.date_mouvement||mvt.created_at).toLocaleDateString('fr-FR')}`, 400, 38)
       .text(`Statut : ${mvt.statut.toUpperCase()}`, 400, 56);

    doc.fillColor('#000').moveDown(2);

    // Infos source/destination
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#14532d')
       .text('DE :', 50, 110).text('VERS :', 300, 110);
    doc.font('Helvetica').fillColor('#000')
       .text('Atelier Source', 50, 125)
       .text('Atelier Destination', 300, 125);

    // Tableau lignes
    const cols = [50, 200, 310, 390, 460, 530];
    const headers = ['Article', 'Désignation', 'Qté prévue', 'Poids th.', 'Prix unit.', 'Total'];
    let y = 180;

    doc.fillColor('#14532d').rect(45, y, 505, 18).fill();
    headers.forEach((h, i) => {
      doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
         .text(h, cols[i], y + 4, { width: (cols[i+1]||555) - cols[i] - 5 });
    });
    y += 18;

    for (const ligne of lignes) {
      const bg = lignes.indexOf(ligne) % 2 === 0 ? '#f9fefb' : '#fff';
      doc.fillColor(bg).rect(45, y, 505, 16).fill();
      const vals = [
        ligne.article_code || '',
        (ligne.designation || '').substring(0, 25),
        ligne.qte_prevue?.toString() || '',
        ligne.poids_theorique_kg ? `${ligne.poids_theorique_kg} kg` : '',
        ligne.prix_unitaire ? `${ligne.prix_unitaire}` : '',
        ligne.montant_total ? `${ligne.montant_total}` : '',
      ];
      vals.forEach((v, i) => {
        doc.fillColor('#374151').fontSize(8).font('Helvetica')
           .text(v, cols[i], y + 4, { width: (cols[i+1]||555) - cols[i] - 5 });
      });
      y += 16;
      if (y > 700) { doc.addPage(); y = 50; }
    }

    // Zone signatures
    y += 20;
    doc.fillColor('#f0fdf4').rect(45, y, 505, 80).fill();
    doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold')
       .text('Émis par :', 60, y + 10).text('Validé par :', 220, y + 10).text('Réceptionné par :', 380, y + 10);
    doc.font('Helvetica').fontSize(9)
       .text('Nom & Signature', 60, y + 55).text('Nom & Signature', 220, y + 55).text('Nom & Signature', 380, y + 55);

    // Notes
    if (mvt.notes) {
      doc.moveDown().fontSize(9).text(`Notes : ${mvt.notes}`);
    }

    doc.fontSize(7).fillColor('#9ca3af')
       .text('© 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry', 50, 810, { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(`/uploads/bons/${filename}`));
    stream.on('error', reject);
  });
}

module.exports = router;
