const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/of
router.get('/', auth, async (req, res) => {
  try {
    const { statut, machine_id, atelier_id, article_id } = req.query;
    let query = `
      SELECT o.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             a.cadence_heure AS cadence_heure,
             ROUND((o.quantite_cible * a.poids_theorique_kg)::numeric, 1) AS poids_theorique_total_kg,
             a.temps_reglage_min, a.poids_theorique_kg,
             a.longueur_mm, a.largeur_mm, a.couleur,
             m.code AS machine_code, m.nom AS machine_nom, m.type AS machine_type,
             um.code AS unite_code, um.libelle AS unite_libelle,
             at.libelle AS atelier_libelle, at.code AS atelier_code
      FROM ordres_fabrication o
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); query += ` AND o.statut = $${params.length}`; }
    if (machine_id) { params.push(parseInt(machine_id)); query += ` AND o.machine_id = $${params.length}`; }
    if (atelier_id) { params.push(atelier_id); query += ` AND o.atelier_id = $${params.length}`; }
    if (article_id) { params.push(article_id); query += ` AND o.article_id = $${params.length}`; }
    query += ' ORDER BY o.priorite DESC, o.date_livraison_prevue ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/of
router.post('/', auth, async (req, res) => {
  try {
    const {
      client_id, article_id, quantite_cible, machine_id,
      atelier_id, date_livraison_prevue, priorite, instructions,
      unite_id, reference_sage
    } = req.body;

    if (!article_id || !quantite_cible) {
      return res.status(400).json({ error: 'article_id et quantite_cible requis' });
    }

    // Calculer temps prévu selon formule cahier des charges
    let temps_prevu_min = null;
    if (article_id) {
      const { rows: art } = await db.query(
        'SELECT cadence_theorique_kg_h, temps_reglage_min FROM articles WHERE id=$1', [article_id]
      );
      if (art.length && art[0].cadence_theorique_kg_h > 0) {
        const cadence = parseFloat(art[0].cadence_theorique_kg_h);
        const reglage = parseFloat(art[0].temps_reglage_min || 30);
        temps_prevu_min = Math.round((parseFloat(quantite_cible) / cadence) * 60 + reglage);
      }
    }

    const { rows } = await db.query(`
      INSERT INTO ordres_fabrication 
        (client_id, article_id, quantite_cible, machine_id, atelier_id,
         date_livraison_prevue, priorite, instructions, unite_id,
         reference_sage, temps_prevu_min, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'planifie')
      RETURNING *
    `, [
      client_id || null,
      article_id,
      parseFloat(quantite_cible),
      machine_id ? parseInt(machine_id) : null,
      atelier_id || 'AT3',
      date_livraison_prevue || null,
      parseInt(priorite || 3),
      instructions || null,
      unite_id || null,
      reference_sage || null,
      temps_prevu_min
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/of/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*,
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             a.cadence_heure AS cadence_heure,
             ROUND((o.quantite_cible * a.poids_theorique_kg)::numeric, 1) AS poids_theorique_total_kg,
             a.temps_reglage_min, a.poids_theorique_kg,
             a.longueur_mm, a.largeur_mm, a.couleur, a.composition,
             m.code AS machine_code, m.nom AS machine_nom
      FROM ordres_fabrication o
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/of/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      machine_id, atelier_id, date_livraison_prevue,
      priorite, instructions, quantite_cible
    } = req.body;
    const { rows } = await db.query(`
      UPDATE ordres_fabrication SET
        machine_id = COALESCE($1, machine_id),
        atelier_id = COALESCE($2, atelier_id),
        date_livraison_prevue = COALESCE($3, date_livraison_prevue),
        priorite = COALESCE($4, priorite),
        instructions = COALESCE($5, instructions),
        quantite_cible = COALESCE($6, quantite_cible)
      WHERE id = $7 RETURNING *
    `, [
      machine_id ? parseInt(machine_id) : null,
      atelier_id || null,
      date_livraison_prevue || null,
      priorite ? parseInt(priorite) : null,
      instructions || null,
      quantite_cible ? parseFloat(quantite_cible) : null,
      req.params.id
    ]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/of/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const { rows } = await db.query(
      'UPDATE ordres_fabrication SET statut=$1 WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// PATCH /api/of/:id/reglage — Régleur valide les paramètres machine
router.patch('/:id/reglage', auth, async (req, res) => {
  try {
    const { temperature, pression, vitesse, notes, regleur_id } = req.body;
    const rId = regleur_id || req.user.id;
    const { rows } = await db.query(`
      UPDATE ordres_fabrication SET
        statut              = 'en_attente_operateur',
        regleur_id          = $1,
        regleur_valide      = true,
        regleur_temperature = $2,
        regleur_pression    = $3,
        regleur_vitesse     = $4,
        regleur_notes       = $5,
        regleur_valide_at   = NOW(),
        numero_ticket_reglage = 'TKR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('seq_ticket_reglage')::text, 4, '0')
      WHERE id = $6
      RETURNING *
    `, [rId, temperature, pression, vitesse, notes, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
