const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/regleur/historique
// Toutes les validations régleur (sessions + OFs directs), sans limite de date
router.get('/historique', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        sp.id,
        sp.regleur_validation_at AS valide_at,
        sp.regleur_temperature   AS temperature,
        sp.regleur_pression      AS pression,
        sp.regleur_vitesse       AS vitesse,
        sp.regleur_notes         AS notes,
        o.numero_of,
        o.quantite_cible,
        o.date_livraison_prevue,
        o.regleur_valide_at      AS of_valide_at,
        o.numero_ticket_reglage,
        a.designation            AS article,
        a.couleur,
        a.largeur_mm,
        a.soufflet_mm,
        a.epaisseur_um,
        ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1) AS poids_total_kg,
        um.code                  AS unite_code,
        um.libelle               AS unite_libelle,
        c.raison_sociale         AS client_nom,
        m.code                   AS machine_code,
        m.nom                    AS machine_nom,
        ur.prenom || ' ' || ur.nom AS regleur_nom,
        'session' AS origine
      FROM sessions_production sp
      JOIN ordres_fabrication o  ON o.id  = sp.of_id
      JOIN articles a            ON a.id  = o.article_id
      LEFT JOIN clients_complet c  ON c.id  = o.client_id
      LEFT JOIN machines m         ON m.id  = sp.machine_id
      LEFT JOIN unites_mesure um   ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur    ON ur.id = sp.regleur_id
      WHERE sp.regleur_valide = true

      UNION ALL

      SELECT
        o.id,
        o.regleur_valide_at      AS valide_at,
        o.regleur_temperature    AS temperature,
        o.regleur_pression       AS pression,
        o.regleur_vitesse        AS vitesse,
        o.regleur_notes          AS notes,
        o.numero_of,
        o.quantite_cible,
        o.date_livraison_prevue,
        o.regleur_valide_at      AS of_valide_at,
        o.numero_ticket_reglage,
        a.designation            AS article,
        a.couleur,
        a.largeur_mm,
        a.soufflet_mm,
        a.epaisseur_um,
        ROUND((o.quantite_cible * COALESCE(a.poids_theorique_kg, 0))::numeric, 1) AS poids_total_kg,
        um.code                  AS unite_code,
        um.libelle               AS unite_libelle,
        c.raison_sociale         AS client_nom,
        m.code                   AS machine_code,
        m.nom                    AS machine_nom,
        ur.prenom || ' ' || ur.nom AS regleur_nom,
        'of' AS origine
      FROM ordres_fabrication o
      JOIN articles a            ON a.id  = o.article_id
      LEFT JOIN clients_complet c  ON c.id  = o.client_id
      LEFT JOIN machines m         ON m.id  = o.machine_id
      LEFT JOIN unites_mesure um   ON um.id = o.unite_id
      LEFT JOIN utilisateurs ur    ON ur.id = o.regleur_id
      WHERE o.regleur_valide = true
        AND NOT EXISTS (
          SELECT 1 FROM sessions_production sp
          WHERE sp.of_id = o.id AND sp.regleur_valide = true
        )

      ORDER BY valide_at DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
