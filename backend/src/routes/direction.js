'use strict';
// NAIdo - Tableau de bord de la direction : a traiter aujourd'hui / ce qui marche / argent. Reserve a la direction.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
const err = (res, e, msg) => { console.error('[DIRECTION]', msg, e?.message || e); res.status(500).json({ error: msg }); };
const EST_DIRECTION = (u) => ['directeur', 'super_admin'].includes(String(u?.role || ''));

router.get('/tableau-de-bord', auth, async (req, res) => {
  if (!EST_DIRECTION(req.user)) return res.status(403).json({ error: 'Réservé à la direction' });
  try {
    const [bons, demandes, nc, pannes, ofs, retard, rebut, stockBas, depenses, bonsListe] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(montant_ttc),0) AS montant FROM commandes_achat WHERE validation='en_attente_direction'`),
      db.query(`SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut='en_attente'`),
      db.query(`SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut IN ('ouvert','en_cours')`),
      db.query(`SELECT COUNT(*)::int AS n FROM "arrêts_machine" WHERE statut IS DISTINCT FROM 'clos'`),
      db.query(`SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE statut IN ('lance','en_cours','en_attente_regleur','pause')`),
      db.query(`SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE date_livraison_prevue < CURRENT_DATE AND statut NOT IN ('termine','annule','pret_livraison')`),
      db.query(`SELECT CASE WHEN COALESCE(SUM(poids_brut_kg),0) = 0 THEN 0
                 ELSE ROUND(SUM(COALESCE(poids_dechets_kg,0)) * 100 / SUM(poids_brut_kg), 2) END AS taux
                FROM tickets_production WHERE created_at >= date_trunc('month', now())`),
      db.query(`SELECT COUNT(*)::int AS n FROM articles a
                LEFT JOIN (SELECT article_id, SUM(qte_disponible) AS q FROM stock_articles GROUP BY article_id) s ON s.article_id = a.id
                WHERE COALESCE(a.stock_mini, 0) > 0 AND COALESCE(s.q, 0) < a.stock_mini`),
      db.query(`SELECT COALESCE(lf.libelle, 'Production (OF)') AS poste, COALESCE(SUM(c.montant_ttc),0) AS montant, COUNT(*)::int AS n
                FROM commandes_achat c LEFT JOIN libelles_frais lf ON lf.id = c.libelle_frais_id
                WHERE c.created_at >= date_trunc('month', now()) AND c.validation = 'validee'
                GROUP BY 1 ORDER BY montant DESC`),
      db.query(`SELECT c.id, c.numero_commande, c.montant_ttc, f.raison_sociale AS fournisseur, lf.libelle AS libelle_frais, o.numero_of
                FROM commandes_achat c LEFT JOIN fournisseurs f ON f.id = c.fournisseur_id
                LEFT JOIN libelles_frais lf ON lf.id = c.libelle_frais_id LEFT JOIN ordres_fabrication o ON o.id = c.of_id
                WHERE c.validation = 'en_attente_direction' ORDER BY c.created_at LIMIT 10`),
    ]);
    res.json({
      a_traiter: {
        bons_a_valider: bons.rows[0].n,
        montant_bons_a_valider: bons.rows[0].montant,
        demandes_en_attente: demandes.rows[0].n,
        non_conformites_ouvertes: nc.rows[0].n,
        pannes_non_reglees: pannes.rows[0].n,
        bons_liste: bonsListe.rows,
      },
      ce_qui_marche: {
        of_en_cours: ofs.rows[0].n,
        of_en_retard: retard.rows[0].n,
        taux_rebut_mois_pct: Number(rebut.rows[0].taux),
        articles_sous_stock_mini: stockBas.rows[0].n,
      },
      argent: {
        depenses_mois_par_poste: depenses.rows,
        total_depenses_mois: depenses.rows.reduce((s, r) => s + Number(r.montant), 0),
      },
    });
  } catch (e) { err(res, e, 'Erreur tableau de bord direction'); }
});

module.exports = router;
