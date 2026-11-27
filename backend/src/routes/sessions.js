const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');
const { enregistrerReglage, enregistrerReprise, assurerReglages } = require('../utils/reglagesOf');
assurerReglages().catch(e => console.error('[SESSIONS] historique des reglages :', e.message));

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
router.post('/:id/valider-regleur', auth, role('regleur', 'technicien_regleur', 'operateur_ext', 'chef_atelier'), async (req, res) => {
  try {
    const { temperature, pression, vitesse, notes, of_id, motif } = req.body;
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
      // chaque validation du régleur crée son propre ticket et reste dans l'historique de l'OF
      const rg = await enregistrerReglage(db, { of_id, session_id: req.params.id, regleur_id: req.user.id, machine_id: rows[0] && rows[0].machine_id, temperature, pression, vitesse, notes, motif });
      const { rows: ofRows } = await db.query(`
        UPDATE ordres_fabrication SET
          statut = CASE WHEN statut='planifie' THEN 'en_attente_regleur' ELSE statut END,
          regleur_valide=true, regleur_valide_at=NOW(), regleur_id=$1,
          numero_ticket_reglage = $7,
          regleur_temperature=$2, regleur_pression=$3, regleur_vitesse=$4, regleur_notes=$5,
          statut_reglage='regle'
        WHERE id=$6
        RETURNING numero_ticket_reglage
      `, [req.user.id, temperature, pression, vitesse, notes, of_id, rg.numero_ticket]);
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

// Poids des sacs vides de matiere declare a la fin du shift : il part en quarantaine, en attente de recyclage
const structureSacs = db.query(`CREATE TABLE IF NOT EXISTS sacs_vides_matiere (
  id serial PRIMARY KEY, session_id text, of_id text, shift_id text, operateur_id text,
  poids_kg numeric NOT NULL, statut text NOT NULL DEFAULT 'quarantaine', created_at timestamptz DEFAULT now())`)
  .catch(e => console.error('[SESSIONS] sacs vides :', e.message));

// POST /api/sessions/sacs-vides
router.post('/sacs-vides', auth, async (req, res) => {
  try {
    const poids = parseFloat(req.body && req.body.poids_kg);
    if (!(poids > 0)) return res.status(400).json({ error: 'Poids des sacs vides invalide' });
    await structureSacs;
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO sacs_vides_matiere (session_id, of_id, shift_id, operateur_id, poids_kg) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.session_id ? String(b.session_id) : null, b.of_id ? String(b.of_id) : null, b.shift_id ? String(b.shift_id) : null, String(req.user.id), poids]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sessions/sacs-vides — sacs vides en quarantaine (a recycler)
router.get('/sacs-vides', auth, async (req, res) => {
  try {
    await structureSacs;
    const { rows } = await db.query(
      `SELECT s.*, u.nom AS operateur_nom, u.prenom AS operateur_prenom
       FROM sacs_vides_matiere s LEFT JOIN utilisateurs u ON u.id::text = s.operateur_id
       ORDER BY s.created_at DESC LIMIT 200`);
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

// POST /api/sessions/:id/reglage-repris — l'opérateur démarre son quart sur le réglage de l'OF (qu'il vienne de le faire, de le modifier ou de le reprendre tel quel).
// Le ticket de réglage reste le même ; il est tracé au nom de l'opérateur et à son quart.
router.post('/:id/reglage-repris', auth, role('operateur_ext', 'regleur', 'technicien_regleur', 'chef_atelier'), async (req, res) => {
  try {
    const { of_id, mode } = req.body || {};
    if (!of_id) return res.status(400).json({ error: 'OF obligatoire' });
    const s = await db.query('SELECT operateur_id FROM sessions_production WHERE id::text = $1', [req.params.id]);
    if (!s.rows.length) return res.status(404).json({ error: 'Session introuvable' });
    if (req.user.role !== 'chef_atelier' && String(s.rows[0].operateur_id) !== String(req.user.id))
      return res.status(403).json({ error: 'Cette session n\'est pas la vôtre' });
    const r = await enregistrerReprise(db, { of_id, session_id: req.params.id, mode: ['premier', 'modif', 'reprise'].includes(mode) ? mode : 'reprise' });
    res.json({ ok: true, ...r });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
