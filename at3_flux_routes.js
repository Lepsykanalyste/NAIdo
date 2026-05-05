// ============================================================
// NAIdo — AT3 FLUX COMPLET — Routes Express
// Fichier : at3_flux_routes.js
// À inclure dans server.js :  require('./at3_flux_routes')(app, pool, authenticateToken)
// ============================================================

module.exports = function(app, pool, authenticateToken) {

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════
  const ok  = (res, data)         => res.json(data);
  const err = (res, e, msg = '')  => {
    console.error('[AT3]', msg, e?.message || e);
    res.status(500).json({ error: msg || e?.message || 'Erreur serveur' });
  };
  const notFound = (res, msg) => res.status(404).json({ error: msg });

  // ══════════════════════════════════════════════════════════
  // 1. OF → CHEF ATELIER
  //    Récupérer les OF reçus par l'atelier 3 + configurer la fiche
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/of — Liste des OF affectés AT3
  app.get('/api/at3/of', authenticateToken, async (req, res) => {
    try {
      const { statut, search } = req.query;
      let q = `
        SELECT o.*, a.code AS article_code, a.designation AS article_nom,
               a.poids_theorique_kg, a.cadence_theorique_kg_h,
               a.composition, a.couleur, a.longueur_mm, a.largeur_mm,
               c.nom AS client_nom,
               m.code AS machine_code,
               u.nom || ' ' || u.prenom AS valide_par_nom,
               (SELECT COUNT(*) FROM bobines_production b WHERE b.of_id = o.id) AS nb_bobines,
               (SELECT COALESCE(SUM(poids_net_kg),0) FROM bobines_production b WHERE b.of_id = o.id) AS poids_produit_kg,
               (SELECT COUNT(*) FROM palettes_emballage p WHERE p.of_id = o.id) AS nb_palettes
        FROM ordres_fabrication o
        LEFT JOIN articles a ON a.id = o.article_id
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
        LEFT JOIN utilisateurs u ON u.id = o.at3_valide_par
        WHERE o.statut NOT IN ('annule','archive','brouillon')
      `;
      const params = [];
      if (statut) { params.push(statut); q += ` AND o.at3_statut_zone = $${params.length}`; }
      if (search) { params.push(`%${search}%`); q += ` AND (o.numero_of ILIKE $${params.length} OR a.designation ILIKE $${params.length})`; }
      q += ' ORDER BY o.created_at DESC LIMIT 100';
      const { rows } = await pool.query(q, params);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur liste OF AT3'); }
  });

  // GET /api/at3/of/:id — Détail complet d'un OF pour le chef atelier
  app.get('/api/at3/of/:id', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT o.*,
               a.code AS article_code, a.designation AS article_nom,
               a.poids_theorique_kg, a.cadence_theorique_kg_h,
               a.composition, a.poids_mandrin_kg, a.couleur,
               a.longueur_mm, a.largeur_mm, a.hauteur_mm,
               a.tracabilite_type, a.format_lot,
               c.nom AS client_nom, c.telephone AS client_tel,
               m.code AS machine_code, m.libelle AS machine_libelle
        FROM ordres_fabrication o
        LEFT JOIN articles a ON a.id = o.article_id
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
        WHERE o.id = $1
      `, [req.params.id]);
      if (!rows.length) return notFound(res, 'OF introuvable');
      ok(res, rows[0]);
    } catch(e) { err(res, e, 'Erreur détail OF'); }
  });

  // PUT /api/at3/of/:id/configurer — Chef atelier valide la fiche de production
  app.put('/api/at3/of/:id/configurer', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        at3_poids_cible_kg, at3_nb_bobines_cibles,
        at3_notes_regleur, at3_notes_chef,
        at3_machine_assignee_id, valider
      } = req.body;
      const userId = req.user?.id;

      const fields = [
        'at3_poids_cible_kg = $2',
        'at3_nb_bobines_cibles = $3',
        'at3_notes_regleur = $4',
        'at3_notes_chef = $5',
        'at3_machine_assignee_id = $6',
      ];
      const params = [req.params.id, at3_poids_cible_kg, at3_nb_bobines_cibles,
                      at3_notes_regleur, at3_notes_chef, at3_machine_assignee_id || null];

      if (valider) {
        fields.push(`at3_composition_validee = true`);
        fields.push(`at3_statut_zone = 'extrusion'`);
        fields.push(`at3_valide_par = $${params.length + 1}`);
        fields.push(`at3_valide_le = NOW()`);
        params.push(userId);
      }

      await client.query(
        `UPDATE ordres_fabrication SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`,
        params
      );
      await client.query('COMMIT');
      ok(res, { success: true, message: valider ? 'OF configuré et lancé en extrusion' : 'Configuration enregistrée' });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur configuration OF'); }
    finally { client.release(); }
  });

  // ══════════════════════════════════════════════════════════
  // 2. EXTRUSION — Saisie bobines
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/extrusion/of-actifs — OF en cours d'extrusion pour opérateur
  app.get('/api/at3/extrusion/of-actifs', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT o.id, o.numero_of, o.at3_poids_cible_kg, o.at3_nb_bobines_cibles,
               o.at3_notes_regleur, o.at3_machine_assignee_id,
               a.code AS article_code, a.designation AS article_nom,
               a.poids_theorique_kg, a.couleur, a.format_lot,
               m.code AS machine_code,
               COALESCE((SELECT COUNT(*) FROM bobines_production b WHERE b.of_id=o.id),0) AS nb_bobines_faites,
               COALESCE((SELECT SUM(poids_net_kg) FROM bobines_production b WHERE b.of_id=o.id),0) AS poids_fait_kg
        FROM ordres_fabrication o
        LEFT JOIN articles a ON a.id = o.article_id
        LEFT JOIN machines m ON m.id = o.at3_machine_assignee_id
        WHERE o.at3_statut_zone = 'extrusion'
          AND o.at3_composition_validee = true
        ORDER BY o.at3_valide_le ASC
      `);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur OF actifs extrusion'); }
  });

  // GET /api/at3/extrusion/:of_id/bobines — Bobines d'un OF
  app.get('/api/at3/extrusion/:of_id/bobines', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT b.*, z.code AS zone_code, z.libelle AS zone_libelle,
               m.code AS machine_code, u.nom || ' ' || u.prenom AS operateur_nom
        FROM bobines_production b
        LEFT JOIN zones_at3 z ON z.id = b.zone_actuelle_id
        LEFT JOIN machines m ON m.id = b.machine_id
        LEFT JOIN utilisateurs u ON u.id = b.operateur_id
        WHERE b.of_id = $1
        ORDER BY b.created_at DESC
      `, [req.params.of_id]);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur bobines OF'); }
  });

  // POST /api/at3/extrusion/bobine — Créer une nouvelle bobine
  app.post('/api/at3/extrusion/bobine', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        of_id, machine_id,
        poids_brut_kg, poids_net_kg, poids_mandrin_kg,
        longueur_m, temperature_c, vitesse_m_min, pression_bar
      } = req.body;
      const operateur_id = req.user?.id;

      // Récupérer infos OF + article
      const ofRow = await client.query(
        'SELECT o.numero_of, o.article_id, a.format_lot FROM ordres_fabrication o LEFT JOIN articles a ON a.id=o.article_id WHERE o.id=$1',
        [of_id]
      );
      if (!ofRow.rows.length) throw new Error('OF introuvable');
      const { numero_of, article_id, format_lot } = ofRow.rows[0];

      // Récupérer code machine
      const machRow = await client.query('SELECT code FROM machines WHERE id=$1', [machine_id]);
      const machine_code = machRow.rows[0]?.code || 'XX';

      // Générer numéros
      const numRes = await client.query("SELECT gen_numero_bobine($1,$2) AS nb", [numero_of, machine_code]);
      const numero_bobine = numRes.rows[0].nb;

      // Numéro de lot = partagé pour le même OF (format_lot ou auto)
      const lotRes = await client.query(
        "SELECT numero_lot FROM bobines_production WHERE of_id=$1 LIMIT 1", [of_id]
      );
      let numero_lot = lotRes.rows[0]?.numero_lot;
      if (!numero_lot) {
        numero_lot = 'LOT-' + numero_of + '-' + new Date().toISOString().slice(0,10).replace(/-/g,'');
      }

      // Zone quarantaine ID
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
          poids_brut_kg, poids_net_kg, poids_mandrin_kg || 0, longueur_m,
          temperature_c, vitesse_m_min, pression_bar, zone_quar_id]);

      await client.query('COMMIT');
      ok(res, { bobine: rows[0], message: `Bobine ${numero_bobine} créée → Zone Quarantaine` });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur création bobine'); }
    finally { client.release(); }
  });

  // ══════════════════════════════════════════════════════════
  // 3. QUARANTAINE — Vue + Validation → Impression
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/quarantaine — Bobines en quarantaine (chef atelier)
  app.get('/api/at3/quarantaine', authenticateToken, async (req, res) => {
    try {
      const { of_id } = req.query;
      let q = `
        SELECT b.*, o.numero_of, a.code AS article_code, a.designation AS article_nom,
               m.code AS machine_code, u.nom || ' ' || u.prenom AS operateur_nom,
               EXTRACT(EPOCH FROM (NOW() - b.heure_entree_quar))/60 AS minutes_en_quarantaine
        FROM bobines_production b
        LEFT JOIN ordres_fabrication o ON o.id=b.of_id
        LEFT JOIN articles a ON a.id=b.article_id
        LEFT JOIN machines m ON m.id=b.machine_id
        LEFT JOIN utilisateurs u ON u.id=b.operateur_id
        WHERE b.statut IN ('quarantaine','en_quarantaine')
      `;
      const params = [];
      if (of_id) { params.push(of_id); q += ` AND b.of_id = $${params.length}`; }
      q += ' ORDER BY b.heure_entree_quar ASC';
      const { rows } = await pool.query(q, params);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur quarantaine'); }
  });

  // POST /api/at3/quarantaine/valider — Chef atelier valide bobines → Impression
  app.post('/api/at3/quarantaine/valider', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { bobines_ids, of_id, notes } = req.body;
      const chef_id = req.user?.id;
      if (!bobines_ids?.length) throw new Error('Aucune bobine sélectionnée');

      // Zone impression
      const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='IMPR'");
      const zone_impr_id = zoneRes.rows[0]?.id;

      // Générer ticket mouvement
      const numRes = await client.query("SELECT gen_numero_mvt_at3() AS num");
      const numero_ticket = numRes.rows[0].num;

      // Calcul poids total
      const poidsRes = await client.query(
        'SELECT COALESCE(SUM(poids_net_kg),0) AS total FROM bobines_production WHERE id = ANY($1::uuid[])',
        [bobines_ids]
      );
      const poids_total = poidsRes.rows[0].total;

      // Créer mouvement AT3
      const { rows: [mvt] } = await client.query(`
        INSERT INTO mouvements_at3 (
          numero_ticket, of_id, zone_source_id, zone_dest_id,
          type_mouvement, statut, bobines_ids, nb_bobines,
          poids_total_kg, cree_par, valide_par, date_validation, notes
        ) VALUES (
          $1, $2,
          (SELECT id FROM zones_at3 WHERE code='QUAR'),
          $3,
          'quarantaine_impression', 'valide',
          $4, $5, $6, $7, $7, NOW(), $8
        ) RETURNING *
      `, [numero_ticket, of_id, zone_impr_id,
          JSON.stringify(bobines_ids), bobines_ids.length,
          poids_total, chef_id, notes || '']);

      // Mettre à jour chaque bobine
      await client.query(`
        UPDATE bobines_production
        SET statut='impression', zone_actuelle_id=$1,
            heure_sortie_quar=NOW(), heure_entree_impr=NOW(),
            qc_quarantaine = jsonb_build_object('ok',true,'valide_par',$2,'valide_le',NOW()::text)
        WHERE id = ANY($3::uuid[])
      `, [zone_impr_id, chef_id, bobines_ids]);

      await client.query('COMMIT');
      ok(res, { mouvement: mvt, message: `${bobines_ids.length} bobine(s) envoyées à l'impression — Ticket: ${numero_ticket}` });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur validation quarantaine'); }
    finally { client.release(); }
  });

  // POST /api/at3/quarantaine/rejeter — Rejeter bobine → rebut
  app.post('/api/at3/quarantaine/rejeter', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { bobine_id, motif } = req.body;
      const chef_id = req.user?.id;
      await client.query(`
        UPDATE bobines_production
        SET statut='rebut', heure_sortie_quar=NOW(),
            qc_quarantaine = jsonb_build_object('ok',false,'motif',$1,'rejete_par',$2,'rejete_le',NOW()::text)
        WHERE id = $3
      `, [motif, chef_id, bobine_id]);
      await client.query('COMMIT');
      ok(res, { message: 'Bobine rejetée — statut : rebut' });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur rejet bobine'); }
    finally { client.release(); }
  });

  // ══════════════════════════════════════════════════════════
  // 4. IMPRESSION
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/impression — Bobines à imprimer
  app.get('/api/at3/impression', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT b.*, o.numero_of, a.code AS article_code, a.designation AS article_nom,
               a.longueur_mm, a.largeur_mm, a.couleur,
               m.code AS machine_code
        FROM bobines_production b
        LEFT JOIN ordres_fabrication o ON o.id=b.of_id
        LEFT JOIN articles a ON a.id=b.article_id
        LEFT JOIN machines m ON m.id=b.machine_id
        WHERE b.statut='impression'
        ORDER BY b.heure_entree_impr ASC
      `);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur liste impression'); }
  });

  // POST /api/at3/impression/terminer — Bobine impression terminée → Emballage
  app.post('/api/at3/impression/terminer', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        bobine_id, of_id,
        type_impression, couleur_encre, texte_imprime,
        controle_ok, nb_reprises, motif_reprise, observations
      } = req.body;
      const operateur_id = req.user?.id;

      // Enregistrer contrôle impression
      await client.query(`
        INSERT INTO controles_impression (
          bobine_id, of_id, operateur_id, type_impression, couleur_encre,
          texte_imprime, controle_ok, nb_reprises, motif_reprise, observations, heure_fin
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      `, [bobine_id, of_id, operateur_id, type_impression, couleur_encre,
          texte_imprime, controle_ok !== false, nb_reprises || 0, motif_reprise, observations]);

      // Zone emballage
      const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='EMBL'");
      const zone_embl_id = zoneRes.rows[0]?.id;

      // Ticket mouvement impression → emballage
      const numRes = await client.query("SELECT gen_numero_mvt_at3() AS num");
      const numero_ticket = numRes.rows[0].num;

      const poidsRes = await client.query(
        'SELECT poids_net_kg, of_id FROM bobines_production WHERE id=$1', [bobine_id]
      );
      const { poids_net_kg } = poidsRes.rows[0];

      await client.query(`
        INSERT INTO mouvements_at3 (
          numero_ticket, of_id, zone_source_id, zone_dest_id,
          type_mouvement, statut, bobines_ids, nb_bobines,
          poids_total_kg, cree_par, valide_par, date_validation
        ) VALUES (
          $1, $2,
          (SELECT id FROM zones_at3 WHERE code='IMPR'), $3,
          'impression_emballage','valide',
          $4, 1, $5, $6, $6, NOW()
        )
      `, [numero_ticket, of_id, zone_embl_id,
          JSON.stringify([bobine_id]), poids_net_kg, operateur_id]);

      // Mettre à jour bobine
      await client.query(`
        UPDATE bobines_production
        SET statut='emballage', zone_actuelle_id=$1,
            heure_sortie_impr=NOW(), heure_entree_embl=NOW(),
            qc_impression=jsonb_build_object(
              'ok',$2,'type',$3,'couleur',$4,'nb_reprises',$5,'operateur_id',$6
            )
        WHERE id=$7
      `, [zone_embl_id, controle_ok !== false, type_impression,
          couleur_encre, nb_reprises || 0, operateur_id, bobine_id]);

      await client.query('COMMIT');
      ok(res, { message: `Bobine envoyée en emballage — Ticket: ${numero_ticket}` });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur fin impression'); }
    finally { client.release(); }
  });

  // ══════════════════════════════════════════════════════════
  // 5. EMBALLAGE — Création palette + ticket ESC/POS
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/emballage — Bobines en attente d'emballage
  app.get('/api/at3/emballage', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT b.*, o.numero_of, o.at3_notes_chef,
               a.code AS article_code, a.designation AS article_nom,
               a.poids_theorique_kg
        FROM bobines_production b
        LEFT JOIN ordres_fabrication o ON o.id=b.of_id
        LEFT JOIN articles a ON a.id=b.article_id
        WHERE b.statut='emballage'
        ORDER BY b.heure_entree_embl ASC
      `);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur liste emballage'); }
  });

  // POST /api/at3/emballage/palette — Créer une palette
  app.post('/api/at3/emballage/palette', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        of_id, article_id, bobines_ids,
        nb_sacs, poids_sacs_kg, poids_palette_kg,
        type_emballage, nb_couches, sacs_par_couche
      } = req.body;
      const emballeur_id = req.user?.id;

      // Récupérer numéro OF
      const ofRow = await client.query('SELECT numero_of FROM ordres_fabrication WHERE id=$1', [of_id]);
      const numero_of = ofRow.rows[0]?.numero_of || 'OF-XXX';

      // Récupérer numéro de lot des bobines
      const lotRow = await client.query(
        'SELECT numero_lot FROM bobines_production WHERE id = ANY($1::uuid[]) LIMIT 1',
        [bobines_ids]
      );
      const numero_lot = lotRow.rows[0]?.numero_lot || '';

      // Générer numéro palette
      const numRes = await client.query("SELECT gen_numero_palette($1) AS num", [numero_of]);
      const numero_palette = numRes.rows[0].num;

      const poids_total = parseFloat(poids_sacs_kg || 0) + parseFloat(poids_palette_kg || 0);

      // Zone stock AT3
      const zoneRes = await client.query("SELECT id FROM zones_at3 WHERE code='STKAT3'");
      const zone_stkat3_id = zoneRes.rows[0]?.id;

      // Générer QR code simple (contenu traçabilité)
      const qr_code = `AT3|${numero_palette}|LOT:${numero_lot}|OF:${numero_of}|SACS:${nb_sacs}|KG:${poids_sacs_kg}`;

      const { rows: [palette] } = await client.query(`
        INSERT INTO palettes_emballage (
          numero_palette, of_id, article_id, numero_lot, bobines_ids,
          nb_sacs, poids_sacs_kg, poids_palette_kg, poids_total_kg,
          type_emballage, nb_couches, sacs_par_couche,
          qr_code, zone_id, statut, emballeur_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'stock_at3',$15)
        RETURNING *
      `, [numero_palette, of_id, article_id, numero_lot, JSON.stringify(bobines_ids),
          nb_sacs, poids_sacs_kg, poids_palette_kg || 0, poids_total,
          type_emballage || 'film_etirable', nb_couches, sacs_par_couche,
          qr_code, zone_stkat3_id, emballeur_id]);

      // Mettre à jour bobines → stock_at3
      if (bobines_ids?.length) {
        await client.query(`
          UPDATE bobines_production
          SET statut='stock_at3', zone_actuelle_id=$1, heure_fin_embl=NOW()
          WHERE id = ANY($2::uuid[])
        `, [zone_stkat3_id, bobines_ids]);
      }

      // Ticket mouvement emballage → stock_at3
      const numMvtRes = await client.query("SELECT gen_numero_mvt_at3() AS num");
      await client.query(`
        INSERT INTO mouvements_at3 (
          numero_ticket, of_id, zone_source_id, zone_dest_id,
          type_mouvement, statut, bobines_ids, nb_bobines,
          poids_total_kg, cree_par, valide_par, date_validation
        ) VALUES (
          $1, $2,
          (SELECT id FROM zones_at3 WHERE code='EMBL'), $3,
          'emballage_stock_at3','valide',
          $4, $5, $6, $7, $7, NOW()
        )
      `, [numMvtRes.rows[0].num, of_id, zone_stkat3_id,
          JSON.stringify(bobines_ids), bobines_ids?.length || 0,
          poids_sacs_kg, emballeur_id]);

      await client.query('COMMIT');

      // Données ticket ESC/POS
      const ticketData = {
        numero_palette,
        numero_of,
        numero_lot,
        article_code: req.body.article_code || '',
        article_nom: req.body.article_nom || '',
        nb_sacs,
        poids_sacs_kg,
        poids_total,
        date: new Date().toLocaleString('fr-FR'),
        qr_code,
        emballeur: req.user?.nom || ''
      };

      ok(res, { palette: palette, ticket: ticketData, message: `Palette ${numero_palette} créée — Stock AT3` });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur création palette'); }
    finally { client.release(); }
  });

  // GET /api/at3/stock — Stock interne AT3 (palettes prêtes)
  app.get('/api/at3/stock', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT p.*, o.numero_of,
               a.code AS article_code, a.designation AS article_nom,
               u.nom || ' ' || u.prenom AS emballeur_nom
        FROM palettes_emballage p
        LEFT JOIN ordres_fabrication o ON o.id=p.of_id
        LEFT JOIN articles a ON a.id=p.article_id
        LEFT JOIN utilisateurs u ON u.id=p.emballeur_id
        WHERE p.statut='stock_at3'
        ORDER BY p.created_at DESC
      `);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur stock AT3'); }
  });

  // ══════════════════════════════════════════════════════════
  // 6. CESSION AT3 → MAGASIN CENTRAL
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/cessions — Liste des cessions
  app.get('/api/at3/cessions', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT c.*,
               o.numero_of,
               u.nom || ' ' || u.prenom AS chef_nom,
               r.nom || ' ' || r.prenom AS receptionnaire_nom
        FROM cessions_at3 c
        LEFT JOIN ordres_fabrication o ON o.id=c.of_id
        LEFT JOIN utilisateurs u ON u.id=c.chef_atelier_id
        LEFT JOIN utilisateurs r ON r.id=c.receptionnaire_id
        ORDER BY c.created_at DESC
        LIMIT 100
      `);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur liste cessions'); }
  });

  // POST /api/at3/cessions — Créer un bon de cession AT3 → Magasin
  app.post('/api/at3/cessions', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { of_id, palettes_ids, notes_chef } = req.body;
      const chef_id = req.user?.id;
      if (!palettes_ids?.length) throw new Error('Aucune palette sélectionnée');

      // Générer numéro cession
      const numRes = await client.query("SELECT gen_numero_cession_at3() AS num");
      const numero_cession = numRes.rows[0].num;

      // Calculer totaux
      const totRes = await client.query(`
        SELECT COUNT(*) AS nb, SUM(nb_sacs) AS sacs, SUM(poids_sacs_kg) AS poids
        FROM palettes_emballage
        WHERE id = ANY($1::uuid[])
      `, [palettes_ids]);
      const { nb, sacs, poids } = totRes.rows[0];

      // Créer la cession
      const { rows: [cession] } = await client.query(`
        INSERT INTO cessions_at3 (
          numero_cession, of_id, palettes_ids,
          nb_palettes, nb_sacs_total, poids_total_kg,
          chef_atelier_id, statut, notes_chef, date_cession
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'soumis',$8,NOW())
        RETURNING *
      `, [numero_cession, of_id, JSON.stringify(palettes_ids),
          parseInt(nb), parseInt(sacs || 0), parseFloat(poids || 0),
          chef_id, notes_chef || '']);

      // Marquer palettes comme "en_cession"
      await client.query(`
        UPDATE palettes_emballage SET statut='en_cession' WHERE id = ANY($1::uuid[])
      `, [palettes_ids]);

      // Créer aussi dans bons_cession si la table existe
      try {
        const bcNum = await client.query(`
          SELECT 'BC-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' ||
                 LPAD((SELECT COUNT(*)+1 FROM bons_cession WHERE created_at::date=CURRENT_DATE)::text,4,'0')
          AS num
        `);
        const bc_numero = bcNum.rows[0].num;
        const bcRes = await client.query(`
          INSERT INTO bons_cession (numero_bon, of_id, type_mouvement, statut, notes, cree_par)
          VALUES ($1,$2,'cession_magasin','soumis',$3,$4)
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [bc_numero, of_id, notes_chef || '', chef_id]);
        if (bcRes.rows[0]) {
          await client.query(`
            UPDATE cessions_at3 SET bon_cession_id=$1 WHERE id=$2
          `, [bcRes.rows[0].id, cession.id]);
        }
      } catch(e2) { /* bons_cession optionnel */ }

      // Ticket mouvement stock_at3 → magasin
      const numMvtRes = await client.query("SELECT gen_numero_mvt_at3() AS num");
      await client.query(`
        INSERT INTO mouvements_at3 (
          numero_ticket, of_id,
          zone_source_id, zone_dest_id,
          type_mouvement, statut,
          bobines_ids, nb_bobines, poids_total_kg, cree_par
        ) VALUES (
          $1, $2,
          (SELECT id FROM zones_at3 WHERE code='STKAT3'),
          (SELECT id FROM zones_at3 WHERE code='MAGSIN'),
          'stock_at3_magasin','en_attente',
          '[]', 0, $3, $4
        )
      `, [numMvtRes.rows[0].num, of_id, parseFloat(poids || 0), chef_id]);

      await client.query('COMMIT');
      ok(res, { cession, message: `Bon de cession ${numero_cession} créé — En attente validation magasin` });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur création cession'); }
    finally { client.release(); }
  });

  // PUT /api/at3/cessions/:id/accepter — Magasinier accepte la cession
  app.put('/api/at3/cessions/:id/accepter', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { notes_magasin } = req.body;
      const magasinier_id = req.user?.id;

      const { rows: [c] } = await client.query(
        'SELECT * FROM cessions_at3 WHERE id=$1', [req.params.id]
      );
      if (!c) return notFound(res, 'Cession introuvable');

      // Mettre à jour cession
      await client.query(`
        UPDATE cessions_at3
        SET statut='accepte', receptionnaire_id=$1, date_reception=NOW(), notes_magasin=$2
        WHERE id=$3
      `, [magasinier_id, notes_magasin || '', req.params.id]);

      // Mettre à jour palettes → cédées
      const palettes_ids = c.palettes_ids;
      await client.query(`
        UPDATE palettes_emballage SET statut='cede' WHERE id = ANY($1::uuid[])
      `, [palettes_ids]);

      // Mettre à jour OF → statut zone "cede"
      if (c.of_id) {
        await client.query(`
          UPDATE ordres_fabrication SET at3_statut_zone='cede' WHERE id=$1
        `, [c.of_id]);
      }

      // Valider le mouvement AT3 correspondant
      await client.query(`
        UPDATE mouvements_at3 SET statut='valide', valide_par=$1, date_validation=NOW()
        WHERE of_id=$2 AND type_mouvement='stock_at3_magasin' AND statut='en_attente'
      `, [magasinier_id, c.of_id]);

      await client.query('COMMIT');
      ok(res, { message: 'Cession acceptée — Produits transférés au magasin central' });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur acceptation cession'); }
    finally { client.release(); }
  });

  // PUT /api/at3/cessions/:id/rejeter — Magasinier rejette
  app.put('/api/at3/cessions/:id/rejeter', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { motif } = req.body;
      const { rows: [c] } = await client.query(
        'SELECT palettes_ids FROM cessions_at3 WHERE id=$1', [req.params.id]
      );
      if (!c) return notFound(res, 'Cession introuvable');
      await client.query(`
        UPDATE cessions_at3 SET statut='rejete', notes_magasin=$1 WHERE id=$2
      `, [motif || '', req.params.id]);
      await client.query(`
        UPDATE palettes_emballage SET statut='stock_at3' WHERE id = ANY($1::uuid[])
      `, [c.palettes_ids]);
      await client.query('COMMIT');
      ok(res, { message: 'Cession rejetée — Palettes remises en stock AT3' });
    } catch(e) { await client.query('ROLLBACK'); err(res, e, 'Erreur rejet cession'); }
    finally { client.release(); }
  });

  // ══════════════════════════════════════════════════════════
  // 7. TABLEAU DE BORD AT3 FLUX
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/dashboard — KPIs flux AT3
  app.get('/api/at3/dashboard', authenticateToken, async (req, res) => {
    try {
      const [flux, zones, mvts] = await Promise.all([
        pool.query('SELECT * FROM vue_flux_at3 ORDER BY of_id DESC LIMIT 20'),
        pool.query(`
          SELECT z.code, z.libelle, z.type,
            (SELECT COUNT(*) FROM bobines_production b
             LEFT JOIN zones_at3 z2 ON z2.id=b.zone_actuelle_id
             WHERE z2.code=z.code AND b.statut NOT IN ('cede','rebut')) AS nb_bobines,
            (SELECT COALESCE(SUM(b.poids_net_kg),0) FROM bobines_production b
             LEFT JOIN zones_at3 z2 ON z2.id=b.zone_actuelle_id
             WHERE z2.code=z.code AND b.statut NOT IN ('cede','rebut')) AS poids_kg
          FROM zones_at3 z WHERE z.actif=true ORDER BY z.ordre
        `),
        pool.query(`
          SELECT type_mouvement, COUNT(*) AS nb, SUM(poids_total_kg) AS poids
          FROM mouvements_at3
          WHERE date_mouvement >= CURRENT_DATE
          GROUP BY type_mouvement
        `)
      ]);
      ok(res, {
        flux: flux.rows,
        zones: zones.rows,
        mouvements_jour: mvts.rows
      });
    } catch(e) { err(res, e, 'Erreur dashboard AT3'); }
  });

  // GET /api/at3/mouvements — Historique des tickets de mouvement
  app.get('/api/at3/mouvements', authenticateToken, async (req, res) => {
    try {
      const { of_id, type, limit = 50 } = req.query;
      let q = `
        SELECT m.*, zs.code AS source_code, zs.libelle AS source_libelle,
               zd.code AS dest_code, zd.libelle AS dest_libelle,
               o.numero_of,
               u.nom || ' ' || u.prenom AS cree_par_nom
        FROM mouvements_at3 m
        LEFT JOIN zones_at3 zs ON zs.id=m.zone_source_id
        LEFT JOIN zones_at3 zd ON zd.id=m.zone_dest_id
        LEFT JOIN ordres_fabrication o ON o.id=m.of_id
        LEFT JOIN utilisateurs u ON u.id=m.cree_par
        WHERE 1=1
      `;
      const params = [];
      if (of_id) { params.push(of_id); q += ` AND m.of_id=$${params.length}`; }
      if (type)  { params.push(type);  q += ` AND m.type_mouvement=$${params.length}`; }
      params.push(parseInt(limit));
      q += ` ORDER BY m.date_mouvement DESC LIMIT $${params.length}`;
      const { rows } = await pool.query(q, params);
      ok(res, rows);
    } catch(e) { err(res, e, 'Erreur mouvements AT3'); }
  });

  // ══════════════════════════════════════════════════════════
  // 8. DONNÉES TICKET ESC/POS — Format compatible imprimante thermique
  // ══════════════════════════════════════════════════════════

  // GET /api/at3/ticket/bobine/:id — Données ticket bobine
  app.get('/api/at3/ticket/bobine/:id', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT b.numero_bobine, b.numero_lot, b.poids_net_kg, b.poids_brut_kg,
               b.created_at, b.statut,
               o.numero_of, o.quantite AS qte_of,
               a.code AS article_code, a.designation AS article_nom,
               a.couleur, a.longueur_mm, a.largeur_mm,
               c.nom AS client_nom,
               m.code AS machine_code,
               u.nom || ' ' || u.prenom AS operateur_nom
        FROM bobines_production b
        LEFT JOIN ordres_fabrication o ON o.id=b.of_id
        LEFT JOIN articles a ON a.id=b.article_id
        LEFT JOIN clients c ON c.id=o.client_id
        LEFT JOIN machines m ON m.id=b.machine_id
        LEFT JOIN utilisateurs u ON u.id=b.operateur_id
        WHERE b.id=$1
      `, [req.params.id]);
      if (!rows.length) return notFound(res, 'Bobine introuvable');
      ok(res, rows[0]);
    } catch(e) { err(res, e, 'Erreur ticket bobine'); }
  });

  // GET /api/at3/ticket/palette/:id — Données ticket palette
  app.get('/api/at3/ticket/palette/:id', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT p.numero_palette, p.numero_lot, p.nb_sacs,
               p.poids_sacs_kg, p.poids_total_kg, p.qr_code,
               p.type_emballage, p.nb_couches, p.sacs_par_couche,
               p.created_at,
               o.numero_of,
               a.code AS article_code, a.designation AS article_nom,
               a.longueur_mm, a.largeur_mm, a.couleur,
               c.nom AS client_nom,
               u.nom || ' ' || u.prenom AS emballeur_nom
        FROM palettes_emballage p
        LEFT JOIN ordres_fabrication o ON o.id=p.of_id
        LEFT JOIN articles a ON a.id=p.article_id
        LEFT JOIN clients c ON c.id=o.client_id
        LEFT JOIN utilisateurs u ON u.id=p.emballeur_id
        WHERE p.id=$1
      `, [req.params.id]);
      if (!rows.length) return notFound(res, 'Palette introuvable');
      ok(res, rows[0]);
    } catch(e) { err(res, e, 'Erreur ticket palette'); }
  });

  console.log('[AT3] Routes flux AT3 chargées ✓');
};
