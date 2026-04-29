const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, role } = require('../middleware/auth');

// ── GET /api/planning ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { date, machine_id } = req.query;
    const dateTarget = date || new Date().toISOString().split('T')[0];
    let query = 'SELECT * FROM vue_planning_jour WHERE date_planifiee = $1';
    const params = [dateTarget];
    if (machine_id) { params.push(machine_id); query += ` AND machine_id = $${params.length}`; }
    query += ' ORDER BY machine_code, ordre_priorite, heure_debut_prevue';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/planning/semaine ─────────────────────────────────
router.get('/semaine', auth, async (req, res) => {
  try {
    const { debut } = req.query;
    const { rows } = await db.query(`
      SELECT * FROM vue_planning_jour
      WHERE date_planifiee BETWEEN $1 AND $1::date + INTERVAL '6 days'
      ORDER BY date_planifiee, machine_code, ordre_priorite
    `, [debut || new Date().toISOString().split('T')[0]]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/planning ────────────────────────────────────────
router.post('/', auth, role('chef_atelier', 'regleur'), async (req, res) => {
  try {
    const { of_id, machine_id, shift_id, date_planifiee,
            heure_debut_prevue, duree_prevue_min, ordre_priorite, notes } = req.body;

    // Calculer heure de fin
    let heure_fin = null;
    if (heure_debut_prevue && duree_prevue_min) {
      const [h, m] = heure_debut_prevue.split(':').map(Number);
      const total = h * 60 + m + parseInt(duree_prevue_min);
      heure_fin = `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    }

    const { rows } = await db.query(`
      INSERT INTO planning_machines
        (of_id, machine_id, shift_id, date_planifiee,
         heure_debut_prevue, heure_fin_prevue, duree_prevue_min,
         ordre_priorite, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [of_id, machine_id, shift_id, date_planifiee,
        heure_debut_prevue, heure_fin, duree_prevue_min,
        ordre_priorite || 0, notes, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/planning/:id ─────────────────────────────────────
router.put('/:id', auth, role('chef_atelier', 'regleur'), async (req, res) => {
  try {
    const { statut, ordre_priorite, date_planifiee, heure_debut_prevue, notes } = req.body;
    const { rows } = await db.query(`
      UPDATE planning_machines SET
        statut = COALESCE($1, statut),
        ordre_priorite = COALESCE($2, ordre_priorite),
        date_planifiee = COALESCE($3, date_planifiee),
        heure_debut_prevue = COALESCE($4, heure_debut_prevue),
        notes = COALESCE($5, notes)
      WHERE id = $6 RETURNING *
    `, [statut, ordre_priorite, date_planifiee, heure_debut_prevue, notes, req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/planning/:id ──────────────────────────────────
router.delete('/:id', auth, role('chef_atelier'), async (req, res) => {
  try {
    await db.query('DELETE FROM planning_machines WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
