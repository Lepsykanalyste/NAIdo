const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const num = v => (v===''||v===null||v===undefined)?null:parseFloat(v)||null;
const numD = (v,d=0) => (v===''||v===null||v===undefined)?d:parseFloat(v)||d;

// ── FOURNISSEURS ──────────────────────────────────────────────

router.get('/fournisseurs', auth, async (req, res) => {
  try {
    const { search } = req.query;
    let q = 'SELECT * FROM fournisseurs WHERE actif=true';
    const p = [];
    if (search) { p.push(`%${search}%`); q+=` AND (code ILIKE $1 OR raison_sociale ILIKE $1)`; }
    q+=' ORDER BY raison_sociale LIMIT 200';
    const { rows } = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.post('/fournisseurs', auth, async (req, res) => {
  try {
    const d = req.body;
    if (!d.code||!d.raison_sociale) return res.status(400).json({ error:'Code et raison sociale requis' });
    const { rows } = await db.query(`
      INSERT INTO fournisseurs (code,raison_sociale,contact_nom,telephone,email,adresse,ville,pays,nif,condition_paiement,delai_paiement_jours,credit_limite,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `,[d.code?.toUpperCase(),d.raison_sociale,d.contact_nom||null,d.telephone||null,d.email||null,d.adresse||null,d.ville||null,d.pays||'Algérie',d.nif||null,d.condition_paiement||'30_jours',numD(d.delai_paiement_jours,30),numD(d.credit_limite,0),d.notes||null]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(e.code==='23505'?400:500).json({ error:e.code==='23505'?'Code déjà existant':e.message }); }
});

router.put('/fournisseurs/:id', auth, async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE fournisseurs SET raison_sociale=$1,contact_nom=$2,telephone=$3,email=$4,adresse=$5,condition_paiement=$6,delai_paiement_jours=$7,notes=$8,actif=$9
      WHERE id=$10 RETURNING *
    `,[d.raison_sociale,d.contact_nom||null,d.telephone||null,d.email||null,d.adresse||null,d.condition_paiement||'30_jours',numD(d.delai_paiement_jours,30),d.notes||null,d.actif!==false,req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── COMMANDES ACHAT ───────────────────────────────────────────

router.get('/commandes', auth, async (req, res) => {
  try {
    const { statut, fournisseur_id } = req.query;
    let q = `
      SELECT ca.*, f.raison_sociale AS fournisseur_nom,
        u.nom||' '||u.prenom AS cree_par_nom
      FROM commandes_achat ca
      LEFT JOIN fournisseurs f ON f.id=ca.fournisseur_id
      LEFT JOIN utilisateurs u ON u.id=ca.cree_par
      WHERE 1=1
    `;
    const p = [];
    if (statut) { p.push(statut); q+=` AND ca.statut=$${p.length}`; }
    if (fournisseur_id) { p.push(fournisseur_id); q+=` AND ca.fournisseur_id=$${p.length}`; }
    q+=' ORDER BY ca.created_at DESC LIMIT 100';
    const { rows } = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.get('/commandes/:id', auth, async (req, res) => {
  try {
    const [cmd, lignes] = await Promise.all([
      db.query(`SELECT ca.*,f.raison_sociale,f.telephone,f.adresse FROM commandes_achat ca LEFT JOIN fournisseurs f ON f.id=ca.fournisseur_id WHERE ca.id=$1`,[req.params.id]),
      db.query(`SELECT l.*,a.code AS article_code,um.code AS unite_code FROM lignes_achat l LEFT JOIN articles a ON a.id=l.article_id LEFT JOIN unites_mesure um ON um.id=l.unite_id WHERE l.commande_id=$1 ORDER BY l.created_at`,[req.params.id])
    ]);
    if (!cmd.rows.length) return res.status(404).json({ error:'Commande introuvable' });
    res.json({ ...cmd.rows[0], lignes:lignes.rows });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

router.post('/commandes', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const d = req.body;
    const lignes = d.lignes || [];

    let totalHT = 0, totalTVA = 0;
    for (const l of lignes) {
      const ht = parseFloat(l.quantite_commandee) * parseFloat(l.prix_unitaire_ht);
      const tva = ht * (parseFloat(l.taux_tva)||19) / 100;
      l._ht = ht; l._tva = tva;
      totalHT += ht; totalTVA += tva;
    }

    const { rows:[cmd] } = await client.query(`
      INSERT INTO commandes_achat (statut,fournisseur_id,date_commande,date_livraison_prevue,montant_ht,taux_tva,montant_tva,montant_ttc,reference_fournisseur,notes,cree_par)
      VALUES ('brouillon',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `,[d.fournisseur_id||null,d.date_commande||new Date().toISOString().split('T')[0],d.date_livraison_prevue||null,totalHT,numD(d.taux_tva,19),totalTVA,totalHT+totalTVA,d.reference_fournisseur||null,d.notes||null,req.user.id]);

    for (const l of lignes) {
      await client.query(`
        INSERT INTO lignes_achat (commande_id,article_id,designation,quantite_commandee,unite_id,prix_unitaire_ht,taux_tva,montant_ht,montant_ttc)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,[cmd.id,l.article_id||null,l.designation,l.quantite_commandee,l.unite_id||null,l.prix_unitaire_ht,l.taux_tva||19,l._ht,l._ht+l._tva]);
    }

    await client.query('COMMIT');
    res.status(201).json(cmd);
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error:e.message });
  } finally { client.release(); }
});

// Réceptionner une commande → mise à jour stock
router.put('/commandes/:id/receptionner', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { lignes_recues, date_reception } = req.body;

    for (const l of (lignes_recues||[])) {
      // Mettre à jour la quantité reçue
      await client.query('UPDATE lignes_achat SET quantite_recue=$1 WHERE id=$2',[l.quantite_recue,l.id]);
      
      // Mettre à jour le stock si emplacement fourni
      if (l.article_id && l.quantite_recue > 0) {
        const { rows:empls } = await client.query('SELECT id FROM emplacements_stock WHERE actif=true AND type=\'reception\' LIMIT 1');
        const emplId = l.emplacement_id || empls[0]?.id;
        if (emplId) {
          await client.query(`
            INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
            VALUES ($1,$2,$3,$4,NOW())
            ON CONFLICT (article_id,emplacement_id)
            DO UPDATE SET qte_disponible=stock_articles.qte_disponible+$3, derniere_entree=NOW()
          `,[l.article_id,emplId,l.quantite_recue,l.prix_unitaire_ht||0]);
        }
      }
    }

    await client.query(`
      UPDATE commandes_achat SET statut='receptionne', date_reception=$1 WHERE id=$2
    `,[date_reception||new Date().toISOString().split('T')[0],req.params.id]);

    await client.query('COMMIT');
    res.json({ success:true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error:e.message });
  } finally { client.release(); }
});

router.put('/commandes/:id/statut', auth, async (req, res) => {
  try {
    const { rows } = await db.query('UPDATE commandes_achat SET statut=$1 WHERE id=$2 RETURNING *',[req.body.statut,req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

module.exports = router;
