const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// POST /api/sessions — Démarrer une session
router.post('/', auth, async (req, res) => {
  try {
    const { of_id, machine_id, shift_id } = req.body;

    // Vérifier que le régleur a validé
    const ofRes = await db.query(
      'SELECT statut FROM ordres_fabrication WHERE id=$1', [of_id]
    );
    if (!ofRes.rows.length) return res.status(404).json({ error: 'OF introuvable' });
    if (ofRes.rows[0].statut === 'planifie') {
      return res.status(403).json({
        error: 'Le régleur doit valider les paramètres machine avant le démarrage'
      });
    }

    const { rows } = await db.query(`
      INSERT INTO sessions_production
        (of_id, operateur_id, machine_id, shift_id, heure_debut, statut)
      VALUES ($1, $2, $3, $4, NOW(), 'en_cours')
      RETURNING *
    `, [of_id, req.user.id, machine_id, shift_id]);

    // Mettre à jour statut OF
    await db.query(
      "UPDATE ordres_fabrication SET statut='en_cours' WHERE id=$1", [of_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sessions/:id/valider-regleur — Régleur valide les paramètres
router.post('/:id/valider-regleur', auth, role('regleur', 'technicien_regleur', 'chef_atelier'), async (req, res) => {
  try {
    const { temperature, pression, vitesse, notes, of_id } = req.body;
    const { rows } = await db.query(`
      UPDATE sessions_production SET
        regleur_id=$1, regleur_valide=true, regleur_validation_at=NOW(),
        regleur_temperature=$2, regleur_pression=$3,
        regleur_vitesse=$4, regleur_notes=$5
      WHERE id=$6 RETURNING *
    `, [req.user.id, temperature, pression, vitesse, notes, req.params.id]);

    // Débloquer l'OF + enregistrer le numéro de ticket réglage sur l'OF
    let numeroTicketReglage = null;
    if (of_id) {
      const { rows: ofRows } = await db.query(`
        UPDATE ordres_fabrication SET
          statut = CASE WHEN statut='planifie' THEN 'en_attente_regleur' ELSE statut END,
          regleur_valide=true, regleur_valide_at=NOW(), regleur_id=$1,
          numero_ticket_reglage = COALESCE(numero_ticket_reglage, 'TKR-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(nextval('seq_ticket_reglage')::text,4,'0')),
          regleur_temperature=$2, regleur_pression=$3, regleur_vitesse=$4, regleur_notes=$5,
          statut_reglage='regle'
        WHERE id=$6
        RETURNING numero_ticket_reglage
      `, [req.user.id, temperature, pression, vitesse, notes, of_id]);
      numeroTicketReglage = ofRows[0]?.numero_ticket_reglage || null;
    }
    res.json({ ...rows[0], numero_ticket_reglage: numeroTicketReglage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sessions/actives — Sessions en cours
router.get('/actives', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sp.*, o.numero_of, o.numero_ticket_reglage, o.quantite_cible, o.quantite_pieces,
             o.date_livraison_prevue,
             COALESCE(NULLIF(o.at3_poids_cible_kg, 0), ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1)) AS poids_total_kg,
             a.designation AS article, a.couleur, a.largeur_mm,
             um.code AS unite_code, um.libelle AS unite_libelle,
             c.raison_sociale AS client_nom,
             m.code AS machine_code, m.nom AS machine_nom,
             u.nom || ' ' || u.prenom AS operateur_nom,
             sh.nom AS shift_nom,
             ur.prenom || ' ' || ur.nom AS regleur_nom
      FROM sessions_production sp
      JOIN ordres_fabrication o ON o.id = sp.of_id
      JOIN articles a ON a.id = o.article_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN clients_complet c ON c.id = o.client_id
      JOIN machines m ON m.id = sp.machine_id
      JOIN utilisateurs u ON u.id = sp.operateur_id
      JOIN shifts sh ON sh.id = sp.shift_id
      LEFT JOIN utilisateurs ur ON ur.id = sp.regleur_id
      WHERE sp.statut = 'en_cours'
      ORDER BY sp.heure_debut DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/sessions/:id/terminer
router.put('/:id/terminer', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE sessions_production SET statut='termine', heure_fin=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
