const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// Fiche de non-conformite rapide (ecran Non-Conformites). Elle est stockee dans la table non_conformites,
// partagee avec le module QHSE : numero_nc, type, titre et description (obligatoires) sont donc renseignes aussi.
router.post('/', auth, async (req, res) => {
  try {
    const { numero_lot, quantite, designation, client_nom, motif, description, decision, actions } = req.body;
    if (!numero_lot || !designation || !motif || !decision)
      return res.status(400).json({ error: 'N° de lot, désignation, motif et décision sont obligatoires' });
    const { rows } = await db.query(`
      INSERT INTO non_conformites
        (numero_nc, type, titre, description, numero_lot, quantite, designation, client_nom, motif, decision, actions,
         lot_concerne, produit_concerne, action_immediate, action_corrective, detecteur_id, declarant_id)
      VALUES
        ('NC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_nc_rapide')::text, 4, '0'),
         'produit', LEFT($1::text, 255), COALESCE(NULLIF($2::text, ''), $1::text), $3::text, $4::text, $5::text, $6::text, $1::text, $7::text, $8::text,
         LEFT($3::text, 100), LEFT($5::text, 200), $7::text, $8::text, $9::uuid, $9::uuid)
      RETURNING *
    `, [motif, description || '', numero_lot, quantite == null ? null : String(quantite), designation, client_nom || null, decision, actions || null, req.user.id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT n.*, u.prenom || ' ' || u.nom AS controleur_nom
      FROM non_conformites n
      LEFT JOIN utilisateurs u ON u.id = n.declarant_id
      WHERE n.declarant_id IS NOT NULL
      ORDER BY n.created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/clore', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE non_conformites SET statut='clos', closed_at=NOW(), date_cloture=CURRENT_DATE WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Non-conformité introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
