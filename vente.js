const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const num = v => (v===''||v===null||v===undefined) ? null : parseFloat(v)||null;
const numD = (v,d=0) => (v===''||v===null||v===undefined) ? d : parseFloat(v)||d;

// ── CLIENTS ───────────────────────────────────────────────────

router.get('/clients', auth, async (req, res) => {
  try {
    const { search, type } = req.query;
    let q = 'SELECT * FROM clients_complet WHERE actif=true';
    const p = [];
    if (type) { p.push(type); q+=` AND type=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q+=` AND (code ILIKE $${p.length} OR raison_sociale ILIKE $${p.length} OR telephone ILIKE $${p.length})`; }
    q+=' ORDER BY raison_sociale LIMIT 200';
    const { rows } = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.post('/clients', auth, async (req, res) => {
  try {
    const d = req.body;
    if (!d.code||!d.raison_sociale) return res.status(400).json({ error:'Code et raison sociale requis' });
    const { rows } = await db.query(`
      INSERT INTO clients_complet (code,type,raison_sociale,contact_nom,telephone,telephone2,email,adresse,ville,pays,nif,rc,ai,nis,condition_paiement,delai_paiement_jours,credit_limite,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *
    `,[d.code?.toUpperCase(),d.type||'B2B',d.raison_sociale,d.contact_nom||null,d.telephone||null,d.telephone2||null,d.email||null,d.adresse||null,d.ville||null,d.pays||'Algérie',d.nif||null,d.rc||null,d.ai||null,d.nis||null,d.condition_paiement||'30_jours',numD(d.delai_paiement_jours,30),numD(d.credit_limite,0),d.notes||null]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(e.code==='23505'?400:500).json({ error:e.code==='23505'?'Code déjà existant':e.message }); }
});

router.put('/clients/:id', auth, async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE clients_complet SET raison_sociale=$1,contact_nom=$2,telephone=$3,email=$4,adresse=$5,ville=$6,condition_paiement=$7,delai_paiement_jours=$8,credit_limite=$9,notes=$10,actif=$11
      WHERE id=$12 RETURNING *
    `,[d.raison_sociale,d.contact_nom||null,d.telephone||null,d.email||null,d.adresse||null,d.ville||null,d.condition_paiement||'30_jours',numD(d.delai_paiement_jours,30),numD(d.credit_limite,0),d.notes||null,d.actif!==false,req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── VENTES ────────────────────────────────────────────────────

router.get('/ventes', auth, async (req, res) => {
  try {
    const { statut, client_id, date_debut, date_fin } = req.query;
    let q = `
      SELECT v.*, c.raison_sociale AS client_nom, c.telephone AS client_tel,
        u.nom||' '||u.prenom AS cree_par_nom
      FROM ventes v
      LEFT JOIN clients_complet c ON c.id=v.client_id
      LEFT JOIN utilisateurs u ON u.id=v.cree_par
      WHERE 1=1
    `;
    const p = [];
    if (statut) { p.push(statut); q+=` AND v.statut=$${p.length}`; }
    if (client_id) { p.push(client_id); q+=` AND v.client_id=$${p.length}`; }
    if (date_debut) { p.push(date_debut); q+=` AND v.date_vente>=$${p.length}`; }
    if (date_fin) { p.push(date_fin); q+=` AND v.date_vente<=$${p.length}`; }
    q+=' ORDER BY v.created_at DESC LIMIT 100';
    const { rows } = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.get('/ventes/:id', auth, async (req, res) => {
  try {
    const [v, lignes] = await Promise.all([
      db.query(`SELECT v.*,c.raison_sociale AS client_nom,c.telephone,c.adresse,c.nif FROM ventes v LEFT JOIN clients_complet c ON c.id=v.client_id WHERE v.id=$1`,[req.params.id]),
      db.query(`SELECT l.*,a.code AS article_code,um.code AS unite_code FROM lignes_vente l LEFT JOIN articles a ON a.id=l.article_id LEFT JOIN unites_mesure um ON um.id=l.unite_id WHERE l.vente_id=$1 ORDER BY l.created_at`,[req.params.id])
    ]);
    if (!v.rows.length) return res.status(404).json({ error:'Vente introuvable' });
    res.json({ ...v.rows[0], lignes:lignes.rows });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.post('/ventes', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const d = req.body;
    const lignes = d.lignes || [];

    // Calculer les totaux
    let totalHT = 0, totalTVA = 0;
    for (const l of lignes) {
      const ht = parseFloat(l.quantite) * parseFloat(l.prix_unitaire_ht) * (1 - (parseFloat(l.taux_remise)||0)/100);
      const tva = ht * (parseFloat(l.taux_tva)||19) / 100;
      l._ht = ht; l._tva = tva;
      totalHT += ht; totalTVA += tva;
    }
    const totalTTC = totalHT + totalTVA;
    const remise = numD(d.montant_remise, 0);

    const { rows:[vente] } = await client.query(`
      INSERT INTO ventes (type_vente,statut,date_vente,date_livraison_prevue,client_id,montant_ht,taux_tva,montant_tva,montant_ttc,montant_remise,mode_paiement,reference_client,notes,cree_par)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
    `,[d.type_vente||'B2B','brouillon',d.date_vente||new Date(),d.date_livraison_prevue||null,d.client_id||null,totalHT,numD(d.taux_tva,19),totalTVA,totalTTC-remise,remise,d.mode_paiement||'virement',d.reference_client||null,d.notes||null,req.user.id]);

    for (const l of lignes) {
      await client.query(`
        INSERT INTO lignes_vente (vente_id,article_id,designation,quantite,unite_id,prix_unitaire_ht,taux_remise,taux_tva,montant_ht,montant_tva,montant_ttc,lot_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,[vente.id,l.article_id||null,l.designation,l.quantite,l.unite_id||null,l.prix_unitaire_ht,l.taux_remise||0,l.taux_tva||19,l._ht,l._tva,l._ht+l._tva,l.lot_id||null]);
    }

    await client.query('COMMIT');
    res.status(201).json(vente);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error:e.message });
  } finally { client.release(); }
});

router.put('/ventes/:id/statut', auth, async (req, res) => {
  try {
    const { statut } = req.body;
    const sets = ['statut=$1'];
    const vals = [statut];
    if (statut==='confirme') { sets.push('valide_par=$2','date_validation=NOW()'); vals.push(req.user.id); }
    vals.push(req.params.id);
    const { rows } = await db.query(`UPDATE ventes SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Stats ventes
router.get('/ventes/stats/resume', auth, async (req, res) => {
  try {
    const { debut, fin } = req.query;
    const p = [debut||new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0], fin||new Date().toISOString().split('T')[0]];
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE statut!='annule') AS nb_ventes,
        COALESCE(SUM(montant_ttc) FILTER (WHERE statut!='annule'),0) AS ca_ttc,
        COALESCE(SUM(montant_ht) FILTER (WHERE statut!='annule'),0) AS ca_ht,
        COALESCE(SUM(montant_paye),0) AS total_encaisse,
        COALESCE(SUM(solde_restant),0) AS total_restant,
        COUNT(*) FILTER (WHERE statut='brouillon') AS nb_brouillon,
        COUNT(*) FILTER (WHERE statut='confirme') AS nb_confirme,
        COUNT(*) FILTER (WHERE statut='paye') AS nb_paye
      FROM ventes
      WHERE date_vente::date BETWEEN $1 AND $2
    `, p);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

module.exports = router;
