'use strict';
// NAIdo - Personnalisation du menu : chaque personne garde son ordre et ses groupes (comme LEINAD).
// Espace personnel : seule la personne connectée lit et modifie sa propre disposition.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const VIDE = { ordre: [], groupes: [] };

router.get('/menu', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT layout FROM preferences_menu WHERE user_id = $1', [String(req.user.id)]);
    res.json(rows[0]?.layout || VIDE);
  } catch (e) {
    console.error('[PREFERENCES menu]', e.message);
    res.status(500).json({ error: 'Lecture impossible' });
  }
});

router.put('/menu', auth, async (req, res) => {
  try {
    const b = req.body || {};
    const ids = (v) => (Array.isArray(v) ? v : []).map(String).filter((s) => s.length > 0 && s.length <= 60).slice(0, 200);
    const layout = {
      ordre: ids(b.ordre),
      groupes: (Array.isArray(b.groupes) ? b.groupes : []).slice(0, 20)
        .map((g) => ({ nom: String(g?.nom || '').trim().slice(0, 40), ids: ids(g?.ids) }))
        .filter((g) => g.nom),
    };
    await db.query(
      `INSERT INTO preferences_menu (user_id, layout, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, updated_at = now()`,
      [String(req.user.id), JSON.stringify(layout)]
    );
    res.json(layout);
  } catch (e) {
    console.error('[PREFERENCES menu]', e.message);
    res.status(500).json({ error: 'Enregistrement impossible' });
  }
});

module.exports = router;
