const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { pdfCommercial, nombre, date } = require('../utils/pdfBonAchat');

// GET /api/of
router.get('/', auth, async (req, res) => {
  try {
    const { statut, machine_id, atelier_id, article_id, q, tri, limit, offset } = req.query;
    let query = `
      SELECT o.*, 
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             a.cadence_heure AS cadence_heure,
             ROUND((o.quantite_cible * a.poids_theorique_kg)::numeric, 1) AS poids_theorique_total_kg,
             a.temps_reglage_min, a.poids_theorique_kg,
             a.longueur_mm, a.largeur_mm, a.couleur,
             m.code AS machine_code, m.nom AS machine_nom, m.type AS machine_type,
             um.code AS unite_code, um.libelle AS unite_libelle,
             at.libelle AS atelier_libelle, at.code AS atelier_code
      FROM ordres_fabrication o
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
      WHERE 1=1
    `;
    const params = [];
    if (statut) { params.push(statut); query += ` AND o.statut = $${params.length}`; }
    if (machine_id) { params.push(parseInt(machine_id)); query += ` AND o.machine_id = $${params.length}`; }
    if (atelier_id) { params.push(atelier_id); query += ` AND o.atelier_id = $${params.length}`; }
    if (article_id) { params.push(article_id); query += ` AND o.article_id = $${params.length}`; }
    // Recherche : N° OF, article ou client (ILIKE, sur la base)
    if (q && String(q).trim()) { params.push(`%${String(q).trim()}%`); const n = params.length; query += ` AND (o.numero_of ILIKE $${n} OR a.designation ILIKE $${n} OR c.raison_sociale ILIKE $${n})`; }
    // Régleur et opérateurs : seulement les OF lancés par le chef AT3 (composition validée).
    const roleU = String(req.user?.role || '');
    if (['regleur', 'technicien_regleur'].includes(roleU) || roleU.startsWith('operateur')) {
      query += ` AND NOT (COALESCE(o.at3_composition_validee, false) = false AND o.statut IN ('planifie','lance','en_attente_regleur'))`;
    }
    // Mode paginé (?limit=&offset=) : renvoie { items, total } ; sans limit, comportement d'origine (tableau)
    const ordre = tri === 'avancement'
      ? 'ORDER BY (o.quantite_produite / NULLIF(o.quantite_cible, 0)) DESC NULLS LAST, o.numero_of'
      : tri === 'numero'
        ? 'ORDER BY o.numero_of'
        : tri === 'livraison'
          ? 'ORDER BY o.date_livraison_prevue ASC NULLS LAST, o.numero_of'
          : 'ORDER BY o.priorite DESC, o.date_livraison_prevue ASC';
    if (limit === undefined) {
      const { rows } = await db.query(`${query} ${ordre}`, params);
      return res.json(rows);
    }
    const total = (await db.query(`SELECT COUNT(*)::int AS n FROM (${query}) x`, params)).rows[0].n;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);
    params.push(lim, off);
    const { rows } = await db.query(`${query} ${ordre} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ items: rows, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/of
router.post('/', auth, async (req, res) => {
  try {
    const {
      client_id, article_id, quantite_cible, machine_id,
      atelier_id, date_livraison_prevue, priorite, instructions,
      unite_id, reference_sage
    } = req.body;

    if (!article_id || !quantite_cible) {
      return res.status(400).json({ error: 'article_id et quantite_cible requis' });
    }

    // Calculer temps prévu selon formule cahier des charges
    let temps_prevu_min = null;
    if (article_id) {
      const { rows: art } = await db.query(
        'SELECT cadence_theorique_kg_h, temps_reglage_min FROM articles WHERE id=$1', [article_id]
      );
      if (art.length && art[0].cadence_theorique_kg_h > 0) {
        const cadence = parseFloat(art[0].cadence_theorique_kg_h);
        const reglage = parseFloat(art[0].temps_reglage_min || 30);
        temps_prevu_min = Math.round((parseFloat(quantite_cible) / cadence) * 60 + reglage);
      }
    }

    const { rows } = await db.query(`
      INSERT INTO ordres_fabrication 
        (client_id, article_id, quantite_cible, machine_id, atelier_id,
         date_livraison_prevue, priorite, instructions, unite_id,
         reference_sage, temps_prevu_min, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'planifie')
      RETURNING *
    `, [
      client_id || null,
      article_id,
      parseFloat(quantite_cible),
      machine_id ? parseInt(machine_id) : null,
      atelier_id || 'AT3',
      date_livraison_prevue || null,
      parseInt(priorite || 3),
      instructions || null,
      unite_id || null,
      reference_sage || null,
      temps_prevu_min
    ]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/of/:id
// GET /api/of/:id/pdf — ordre de fabrication en PDF (paysage) : article, client, production, composition, instructions, signatures
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, c.raison_sociale AS client_nom, c.telephone,
             a.designation AS article_nom, a.code AS article_code,
             a.longueur_mm, a.largeur_mm, a.epaisseur_mm, a.poids_theorique_kg,
             m.code AS machine_code, m.nom AS machine_nom,
             u.nom||' '||u.prenom AS chef_nom,
             at.libelle AS atelier_libelle
      FROM ordres_fabrication o
      LEFT JOIN clients_complet c ON c.id=o.client_id
      LEFT JOIN articles a ON a.id=o.article_id
      LEFT JOIN machines m ON m.id=o.at3_machine_assignee_id
      LEFT JOIN utilisateurs u ON u.id=o.at3_valide_par
      LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
      WHERE o.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    const d = rows[0];
    const { rows: compoMp } = await db.query(`
      SELECT a.code AS mp_code, a.designation AS mp_nom, sf.libelle AS groupe_libelle,
             elem->>'pct' AS pct, elem->>'quantite' AS quantite_kg
      FROM ordres_fabrication o,
           jsonb_array_elements(COALESCE(o.at3_composition_of, '[]'::jsonb)) AS elem
      JOIN articles a ON a.id = (elem->>'mp_id')::uuid
      LEFT JOIN sous_familles_articles sf ON sf.id = a.sous_famille_id
      WHERE o.id=$1
      ORDER BY sf.libelle, a.code`, [req.params.id]);
    const { rows: compoGroupes } = await db.query(`
      SELECT ca.pct, sf.libelle AS groupe_libelle, f.libelle AS famille_libelle
      FROM composition_article ca
      JOIN sous_familles_articles sf ON sf.id = ca.groupe_id
      JOIN familles_articles f ON f.id = ca.famille_id
      WHERE ca.article_id = (SELECT article_id FROM ordres_fabrication WHERE id=$1)
      ORDER BY ca.ordre`, [req.params.id]);

    const n = v => parseFloat(v) || 0;
    const poidsCible = n(d.at3_poids_cible_kg) || n(d.quantite_cible);
    const pcs = n(d.quantite_pieces);

    // Composition : matieres choisies par le chef AT3, sinon groupes de l'article, sinon composition saisie sur l'OF
    let source;
    if (compoMp.length) {
      source = compoMp.map(r => ({ groupe: r.groupe_libelle || '-', code: r.mp_code || '', nom: r.mp_nom || '', pct: n(r.pct), kg: n(r.quantite_kg) }));
    } else if (compoGroupes.length) {
      source = compoGroupes.map(r => ({ groupe: r.groupe_libelle || r.famille_libelle || '-', code: r.groupe_libelle || '', nom: r.famille_libelle || r.groupe_libelle || '', pct: n(r.pct), kg: 0 }));
    } else {
      let brute = [];
      try { brute = typeof d.composition === 'string' ? JSON.parse(d.composition) : (d.composition || []); } catch (e) { brute = []; }
      source = (Array.isArray(brute) ? brute : []).map(c => ({ groupe: '-', code: c.code || '—', nom: c.designation || '—', pct: n(c.pct), kg: 0 }));
    }
    let totalPct = 0, totalKg = 0;
    const lignesPdf = source.map(s => {
      const kg = s.kg || (poidsCible > 0 ? Math.round(s.pct / 100 * poidsCible * 10) / 10 : 0);
      totalPct += s.pct; totalKg += kg;
      return [s.groupe, s.code, s.nom, nombre(s.pct, 1) + ' %', nombre(kg, 1) + ' kg'];
    });

    // Signature du chef d'atelier (si elle a ete importee dans son profil)
    let sigChef = null;
    if (d.at3_valide_par) {
      const { rows: u } = await db.query('SELECT signature_path FROM utilisateurs WHERE id = $1', [d.at3_valide_par]);
      const p = u[0] && u[0].signature_path;
      if (p && p.startsWith('/uploads/signatures/')) {
        try { sigChef = require('fs').readFileSync(require('path').join(__dirname, '../..', p)); } catch (e) { sigChef = null; }
      }
    }

    const statutLabel = { planifie: 'Planifié', lance: 'Lancé', en_cours: 'En cours', pause: 'En pause', termine: 'Terminé', annule: 'Annulé' }[d.statut] || d.statut;
    const priorite = { 1: 'Basse', 2: 'Normale', 3: 'Haute', 4: 'Urgente', 5: 'Critique' }[d.priorite || 1] || 'Normale';
    const notes = [d.instructions ? 'Instructions : ' + d.instructions : null,
                   d.at3_notes_regleur ? 'Instructions régleur : ' + d.at3_notes_regleur : null].filter(Boolean).join('\n');

    const pdf = await pdfCommercial({
      paysage: true,
      qrUrl: `NAI-OF|${d.numero_of}|${d.article_code || ''}|${poidsCible.toFixed(1)}kg|${d.statut}`,
      signatures: [
        { titre: "CHEF D'ATELIER", nom: d.chef_nom || '—', image: sigChef },
        { titre: 'RÉGLEUR', nom: 'À compléter', image: null },
        { titre: 'OPÉRATEUR', nom: 'À compléter', image: null },
      ],
      titre: 'ORDRE DE FABRICATION',
      numero: d.numero_of,
      dateStr: date(d.created_at),
      statut: statutLabel,
      titreGauche: 'CLIENT ET LIVRAISON',
      titreDroite: 'ARTICLE ET PRODUCTION',
      client: ['Client : ' + (d.client_nom || '—'),
               d.telephone ? 'Tél : ' + d.telephone : null,
               'Livraison prévue : ' + (d.date_livraison_prevue ? date(d.date_livraison_prevue) : '—'),
               'Priorité : ' + priorite],
      infos: ['Article : ' + (d.article_code || '—') + ' — ' + (d.article_nom || '—'),
              d.longueur_mm ? 'Dimensions : ' + nombre(d.longueur_mm, 0) + ' x ' + nombre(d.largeur_mm, 0) + ' mm' : null,
              d.epaisseur_mm ? 'Épaisseur : ' + nombre(d.epaisseur_mm, 3) + ' mm' : null,
              d.poids_theorique_kg ? 'Poids théorique : ' + nombre(d.poids_theorique_kg, 4) + ' kg / pièce' : null,
              'Atelier : ' + (d.atelier_libelle || '—'),
              'Machine : ' + (((d.machine_code || '') + ' ' + (d.machine_nom || '')).trim() || '—'),
              'Temps prévu : ' + (d.temps_prevu_min ? d.temps_prevu_min + ' min' : '—'),
              'Début prévu : ' + (d.date_debut_prevue ? date(d.date_debut_prevue) : '—')],
      entete: [{ t: 'Groupe', w: 130, al: 'left' }, { t: 'Code MP', w: 110, al: 'left' }, { t: 'Désignation', w: 302, al: 'left' },
               { t: '%', w: 100, al: 'right' }, { t: 'Qté (kg)', w: 120, al: 'right' }],
      lignes: lignesPdf,
      totaux: [['Quantité cible', (pcs ? nombre(pcs, 0) + ' pcs · ' : '') + nombre(poidsCible, 1) + ' kg'],
               ['Total composition', nombre(totalPct, 1) + ' % · ' + nombre(totalKg, 1) + ' kg', true]],
      notes,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `inline; filename="${d.numero_of || 'of'}.pdf"`);
    res.send(pdf);
  } catch (e) { console.error('[OF] pdf', e); res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*,
             c.raison_sociale AS client_nom,
             a.designation AS article_nom, a.code AS article_code,
             a.cadence_heure AS cadence_heure,
             ROUND((o.quantite_cible * a.poids_theorique_kg)::numeric, 1) AS poids_theorique_total_kg,
             a.temps_reglage_min, a.poids_theorique_kg,
             a.longueur_mm, a.largeur_mm, a.couleur, a.composition,
             m.code AS machine_code, m.nom AS machine_nom
      FROM ordres_fabrication o
      LEFT JOIN clients_complet c ON c.id = o.client_id
      LEFT JOIN articles a ON a.id = o.article_id
      LEFT JOIN machines m ON m.id = o.machine_id
      LEFT JOIN unites_mesure um ON um.id = o.unite_id
      LEFT JOIN ateliers at ON at.id::text = o.atelier_id::text
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/of/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      machine_id, atelier_id, date_livraison_prevue,
      priorite, instructions, quantite_cible
    } = req.body;
    const { rows } = await db.query(`
      UPDATE ordres_fabrication SET
        machine_id = COALESCE($1, machine_id),
        atelier_id = COALESCE($2, atelier_id),
        date_livraison_prevue = COALESCE($3, date_livraison_prevue),
        priorite = COALESCE($4, priorite),
        instructions = COALESCE($5, instructions),
        quantite_cible = COALESCE($6, quantite_cible)
      WHERE id = $7 RETURNING *
    `, [
      machine_id ? parseInt(machine_id) : null,
      atelier_id || null,
      date_livraison_prevue || null,
      priorite ? parseInt(priorite) : null,
      instructions || null,
      quantite_cible ? parseFloat(quantite_cible) : null,
      req.params.id
    ]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/of/:id/statut
router.put('/:id/statut', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const { rows } = await db.query(
      'UPDATE ordres_fabrication SET statut=$1 WHERE id=$2 RETURNING *',
      [statut, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// PATCH /api/of/:id/reglage — Régleur valide les paramètres machine
router.patch('/:id/reglage', auth, async (req, res) => {
  try {
    const { temperature, pression, vitesse, notes, regleur_id } = req.body;
    const rId = regleur_id || req.user.id;
    const { rows } = await db.query(`
      UPDATE ordres_fabrication SET
        statut              = 'en_attente_operateur',
        regleur_id          = $1,
        regleur_valide      = true,
        regleur_temperature = $2,
        regleur_pression    = $3,
        regleur_vitesse     = $4,
        regleur_notes       = $5,
        regleur_valide_at   = NOW(),
        numero_ticket_reglage = 'TKR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('seq_ticket_reglage')::text, 4, '0')
      WHERE id = $6
      RETURNING *
    `, [rId, temperature, pression, vitesse, notes, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'OF introuvable' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
