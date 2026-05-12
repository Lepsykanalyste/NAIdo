// ============================================================
// NAIdo — AT3 FLUX COMPLET — Routes Express
// Fichier : backend/src/routes/at3_flux.js
// Architecture NAIdo : db = pool, { auth } = middleware/auth
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { auth } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
const ok       = (res, data)      => res.json(data);
const erreur   = (res, e, msg='') => {
  console.error('[AT3]', msg, e?.message || e);
  res.status(500).json({ error: msg || e?.message || 'Erreur serveur' });
};
const notFound = (res, msg)       => res.status(404).json({ error: msg });

// ══════════════════════════════════════════════════════════════
// 1. OF → CHEF ATELIER
// ══════════════════════════════════════════════════════════════

// GET /api/at3/of
router.get('/of', auth, async (req, res) => {
  try {
    const { statut, search } = req.query;
    let q = `
      SELECT o.*,
             a.code AS article_code, a.designation AS article_nom,
             a.poids_theorique_kg, a.cadence_theorique_kg_h,
             a.composition, a.composition_familles, a.couleur, a.longueur_mm, a.largeur_mm,
             o.at3_composition_familles,
             c.nom AS client_nom,
             m.code AS machine_code,
             (SELECT COUNT(*) FROM bobines_production b WHERE b.of_id = o.id) AS nb_bobines,
             (SELECT COALESCE(SUM(poids_net_kg),0) FROM bobines_production b WHERE b.of_id = o.id) AS poids_produit_kg,
             (SELECT COUNT(*) FROM palettes_emballage p WHERE p.of_id = o.id) AS nb_palettes
      FROM ordres_fabrication o
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients c  ON c.id = o.client_id
      LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
      WHERE o.statut NOT IN ('annule','archive','brouillon')
    `;
    const params = [];
    if (statut) { params.push(statut); q += ` AND o.at3_statut_zone = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (o.numero_of ILIKE $${params.length} OR a.designation ILIKE $${params.length})`;
    }
    q += ' ORDER BY o.created_at DESC LIMIT 100';
    const { rows } = await db.query(q, params);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur liste OF AT3'); }
});

// GET /api/at3/of/:id
router.get('/of/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*,
             a.code AS article_code, a.designation AS article_nom,
             a.poids_theorique_kg, a.cadence_theorique_kg_h,
             a.composition, a.composition_familles, a.poids_mandrin_kg, a.couleur,
             o.at3_composition_familles,
             a.longueur_mm, a.largeur_mm, a.hauteur_mm,
             a.tracabilite_type, a.format_lot,
             c.nom AS client_nom, c.telephone AS client_tel,
             m.code AS machine_code, m.libelle AS machine_libelle
      FROM ordres_fabrication o
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN clients c  ON c.id = o.client_id
      LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows.length) return notFound(res, 'OF introuvable');
    ok(res, rows[0]);
  } catch(e) { erreur(res, e, 'Erreur détail OF'); }
});

// PUT /api/at3/of/:id/configurer
router.put('/of/:id/configurer', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const {
      at3_poids_cible_kg, at3_nb_bobines_cibles,
      at3_notes_regleur, at3_notes_chef,
      at3_machine_assignee_id, valider, composition_of
    } = req.body;
    const userId = req.user?.id;

    const sets = [
      'at3_poids_cible_kg       = $2',
      'at3_nb_bobines_cibles    = $3',
      'at3_notes_regleur        = $4',
      'at3_notes_chef           = $5',
      'at3_machine_assignee_id  = $6',
    ];
    const params = [
      req.params.id,
      at3_poids_cible_kg || null,
      at3_nb_bobines_cibles || null,
      at3_notes_regleur || '',
      at3_notes_chef || '',
      at3_machine_assignee_id || null,
    ];
    if (composition_of && Array.isArray(composition_of) && composition_of.length > 0) {
      params.push(JSON.stringify(composition_of));
      sets.push(`at3_composition_of = $${params.length}`);
    }
    if (req.body.at3_composition_familles && Array.isArray(req.body.at3_composition_familles)) {
      params.push(JSON.stringify(req.body.at3_composition_familles));
      sets.push(`at3_composition_familles = $${params.length}`);
    }

    if (valider) {
      sets.push('at3_composition_validee = true');
      sets.push("at3_statut_zone         = 'extrusion'");
      sets.push("statut                  = 'lance'");
      sets.push('date_debut_reel         = NOW()');
      params.push(userId);
      sets.push(`at3_valide_par = $${params.length}`);
      sets.push('at3_valide_le  = NOW()');
    }

    await client.query(
      `UPDATE ordres_fabrication SET ${sets.join(', ')} WHERE id = $1`,
      params
    );
    await client.query('COMMIT');
    ok(res, { success: true, message: valider ? 'OF lancé en extrusion ✓' : 'Configuration sauvegardée' });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur config OF'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// 2. EXTRUSION
// ══════════════════════════════════════════════════════════════

// GET /api/at3/extrusion/of-actifs
router.get('/extrusion/of-actifs', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.id, o.numero_of, o.at3_poids_cible_kg, o.at3_nb_bobines_cibles,
             o.at3_notes_regleur, o.at3_machine_assignee_id,
             a.code AS article_code, a.designation AS article_nom,
             a.poids_theorique_kg, a.couleur, a.format_lot,
             m.code AS machine_code,
             COALESCE((SELECT COUNT(*) FROM bobines_production b WHERE b.of_id=o.id),0)        AS nb_bobines_faites,
             COALESCE((SELECT SUM(poids_net_kg) FROM bobines_production b WHERE b.of_id=o.id),0) AS poids_fait_kg
      FROM ordres_fabrication o
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
      WHERE o.at3_statut_zone = 'extrusion'
        AND o.at3_composition_validee = true
      ORDER BY o.at3_valide_le ASC
    `);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur OF actifs extrusion'); }
});

// GET /api/at3/extrusion/:of_id/bobines
router.get('/extrusion/:of_id/bobines', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.*, z.code AS zone_code, z.libelle AS zone_libelle,
             m.code AS machine_code,
             u.nom || ' ' || u.prenom AS operateur_nom
      FROM bobines_production b
      LEFT JOIN zones_at3 z   ON z.id = b.zone_actuelle_id
      LEFT JOIN machines m    ON m.id = b.machine_id
      LEFT JOIN utilisateurs u ON u.id = b.operateur_id
      WHERE b.of_id = $1
      ORDER BY b.created_at DESC
    `, [req.params.of_id]);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur bobines OF'); }
});

// POST /api/at3/extrusion/bobine
router.post('/extrusion/bobine', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const {
      of_id, machine_id,
      poids_brut_kg, poids_net_kg, poids_mandrin_kg,
      longueur_m, temperature_c, vitesse_m_min, pression_bar
    } = req.body;
    const operateur_id = req.user?.id;

    // Infos OF + article
    const ofRow = await client.query(
      `SELECT o.numero_of, o.article_id, a.format_lot
       FROM ordres_fabrication o
       LEFT JOIN articles a ON a.id = o.article_id
       WHERE o.id = $1`, [of_id]
    );
    if (!ofRow.rows.length) throw new Error('OF introuvable');
    const { numero_of, article_id } = ofRow.rows[0];

    // Code machine
    const machRow = await client.query('SELECT code FROM machines WHERE id=$1', [machine_id]);
    const machine_code = machRow.rows[0]?.code || 'XX';

    // Numéro bobine
    const numRes = await client.query(
      "SELECT 'BOB-' || $1 || '-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || $2 || '-' || LPAD(nextval('seq_bobine_num')::text,3,'0') AS nb",
      [numero_of, machine_code]
    );
    const numero_bobine = numRes.rows[0].nb;

    // Numéro de lot partagé par OF
    const lotRow = await client.query(
      'SELECT numero_lot FROM bobines_production WHERE of_id=$1 LIMIT 1', [of_id]
    );
    const numero_lot = lotRow.rows[0]?.numero_lot ||
      ('LOT-' + numero_of + '-' + new Date().toISOString().slice(0,10).replace(/-/g,''));

    // Zone quarantaine
    const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='QUAR'");
    const zone_quar_id = zoneRes.rows[0]?.id;

    const { rows } = await client.query(`
      INSERT INTO bobines_production (
        numero_bobine, numero_lot, of_id, article_id, machine_id, operateur_id,
        poids_brut_kg, poids_net_kg, poids_mandrin_kg, longueur_m,
        temperature_c, vitesse_m_min, pression_bar,
        zone_actuelle_id, statut, heure_fin_extrusion, heure_entree_quar
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'quarantaine',NOW(),NOW())
      RETURNING *
    `, [numero_bobine, numero_lot, of_id, article_id, machine_id, operateur_id,
        poids_brut_kg, poids_net_kg, poids_mandrin_kg||0, longueur_m,
        temperature_c, vitesse_m_min, pression_bar, zone_quar_id]);

    await client.query('COMMIT');
    ok(res, { bobine: rows[0], message: `Bobine ${numero_bobine} → Quarantaine ✓` });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur création bobine'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// 3. QUARANTAINE
// ══════════════════════════════════════════════════════════════

// GET /api/at3/quarantaine
router.get('/quarantaine', auth, async (req, res) => {
  try {
    const { of_id } = req.query;
    let q = `
      SELECT b.*, o.numero_of,
             a.code AS article_code, a.designation AS article_nom,
             m.code AS machine_code,
             u.nom || ' ' || u.prenom AS operateur_nom,
             EXTRACT(EPOCH FROM (NOW() - b.heure_entree_quar))/60 AS minutes_en_quarantaine
      FROM bobines_production b
      LEFT JOIN ordres_fabrication o ON o.id = b.of_id
      LEFT JOIN articles a           ON a.id = b.article_id
      LEFT JOIN machines m           ON m.id = b.machine_id
      LEFT JOIN utilisateurs u       ON u.id = b.operateur_id
      WHERE b.statut IN ('quarantaine','en_quarantaine')
    `;
    const params = [];
    if (of_id) { params.push(of_id); q += ` AND b.of_id = $${params.length}`; }
    q += ' ORDER BY b.heure_entree_quar ASC';
    const { rows } = await db.query(q, params);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur quarantaine'); }
});

// POST /api/at3/quarantaine/valider
router.post('/quarantaine/valider', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { bobines_ids, of_id, notes } = req.body;
    const chef_id = req.user?.id;
    if (!bobines_ids?.length) throw new Error('Aucune bobine sélectionnée');

    const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='IMPR'");
    const zone_impr_id = zoneRes.rows[0]?.id;

    const numRes = await client.query(
      "SELECT 'MVT-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_at3_num')::text,4,'0') AS num"
    );
    const numero_ticket = numRes.rows[0].num;

    const poidsRes = await client.query(
      'SELECT COALESCE(SUM(poids_net_kg),0) AS total FROM bobines_production WHERE id = ANY($1::uuid[])',
      [bobines_ids]
    );
    const poids_total = poidsRes.rows[0].total;

    await client.query(`
      INSERT INTO mouvements_at3 (
        numero_ticket, of_id, zone_source_id, zone_dest_id,
        type_mouvement, statut, bobines_ids, nb_bobines,
        poids_total_kg, cree_par, valide_par, date_validation, notes
      ) VALUES (
        $1,$2,
        (SELECT id FROM zones_at3 WHERE code='QUAR'),
        $3,
        'quarantaine_impression','valide',
        $4,$5,$6,$7,$7,NOW(),$8
      )
    `, [numero_ticket, of_id, zone_impr_id,
        JSON.stringify(bobines_ids), bobines_ids.length,
        poids_total, chef_id, notes||'']);

    await client.query(`
      UPDATE bobines_production
      SET statut='impression', zone_actuelle_id=$1,
          heure_sortie_quar=NOW(), heure_entree_impr=NOW(),
          qc_quarantaine=jsonb_build_object('ok',true,'valide_par',$2,'valide_le',NOW()::text)
      WHERE id = ANY($3::uuid[])
    `, [zone_impr_id, chef_id, bobines_ids]);

    await client.query('COMMIT');
    ok(res, { message: `${bobines_ids.length} bobine(s) → Impression ✓ Ticket: ${numero_ticket}` });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur validation quarantaine'); }
  finally { client.release(); }
});

// POST /api/at3/quarantaine/rejeter
router.post('/quarantaine/rejeter', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { bobine_id, motif } = req.body;
    const chef_id = req.user?.id;
    await client.query(`
      UPDATE bobines_production
      SET statut='rebut', heure_sortie_quar=NOW(),
          qc_quarantaine=jsonb_build_object('ok',false,'motif',$1,'rejete_par',$2,'rejete_le',NOW()::text)
      WHERE id=$3
    `, [motif, chef_id, bobine_id]);
    await client.query('COMMIT');
    ok(res, { message: 'Bobine rejetée → rebut' });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur rejet bobine'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// 4. IMPRESSION
// ══════════════════════════════════════════════════════════════

// GET /api/at3/impression
router.get('/impression', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.*, o.numero_of,
             a.code AS article_code, a.designation AS article_nom,
             a.longueur_mm, a.largeur_mm, a.couleur,
             m.code AS machine_code
      FROM bobines_production b
      LEFT JOIN ordres_fabrication o ON o.id = b.of_id
      LEFT JOIN articles a           ON a.id = b.article_id
      LEFT JOIN machines m           ON m.id = b.machine_id
      WHERE b.statut = 'impression'
      ORDER BY b.heure_entree_impr ASC
    `);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur liste impression'); }
});

// POST /api/at3/impression/terminer
router.post('/impression/terminer', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const {
      bobine_id, of_id,
      type_impression, couleur_encre, texte_imprime,
      controle_ok, nb_reprises, motif_reprise, observations
    } = req.body;
    const operateur_id = req.user?.id;

    await client.query(`
      INSERT INTO controles_impression (
        bobine_id, of_id, operateur_id, type_impression,
        couleur_encre, texte_imprime, controle_ok,
        nb_reprises, motif_reprise, observations, heure_fin
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    `, [bobine_id, of_id, operateur_id, type_impression,
        couleur_encre, texte_imprime, controle_ok!==false,
        nb_reprises||0, motif_reprise, observations]);

    const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='EMBL'");
    const zone_embl_id = zoneRes.rows[0]?.id;

    const numRes = await client.query(
      "SELECT 'MVT-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_at3_num')::text,4,'0') AS num"
    );
    const poidsRes = await client.query(
      'SELECT poids_net_kg FROM bobines_production WHERE id=$1', [bobine_id]
    );

    await client.query(`
      INSERT INTO mouvements_at3 (
        numero_ticket, of_id, zone_source_id, zone_dest_id,
        type_mouvement, statut, bobines_ids, nb_bobines,
        poids_total_kg, cree_par, valide_par, date_validation
      ) VALUES (
        $1,$2,
        (SELECT id FROM zones_at3 WHERE code='IMPR'),$3,
        'impression_emballage','valide',
        $4,1,$5,$6,$6,NOW()
      )
    `, [numRes.rows[0].num, of_id, zone_embl_id,
        JSON.stringify([bobine_id]), poidsRes.rows[0]?.poids_net_kg||0, operateur_id]);

    await client.query(`
      UPDATE bobines_production
      SET statut='emballage', zone_actuelle_id=$1,
          heure_sortie_impr=NOW(), heure_entree_embl=NOW(),
          qc_impression=jsonb_build_object('ok',$2,'type',$3,'couleur',$4,'nb_reprises',$5)
      WHERE id=$6
    `, [zone_embl_id, controle_ok!==false, type_impression,
        couleur_encre, nb_reprises||0, bobine_id]);

    await client.query('COMMIT');
    ok(res, { message: 'Bobine → Emballage ✓' });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur fin impression'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// 5. EMBALLAGE
// ══════════════════════════════════════════════════════════════

// GET /api/at3/emballage
router.get('/emballage', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.*, o.numero_of, o.at3_notes_chef,
             a.code AS article_code, a.designation AS article_nom,
             a.poids_theorique_kg
      FROM bobines_production b
      LEFT JOIN ordres_fabrication o ON o.id = b.of_id
      LEFT JOIN articles a           ON a.id = b.article_id
      WHERE b.statut = 'emballage'
      ORDER BY b.heure_entree_embl ASC
    `);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur liste emballage'); }
});

// POST /api/at3/emballage/palette
router.post('/emballage/palette', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const {
      of_id, article_id, bobines_ids,
      nb_sacs, poids_sacs_kg, poids_palette_kg,
      type_emballage, nb_couches, sacs_par_couche,
      article_code, article_nom
    } = req.body;
    const emballeur_id = req.user?.id;

    const ofRow = await client.query('SELECT numero_of FROM ordres_fabrication WHERE id=$1', [of_id]);
    const numero_of = ofRow.rows[0]?.numero_of || 'OF-XXX';

    const lotRow = await client.query(
      'SELECT numero_lot FROM bobines_production WHERE id = ANY($1::uuid[]) LIMIT 1',
      [bobines_ids]
    );
    const numero_lot = lotRow.rows[0]?.numero_lot || '';

    const numRes = await client.query(
      "SELECT 'PAL-' || $1 || '-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_palette_num')::text,3,'0') AS num",
      [numero_of]
    );
    const numero_palette = numRes.rows[0].num;
    const poids_total = parseFloat(poids_sacs_kg||0) + parseFloat(poids_palette_kg||0);

    const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='STKAT3'");
    const zone_stkat3_id = zoneRes.rows[0]?.id;

    const qr_code = `AT3|${numero_palette}|LOT:${numero_lot}|OF:${numero_of}|SACS:${nb_sacs}|KG:${poids_sacs_kg}`;

    const { rows: [palette] } = await client.query(`
      INSERT INTO palettes_emballage (
        numero_palette, of_id, article_id, numero_lot, bobines_ids,
        nb_sacs, poids_sacs_kg, poids_palette_kg, poids_total_kg,
        type_emballage, nb_couches, sacs_par_couche,
        qr_code, zone_id, statut, emballeur_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'stock_at3',$15)
      RETURNING *
    `, [numero_palette, of_id, article_id, numero_lot,
        JSON.stringify(bobines_ids), nb_sacs,
        poids_sacs_kg, poids_palette_kg||0, poids_total,
        type_emballage||'film_etirable', nb_couches, sacs_par_couche,
        qr_code, zone_stkat3_id, emballeur_id]);

    if (bobines_ids?.length) {
      await client.query(`
        UPDATE bobines_production
        SET statut='stock_at3', zone_actuelle_id=$1, heure_fin_embl=NOW()
        WHERE id = ANY($2::uuid[])
      `, [zone_stkat3_id, bobines_ids]);
    }

    const numMvt = await client.query(
      "SELECT 'MVT-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_at3_num')::text,4,'0') AS num"
    );
    await client.query(`
      INSERT INTO mouvements_at3 (
        numero_ticket, of_id, zone_source_id, zone_dest_id,
        type_mouvement, statut, bobines_ids, nb_bobines,
        poids_total_kg, cree_par, valide_par, date_validation
      ) VALUES (
        $1,$2,
        (SELECT id FROM zones_at3 WHERE code='EMBL'),$3,
        'emballage_stock_at3','valide',
        $4,$5,$6,$7,$7,NOW()
      )
    `, [numMvt.rows[0].num, of_id, zone_stkat3_id,
        JSON.stringify(bobines_ids), bobines_ids?.length||0,
        poids_sacs_kg, emballeur_id]);

    await client.query('COMMIT');

    const ticketData = {
      numero_palette, numero_of, numero_lot,
      article_code: article_code||'', article_nom: article_nom||'',
      nb_sacs, poids_sacs_kg, poids_total,
      date: new Date().toLocaleString('fr-FR'),
      qr_code, emballeur: req.user?.nom||''
    };

    ok(res, { palette, ticket: ticketData, message: `Palette ${numero_palette} → Stock AT3 ✓` });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur création palette'); }
  finally { client.release(); }
});

// GET /api/at3/stock
router.get('/stock', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, o.numero_of,
             a.code AS article_code, a.designation AS article_nom,
             u.nom || ' ' || u.prenom AS emballeur_nom
      FROM palettes_emballage p
      LEFT JOIN ordres_fabrication o ON o.id = p.of_id
      LEFT JOIN articles a           ON a.id = p.article_id
      LEFT JOIN utilisateurs u       ON u.id = p.emballeur_id
      WHERE p.statut = 'stock_at3'
      ORDER BY p.created_at DESC
    `);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur stock AT3'); }
});

// ══════════════════════════════════════════════════════════════
// 6. CESSION AT3 → MAGASIN
// ══════════════════════════════════════════════════════════════

// GET /api/at3/cessions
router.get('/cessions', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, o.numero_of,
             u.nom  || ' ' || u.prenom  AS chef_nom,
             r.nom  || ' ' || r.prenom  AS receptionnaire_nom
      FROM cessions_at3 c
      LEFT JOIN ordres_fabrication o ON o.id = c.of_id
      LEFT JOIN utilisateurs u       ON u.id = c.chef_atelier_id
      LEFT JOIN utilisateurs r       ON r.id = c.receptionnaire_id
      ORDER BY c.created_at DESC
      LIMIT 100
    `);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur liste cessions'); }
});

// POST /api/at3/cessions
router.post('/cessions', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { of_id, palettes_ids, notes_chef } = req.body;
    const chef_id = req.user?.id;
    if (!palettes_ids?.length) throw new Error('Aucune palette sélectionnée');

    const numRes = await client.query(
      "SELECT 'CES-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_cession_at3_num')::text,4,'0') AS num"
    );
    const numero_cession = numRes.rows[0].num;

    const totRes = await client.query(`
      SELECT COUNT(*) AS nb, SUM(nb_sacs) AS sacs, SUM(poids_sacs_kg) AS poids
      FROM palettes_emballage WHERE id = ANY($1::uuid[])
    `, [palettes_ids]);
    const { nb, sacs, poids } = totRes.rows[0];

    const { rows: [cession] } = await client.query(`
      INSERT INTO cessions_at3 (
        numero_cession, of_id, palettes_ids,
        nb_palettes, nb_sacs_total, poids_total_kg,
        chef_atelier_id, statut, notes_chef, date_cession
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'soumis',$8,NOW())
      RETURNING *
    `, [numero_cession, of_id, JSON.stringify(palettes_ids),
        parseInt(nb), parseInt(sacs||0), parseFloat(poids||0),
        chef_id, notes_chef||'']);

    await client.query(
      "UPDATE palettes_emballage SET statut='en_cession' WHERE id = ANY($1::uuid[])",
      [palettes_ids]
    );

    const numMvt = await client.query(
      "SELECT 'MVT-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('seq_mvt_at3_num')::text,4,'0') AS num"
    );
    await client.query(`
      INSERT INTO mouvements_at3 (
        numero_ticket, of_id, zone_source_id, zone_dest_id,
        type_mouvement, statut, bobines_ids, nb_bobines, poids_total_kg, cree_par
      ) VALUES (
        $1,$2,
        (SELECT id FROM zones_at3 WHERE code='STKAT3'),
        (SELECT id FROM zones_at3 WHERE code='MAGSIN'),
        'stock_at3_magasin','en_attente','[]',0,$3,$4
      )
    `, [numMvt.rows[0].num, of_id, parseFloat(poids||0), chef_id]);

    await client.query('COMMIT');
    ok(res, { cession, message: `Bon de cession ${numero_cession} créé ✓` });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur création cession'); }
  finally { client.release(); }
});

// PUT /api/at3/cessions/:id/accepter
router.put('/cessions/:id/accepter', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { notes_magasin } = req.body;
    const mag_id = req.user?.id;
    const { rows } = await client.query('SELECT * FROM cessions_at3 WHERE id=$1', [req.params.id]);
    if (!rows.length) return notFound(res, 'Cession introuvable');
    const c = rows[0];
    await client.query(
      "UPDATE cessions_at3 SET statut='accepte', receptionnaire_id=$1, date_reception=NOW(), notes_magasin=$2 WHERE id=$3",
      [mag_id, notes_magasin||'', req.params.id]
    );
    await client.query(
      "UPDATE palettes_emballage SET statut='cede' WHERE id = ANY($1::uuid[])",
      [c.palettes_ids]
    );
    if (c.of_id) {
      await client.query(
        "UPDATE ordres_fabrication SET at3_statut_zone='cede' WHERE id=$1", [c.of_id]
      );
    }
    await client.query(
      "UPDATE mouvements_at3 SET statut='valide', valide_par=$1, date_validation=NOW() WHERE of_id=$2 AND type_mouvement='stock_at3_magasin' AND statut='en_attente'",
      [mag_id, c.of_id]
    );
    await client.query('COMMIT');
    ok(res, { message: 'Cession acceptée — produits au magasin central ✓' });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur acceptation cession'); }
  finally { client.release(); }
});

// PUT /api/at3/cessions/:id/rejeter
router.put('/cessions/:id/rejeter', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { motif } = req.body;
    const { rows } = await client.query('SELECT palettes_ids FROM cessions_at3 WHERE id=$1', [req.params.id]);
    if (!rows.length) return notFound(res, 'Cession introuvable');
    await client.query("UPDATE cessions_at3 SET statut='rejete', notes_magasin=$1 WHERE id=$2", [motif||'', req.params.id]);
    await client.query("UPDATE palettes_emballage SET statut='stock_at3' WHERE id = ANY($1::uuid[])", [rows[0].palettes_ids]);
    await client.query('COMMIT');
    ok(res, { message: 'Cession rejetée — palettes remises en stock AT3' });
  } catch(e) { await client.query('ROLLBACK'); erreur(res, e, 'Erreur rejet cession'); }
  finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════
// 7. DASHBOARD & MOUVEMENTS
// ══════════════════════════════════════════════════════════════

// GET /api/at3/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [flux, zones, mvts] = await Promise.all([
      db.query('SELECT * FROM vue_flux_at3 ORDER BY of_id DESC LIMIT 20'),
      db.query(`
        SELECT z.code, z.libelle, z.type,
          (SELECT COUNT(*) FROM bobines_production b
           JOIN zones_at3 z2 ON z2.id=b.zone_actuelle_id
           WHERE z2.code=z.code AND b.statut NOT IN ('cede','rebut')) AS nb_bobines,
          (SELECT COALESCE(SUM(b.poids_net_kg),0) FROM bobines_production b
           JOIN zones_at3 z2 ON z2.id=b.zone_actuelle_id
           WHERE z2.code=z.code AND b.statut NOT IN ('cede','rebut')) AS poids_kg
        FROM zones_at3 z WHERE z.actif=true ORDER BY z.ordre
      `),
      db.query(`
        SELECT type_mouvement, COUNT(*) AS nb, SUM(poids_total_kg) AS poids
        FROM mouvements_at3 WHERE date_mouvement >= CURRENT_DATE
        GROUP BY type_mouvement
      `)
    ]);
    ok(res, { flux: flux.rows, zones: zones.rows, mouvements_jour: mvts.rows });
  } catch(e) { erreur(res, e, 'Erreur dashboard AT3'); }
});

// GET /api/at3/mouvements
router.get('/mouvements', auth, async (req, res) => {
  try {
    const { of_id, type, limit=50 } = req.query;
    let q = `
      SELECT m.*, zs.code AS source_code, zs.libelle AS source_libelle,
             zd.code AS dest_code, zd.libelle AS dest_libelle,
             o.numero_of,
             u.nom || ' ' || u.prenom AS cree_par_nom
      FROM mouvements_at3 m
      LEFT JOIN zones_at3 zs             ON zs.id = m.zone_source_id
      LEFT JOIN zones_at3 zd             ON zd.id = m.zone_dest_id
      LEFT JOIN ordres_fabrication o     ON o.id  = m.of_id
      LEFT JOIN utilisateurs u           ON u.id  = m.cree_par
      WHERE 1=1
    `;
    const params = [];
    if (of_id) { params.push(of_id); q += ` AND m.of_id=$${params.length}`; }
    if (type)  { params.push(type);  q += ` AND m.type_mouvement=$${params.length}`; }
    params.push(parseInt(limit));
    q += ` ORDER BY m.date_mouvement DESC LIMIT $${params.length}`;
    const { rows } = await db.query(q, params);
    ok(res, rows);
  } catch(e) { erreur(res, e, 'Erreur mouvements AT3'); }
});

// GET /api/at3/ticket/bobine/:id
router.get('/ticket/bobine/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.numero_bobine, b.numero_lot, b.poids_net_kg, b.poids_brut_kg,
             b.created_at, b.statut,
             o.numero_of, o.quantite_cible AS qte_of,
             a.code AS article_code, a.designation AS article_nom,
             a.couleur, a.longueur_mm, a.largeur_mm,
             c.nom AS client_nom,
             m.code AS machine_code,
             u.nom || ' ' || u.prenom AS operateur_nom
      FROM bobines_production b
      LEFT JOIN ordres_fabrication o ON o.id = b.of_id
      LEFT JOIN articles a           ON a.id = b.article_id
      LEFT JOIN clients c            ON c.id = o.client_id
      LEFT JOIN machines m           ON m.id = b.machine_id
      LEFT JOIN utilisateurs u       ON u.id = b.operateur_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!rows.length) return notFound(res, 'Bobine introuvable');
    ok(res, rows[0]);
  } catch(e) { erreur(res, e, 'Erreur ticket bobine'); }
});

// GET /api/at3/ticket/palette/:id
router.get('/ticket/palette/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.numero_palette, p.numero_lot, p.nb_sacs,
             p.poids_sacs_kg, p.poids_total_kg, p.qr_code,
             p.type_emballage, p.nb_couches, p.sacs_par_couche, p.created_at,
             o.numero_of,
             a.code AS article_code, a.designation AS article_nom,
             a.longueur_mm, a.largeur_mm, a.couleur,
             c.nom AS client_nom,
             u.nom || ' ' || u.prenom AS emballeur_nom
      FROM palettes_emballage p
      LEFT JOIN ordres_fabrication o ON o.id = p.of_id
      LEFT JOIN articles a           ON a.id = p.article_id
      LEFT JOIN clients c            ON c.id = o.client_id
      LEFT JOIN utilisateurs u       ON u.id = p.emballeur_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows.length) return notFound(res, 'Palette introuvable');
    ok(res, rows[0]);
  } catch(e) { erreur(res, e, 'Erreur ticket palette'); }
});

module.exports = router;
