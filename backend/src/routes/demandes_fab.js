const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/df
router.get('/', auth, async (req, res) => {
  try {
    const { statut } = req.query;
    let q = `
      SELECT df.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             u1.nom||' '||u1.prenom AS demandeur_nom,
             u2.nom||' '||u2.prenom AS valideur_nom,
             o.numero_of
      FROM demandes_fabrication df
      LEFT JOIN clients_complet c ON c.id=df.client_id
      LEFT JOIN articles a ON a.id=df.article_id
      LEFT JOIN utilisateurs u1 ON u1.id=df.demandeur_id
      LEFT JOIN utilisateurs u2 ON u2.id=df.validee_par
      LEFT JOIN ordres_fabrication o ON o.id=df.of_id
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); q += ` AND df.statut=$${params.length}`; }
    q += ' ORDER BY df.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/df
router.post('/', auth, async (req, res) => {
  try {
    const { client_id, article_id, quantite_demandee, description,
            specifications, date_livraison_souhaitee, priorite, notes } = req.body;
    if (!article_id || !quantite_demandee)
      return res.status(400).json({ error: 'article_id et quantite_demandee requis' });
    const { rows } = await db.query(`
      INSERT INTO demandes_fabrication
        (client_id, article_id, quantite_demandee, description,
         specifications, date_livraison_souhaitee, priorite,
         demandeur_id, notes, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'en_attente')
      RETURNING *
    `, [client_id||null, article_id, parseFloat(quantite_demandee),
        description||null, specifications||null,
        date_livraison_souhaitee||null, parseInt(priorite||3),
        req.user.id, notes||null]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/valider — Direction valide et crée OF automatiquement
router.put('/:id/valider', auth, async (req, res) => {
  try {
    const { machine_id, atelier_id, date_debut_prevue } = req.body;
    const { rows: df } = await db.query(
      'SELECT * FROM demandes_fabrication WHERE id=$1', [req.params.id]
    );
    if (!df.length) return res.status(404).json({ error: 'DF introuvable' });
    const d = df[0];

    // Calculer temps prévu
    let temps_prevu_min = null;
    const { rows: art } = await db.query(
      'SELECT cadence_theorique_kg_h, temps_reglage_min FROM articles WHERE id=$1', [d.article_id]
    );
    if (art.length && parseFloat(art[0].cadence_theorique_kg_h||0) > 0) {
      const c = parseFloat(art[0].cadence_theorique_kg_h);
      const r = parseFloat(art[0].temps_reglage_min||30);
      temps_prevu_min = Math.round((parseFloat(d.quantite_demandee)/c)*60 + r);
    }

    // Créer OF automatiquement
    const { rows: of } = await db.query(`
      INSERT INTO ordres_fabrication
        (client_id, article_id, quantite_cible, machine_id, atelier_id,
         date_livraison_prevue, date_debut_prevue, priorite, statut,
         temps_prevu_min, df_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'planifie',$9,$10)
      RETURNING *
    `, [d.client_id, d.article_id, d.quantite_demandee,
        machine_id ? parseInt(machine_id) : null,
        atelier_id||'AT3',
        d.date_livraison_souhaitee, date_debut_prevue||null,
        d.priorite, temps_prevu_min, d.id]);

    // Mettre à jour la DF
    const { rows: updated } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='validee', validee_par=$1, validee_at=NOW(), of_id=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [req.user.id, of[0].id, req.params.id]);

    res.json({ df: updated[0], of: of[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/df/:id/refuser
router.put('/:id/refuser', auth, async (req, res) => {
  try {
    const { motif_refus } = req.body;
    const { rows } = await db.query(`
      UPDATE demandes_fabrication 
      SET statut='refusee', validee_par=$1, validee_at=NOW(), motif_refus=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [req.user.id, motif_refus||'', req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
