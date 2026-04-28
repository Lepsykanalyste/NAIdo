const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// GET /api/kpi/trs — TRS par machine et date
router.get('/trs', auth, async (req, res) => {
  try {
    const { date_debut, date_fin, machine_id } = req.query;
    let query = 'SELECT * FROM vue_trs WHERE 1=1';
    const params = [];
    if (date_debut) { params.push(date_debut); query += ` AND date_session >= $${params.length}`; }
    if (date_fin)   { params.push(date_fin);   query += ` AND date_session <= $${params.length}`; }
    if (machine_id) { params.push(machine_id); query += ` AND machine_id = $${params.length}`; }
    query += ' ORDER BY date_session DESC, machine_code';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/kpi/dashboard — Données tableau de bord temps réel
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Sessions actives
    const sessions = await db.query(`
      SELECT COUNT(*) AS sessions_actives FROM sessions_production
      WHERE statut='en_cours' AND date_session=CURRENT_DATE
    `);

    // Production du jour
    const prod = await db.query(`
      SELECT COALESCE(SUM(poids_net_kg),0) AS poids_net_total,
             COALESCE(SUM(poids_dechets_kg),0) AS poids_dechets_total,
             COUNT(*) AS nb_tickets
      FROM tickets_production WHERE DATE(created_at)=CURRENT_DATE
    `);

    // TRS moyen du jour
    const trs = await db.query(`
      SELECT ROUND(AVG(trs_pct),2) AS trs_moyen,
             ROUND(AVG(taux_rebus_pct),2) AS rebus_moyen
      FROM vue_trs WHERE date_session=CURRENT_DATE
    `);

    // Arrêts actifs
    const arrets = await db.query(`
      SELECT COUNT(*) AS arrets_actifs FROM arrêts_machine
      WHERE statut='en_cours'
    `);

    // Alertes rebus > 5%
    const alertes = await db.query(`
      SELECT machine_code, taux_rebus_pct FROM vue_trs
      WHERE date_session=CURRENT_DATE AND taux_rebus_pct > 5
    `);

    res.json({
      sessions_actives: parseInt(sessions.rows[0].sessions_actives),
      poids_net_total: parseFloat(prod.rows[0].poids_net_total),
      poids_dechets_total: parseFloat(prod.rows[0].poids_dechets_total),
      nb_tickets: parseInt(prod.rows[0].nb_tickets),
      trs_moyen: parseFloat(trs.rows[0].trs_moyen) || 0,
      rebus_moyen: parseFloat(trs.rows[0].rebus_moyen) || 0,
      arrets_actifs: parseInt(arrets.rows[0].arrets_actifs),
      alertes_rebus: alertes.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/kpi/rebus — Taux de rebus par machine/article/équipe
router.get('/rebus', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT m.code AS machine, m.nom AS machine_nom,
             a.reference AS article, a.designation AS article_nom,
             sh.nom AS shift,
             ROUND(SUM(tp.poids_dechets_kg) / NULLIF(SUM(tp.poids_net_kg),0)*100,2) AS taux_rebus_pct,
             SUM(tp.poids_dechets_kg) AS total_dechets_kg,
             SUM(tp.poids_net_kg) AS total_produit_kg
      FROM tickets_production tp
      JOIN machines m ON m.id = tp.machine_id
      JOIN ordres_fabrication o ON o.id = tp.of_id
      JOIN articles a ON a.id = o.article_id
      JOIN sessions_production sp ON sp.id = tp.session_id
      JOIN shifts sh ON sh.id = sp.shift_id
      WHERE DATE(tp.created_at) >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY m.code, m.nom, a.reference, a.designation, sh.nom
      ORDER BY taux_rebus_pct DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
