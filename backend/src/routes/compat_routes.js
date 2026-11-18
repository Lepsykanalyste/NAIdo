// ============================================================
// NAIdo — routes manquantes constatees par l'audit (17 nov 2026)
// Fichier : backend/src/routes/compat_routes.js  (monte sur /api)
//   GET /api/fournisseurs  liste des fournisseurs (appelee par la GMAO)
//   GET /api/qualite       historique general des controles qualite
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

// Meme liste que GET /api/achat/fournisseurs
router.get('/fournisseurs', auth, async (req, res) => {
  try {
    const { search } = req.query;
    let q = 'SELECT * FROM fournisseurs WHERE actif=true';
    const p = [];
    if (search) { p.push(`%${search}%`); q += ' AND (code ILIKE $1 OR raison_sociale ILIKE $1)'; }
    q += ' ORDER BY raison_sociale LIMIT 200';
    const { rows } = await db.query(q, p);
    res.json(rows);
  } catch (e) { console.error('[COMPAT] fournisseurs', e.message); res.status(500).json({ error: e.message }); }
});

// Historique des controles qualite (onglet "Historique" de la page Qualite).
// La signature manuscrite (base64, lourde) est exclue de la liste.
router.get('/qualite', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT (to_jsonb(cq) - 'signature_base64')
             || jsonb_build_object(
                  'numero_of',      o.numero_of,
                  'article',        a.designation,
                  'controleur_nom', NULLIF(TRIM(COALESCE(u.nom,'') || ' ' || COALESCE(u.prenom,'')), '')
                ) AS r
      FROM controles_qualite cq
      LEFT JOIN utilisateurs u       ON u.id = cq.controleur_id
      LEFT JOIN ordres_fabrication o ON o.id = cq.of_id
      LEFT JOIN articles a           ON a.id = o.article_id
      ORDER BY cq.created_at DESC
      LIMIT 200
    `);
    res.json(rows.map(x => x.r));
  } catch (e) { console.error('[COMPAT] qualite', e.message); res.status(500).json({ error: e.message }); }
});

module.exports = router;
