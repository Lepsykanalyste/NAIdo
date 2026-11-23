'use strict';
// NAIdo - Tableau de bord par poste : chaque personne voit les indicateurs et les actions de son poste actif.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();
const n = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

// Blocs par poste : chaque bloc = titre + indicateurs (libelle, valeur, couleur)
const BLOCS = {
  achat: async () => [
    { titre: 'À traiter', indicateurs: [
      { label: 'Demandes d\'achat en attente', valeur: await n(`SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut='en_attente'`), couleur: '#d97706' },
      { label: 'Bons à envoyer au fournisseur (validés)', valeur: await n(`SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation='validee' AND statut='brouillon'`), couleur: '#0369a1' },
      { label: 'Bons en attente de la direction', valeur: await n(`SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation='en_attente_direction'`), couleur: '#6b7280' },
    ] },
    { titre: 'Suivi', indicateurs: [
      { label: 'Commandes envoyées, pas encore reçues', valeur: await n(`SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut IN ('envoye','confirme','receptionne_partiel')`), couleur: '#1d4ed8' },
      { label: 'Articles sous le stock minimum', valeur: await n(`SELECT COUNT(*)::int AS n FROM articles a LEFT JOIN (SELECT article_id, SUM(qte_disponible) q FROM stock_articles GROUP BY article_id) s ON s.article_id=a.id WHERE COALESCE(a.stock_mini,0)>0 AND COALESCE(s.q,0)<a.stock_mini`), couleur: '#dc2626' },
    ] },
  ],
  magasinier_mp: async () => [
    { titre: 'À traiter', indicateurs: [
      { label: 'Bons de livraison DBM à préparer', valeur: await n(`SELECT COUNT(*)::int AS n FROM dbm WHERE statut NOT IN ('livre','annule')`), couleur: '#d97706' },
      { label: 'Exceptions FIFO en attente de la direction', valeur: await n(`SELECT COUNT(*)::int AS n FROM exceptions_fifo WHERE statut='en_attente'`), couleur: '#6b7280' },
    ] },
    { titre: 'Stock', indicateurs: [
      { label: 'Lots disponibles', valeur: await n(`SELECT COUNT(*)::int AS n FROM lots_stock WHERE statut='disponible' AND qte_disponible>0`), couleur: '#15803d' },
      { label: 'Lots dont la date limite approche (30 jours)', valeur: await n(`SELECT COUNT(*)::int AS n FROM lots_stock WHERE statut='disponible' AND qte_disponible>0 AND date_dluo IS NOT NULL AND date_dluo <= CURRENT_DATE + 30`), couleur: '#dc2626' },
    ] },
  ],
  magasinier: async () => [
    { titre: 'Stock', indicateurs: [
      { label: 'Lots disponibles', valeur: await n(`SELECT COUNT(*)::int AS n FROM lots_stock WHERE statut='disponible' AND qte_disponible>0`), couleur: '#15803d' },
      { label: 'Articles sous le stock minimum', valeur: await n(`SELECT COUNT(*)::int AS n FROM articles a LEFT JOIN (SELECT article_id, SUM(qte_disponible) q FROM stock_articles GROUP BY article_id) s ON s.article_id=a.id WHERE COALESCE(a.stock_mini,0)>0 AND COALESCE(s.q,0)<a.stock_mini`), couleur: '#dc2626' },
    ] },
  ],
  chef_atelier: async () => [
    { titre: 'À traiter', indicateurs: [
      { label: 'Bons de livraison DBM en cours', valeur: await n(`SELECT COUNT(*)::int AS n FROM dbm WHERE statut NOT IN ('livre','annule')`), couleur: '#d97706' },
      { label: 'Interventions de maintenance ouvertes', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_travail WHERE statut IS DISTINCT FROM 'termine'`), couleur: '#d97706' },
      { label: 'Non-conformités ouvertes', valeur: await n(`SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut IN ('ouvert','en_cours')`), couleur: '#dc2626' },
    ] },
    { titre: 'Production', indicateurs: [
      { label: 'OF en cours', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE statut IN ('lance','en_cours','en_attente_regleur','pause')`), couleur: '#1d4ed8' },
      { label: 'OF en retard', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE date_livraison_prevue < CURRENT_DATE AND statut NOT IN ('termine','annule','pret_livraison')`), couleur: '#dc2626' },
    ] },
  ],
  regleur: async () => [
    { titre: 'À traiter', indicateurs: [
      { label: 'OF à régler', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE statut IN ('planifie','lance','en_attente_regleur')`), couleur: '#d97706' },
      { label: 'Sessions de production en cours', valeur: await n(`SELECT COUNT(*)::int AS n FROM sessions_production WHERE statut='en_cours'`), couleur: '#1d4ed8' },
    ] },
  ],
  technicien: async () => [
    { titre: 'Maintenance', indicateurs: [
      { label: 'Interventions ouvertes', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_travail WHERE statut IS DISTINCT FROM 'termine'`), couleur: '#d97706' },
      { label: 'Pièces demandées en attente', valeur: await n(`SELECT COUNT(*)::int AS n FROM demandes_achat WHERE ot_id IS NOT NULL AND statut='en_attente'`), couleur: '#6d28d9' },
      { label: 'Interventions terminées ce mois', valeur: await n(`SELECT COUNT(*)::int AS n FROM ordres_travail WHERE statut='termine' AND date_fin >= date_trunc('month', now())`), couleur: '#15803d' },
    ] },
  ],
  qualite: async () => [
    { titre: 'Qualité', indicateurs: [
      { label: 'Non-conformités ouvertes', valeur: await n(`SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut IN ('ouvert','en_cours')`), couleur: '#dc2626' },
      { label: 'Non-conformités clôturées ce mois', valeur: await n(`SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut='clos' AND date_cloture >= date_trunc('month', now())`), couleur: '#15803d' },
    ] },
  ],
  commercial: async () => [
    { titre: 'Ventes', indicateurs: [
      { label: 'Devis créés ce mois', valeur: await n(`SELECT COUNT(*)::int AS n FROM devis WHERE created_at >= date_trunc('month', now())`), couleur: '#1d4ed8' },
      { label: 'Bons de commande clients ce mois', valeur: await n(`SELECT COUNT(*)::int AS n FROM bons_commande WHERE created_at >= date_trunc('month', now())`), couleur: '#15803d' },
    ] },
  ],
  vente: async () => [
    { titre: 'Ventes', indicateurs: [
      { label: 'Bons de commande clients ce mois', valeur: await n(`SELECT COUNT(*)::int AS n FROM bons_commande WHERE created_at >= date_trunc('month', now())`), couleur: '#15803d' },
    ] },
  ],
  comptable: async () => [
    { titre: 'À payer', indicateurs: [
      { label: 'Bons validés en attente de paiement', valeur: await n(`SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation='validee' AND statut IN ('envoye','confirme','receptionne_partiel','receptionne')`), couleur: '#d97706' },
    ] },
  ],
  rh: async () => [
    { titre: 'Ressources humaines', indicateurs: [
      { label: 'Employés enregistrés', valeur: await n(`SELECT COUNT(*)::int AS n FROM employes`), couleur: '#0891b2' },
    ] },
  ],
  operateur: async (userId) => [
    { titre: 'Ma journée', indicateurs: [
      { label: 'Tickets de production créés aujourd\'hui', valeur: await n(`SELECT COUNT(*)::int AS n FROM tickets_production WHERE operateur_id=$1 AND created_at::date=CURRENT_DATE`, [userId]), couleur: '#15803d' },
    ] },
  ],
};
// les operateurs (operateur_ext, operateur_dec, etc.) ont le meme tableau que l'operateur
const ALIAS = { operateur_ext: 'operateur', operateur_dec: 'operateur', operateur_imp: 'operateur', operateur_sou: 'operateur', magasinier_at3: 'magasinier', magasinier_central: 'magasinier', responsable_stock: 'magasinier_mp', technicien_regleur: 'regleur' };

router.get('/mon-tableau', auth, async (req, res) => {
  const poste = ALIAS[req.user.role] || req.user.role;
  const fn = BLOCS[poste];
  if (!fn) return res.json({ poste: req.user.role, blocs: [] });
  try {
    res.json({ poste: req.user.role, blocs: await fn(req.user.id) });
  } catch (e) {
    console.error('[POSTE] erreur tableau', poste, e.message);
    res.status(500).json({ error: 'Tableau de bord indisponible' });
  }
});

module.exports = router;
