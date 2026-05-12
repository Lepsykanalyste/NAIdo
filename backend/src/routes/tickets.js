const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// POST /api/tickets
router.post('/', auth, async (req, res) => {
  try {
    const {
      session_id, of_id, machine_id, article_id,
      poids_brut_kg, poids_mandrin_kg, poids_dechets_kg, motif_dechet,
      poids_rebuts_kg, motif_rebut, type_ticket, etape_source, etape_dest,
      lot_id, nom_matiere, qte_pieces, numero_colis, poids_carton_kg,
      client_nom, numero_sequence
    } = req.body;

    const poids_net = parseFloat(poids_brut_kg||0) - parseFloat(poids_mandrin_kg||0);
    const qr = 'NAI|' + (of_id||'') + '|' + (machine_id||'') + '|' + poids_net.toFixed(3) + 'kg';

    const { rows } = await db.query(`
      INSERT INTO tickets_production
        (session_id, of_id, machine_id, operateur_id, article_id,
         poids_brut_kg, poids_mandrin_kg, poids_net_kg,
         poids_dechets_kg, motif_dechet, poids_rebuts_kg, motif_rebut,
         type_ticket, etape_source, etape_dest,
         lot_matiere_id, numero_sequence, qte_pieces,
         numero_colis, poids_carton_kg, qr_code_contenu)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [
      session_id, of_id, machine_id||null, req.user.id, article_id||null,
      poids_brut_kg||0, poids_mandrin_kg||0, poids_net,
      poids_dechets_kg||0, motif_dechet||null, poids_rebuts_kg||0, motif_rebut||null,
      type_ticket||'extrusion', etape_source||null, etape_dest||null,
      lot_id||null, numero_sequence||1, qte_pieces||0,
      numero_colis||null, poids_carton_kg||0, qr
    ]);

    await db.query(
      'UPDATE ordres_fabrication SET quantite_produite = quantite_produite + $1 WHERE id = $2',
      [poids_net, of_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/session/:session_id
router.get('/session/:session_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT tp.*, m.code AS machine_code, o.numero_of
      FROM tickets_production tp
      LEFT JOIN machines m ON m.id = tp.machine_id
      JOIN ordres_fabrication o ON o.id = tp.of_id
      WHERE tp.session_id = $1
      ORDER BY tp.created_at DESC
    `, [req.params.session_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/tickets/:id/imprime
router.put('/:id/imprime', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE tickets_production SET imprime=true, imprime_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/tickets?operateur_id=&limit=
router.get('/', auth, async (req, res) => {
  try {
    const { operateur_id, limit = 20 } = req.query;
    const id = operateur_id || req.user.id;
    const { rows } = await db.query(
      `SELECT tp.id, tp.numero_ticket, tp.poids_net_kg, tp.poids_dechets_kg,
              tp.type_ticket, tp.created_at, tp.etape_dest,
              o.numero_of, m.code AS machine_code
       FROM tickets_production tp
       LEFT JOIN ordres_fabrication o ON o.id = tp.of_id
       LEFT JOIN machines m ON m.id = tp.machine_id
       WHERE tp.operateur_id = $1
       ORDER BY tp.created_at DESC LIMIT $2`,
      [id, parseInt(limit)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
