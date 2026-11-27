'use strict';
// NAIdo - notifications calculees a partir des donnees, selon le role (aucune table ajoutee).
// Chaque element : { ecran, titre, nombre } ; ecran = identifiant du menu a ouvrir.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

async function compter(sql, params = []) {
  try {
    const { rows } = await db.query(sql, params);
    return parseInt(rows[0].n, 10) || 0;
  } catch (e) {
    console.error('[NOTIFICATIONS]', e.message);
    return 0;
  }
}

const ROLES_DIRECTION = ['directeur', 'super_admin'];

router.get('/', auth, async (req, res) => {
  const role = String(req.user?.role || '');
  const items = [];
  const ajouter = (ecran, titre, nombre) => { if (nombre > 0) items.push({ ecran, titre, nombre }); };

  // Direction : seulement ce qui attend SA validation
  if (ROLES_DIRECTION.includes(role)) {
    ajouter('achat', 'Commandes à valider par la direction',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'en_attente_direction'"));
    ajouter('achat', 'Bons envoyés à confirmer par la direction',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut = 'envoye'"));
    ajouter('nc', 'Non-conformités critiques ou bloquantes ouvertes',
      await compter("SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut NOT IN ('clos','annule') AND gravite IN ('critique','bloquante')"));
  }
  // Direction : demandes de fabrication a valider et demandes d'annulation (ecran 'df')
  if (ROLES_DIRECTION.includes(role)) {
    ajouter('df', 'Demandes de fabrication à valider par la direction',
      await compter("SELECT COUNT(*)::int AS n FROM demandes_fabrication WHERE statut = 'en_attente'"));
    ajouter('df', "Demandes d'annulation de fabrication à traiter",
      await compter("SELECT COUNT(*)::int AS n FROM demandes_fabrication WHERE statut = 'annulation_demandee'"));
  }
  // Chef d'atelier : ordres de fabrication a lancer et en retard (ecran 'of')
  if (['chef_atelier', 'super_admin'].includes(role)) {
    ajouter('of', 'Ordres de fabrication à lancer',
      await compter("SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE statut = 'planifie'"));
    ajouter('of', 'Ordres de fabrication en retard',
      await compter("SELECT COUNT(*)::int AS n FROM ordres_fabrication WHERE date_livraison_prevue < CURRENT_DATE AND statut NOT IN ('termine','annule','pret_livraison')"));
  }
  // Achat : envoi et reception des bons (les alertes sont dans Achats, pas chez la direction)
  if (['achat', 'super_admin'].includes(role)) {
    ajouter('achat', 'Bons validés à envoyer au fournisseur',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'validee' AND statut = 'brouillon'"));
    ajouter('achat', 'Commandes à réceptionner',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut IN ('confirme','receptionne_partiel')"));
    ajouter('achat', "Demandes d'achat en attente",
      await compter("SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut = 'en_attente'"));
  }
  // Magasin : demandes de matieres (DBM) a livrer (ecran 'dbm')
  if (['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'super_admin'].includes(role)) {
    ajouter('dbm', 'Demandes de matières (DBM) à livrer',
      await compter("SELECT COUNT(*)::int AS n FROM dbm WHERE statut IN ('en_attente', 'partiel')"));
    ajouter('dbm', 'Écarts de réception à traiter (reçu différent de livré)',
      await compter("SELECT COUNT(*)::int AS n FROM dbm_livraisons WHERE receptionne = true AND qte_recue IS NOT NULL AND ABS(qte_recue + COALESCE(qte_nc, 0) - qte_livree) > 0.0005 AND ecart_vu_at IS NULL"));
  }
  // Chef d'atelier : matieres livrees par le magasin, a receptionner (ecran 'dbm')
  if (['chef_atelier', 'super_admin'].includes(role)) {
    ajouter('dbm', 'Livraisons de matières à réceptionner',
      await compter("SELECT COUNT(DISTINCT numero_livraison)::int AS n FROM dbm_livraisons WHERE COALESCE(receptionne, false) = false AND numero_livraison IS NOT NULL"));
  }
  // Non-conformites matieres : une alerte a chaque etape du circuit (QHSE -> direction -> magasin -> atelier / achat)
  if (['qhse', 'responsable_qhse', 'qualite', 'super_admin'].includes(role)) {
    const ecranNc = role === 'qualite' ? 'nc' : 'qhse';
    ajouter(ecranNc, 'Non-conformités matières à valider (QHSE)',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE statut = 'declaree'"));
    ajouter(ecranNc, 'Non-conformités matières à clôturer',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE statut = 'retour_effectue'"));
  }
  if (ROLES_DIRECTION.includes(role)) {
    ajouter('nc', 'Non-conformités matières à valider par la direction',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE statut = 'attente_direction'"));
  }
  if (['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'super_admin'].includes(role)) {
    ajouter('dbm', 'Non-conformités : matières à retourner au fournisseur',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE statut = 'a_traiter_magasin'"));
  }
  if (['chef_atelier', 'super_admin'].includes(role)) {
    ajouter('dbm', 'Décisions du QHSE sur vos non-conformités',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE origine = 'dbm' AND qhse_decision IS NOT NULL AND vu_atelier_at IS NULL"));
  }
  if (['achat', 'super_admin'].includes(role)) {
    ajouter('achat', 'Non-conformités fournisseur en cours (information)',
      await compter("SELECT COUNT(*)::int AS n FROM nc_matiere WHERE origine = 'fournisseur' AND statut IN ('a_traiter_magasin', 'retour_effectue') AND vu_achat_at IS NULL"));
  }
  // Arrivages import : matieres en zone de quarantaine a transferer vers le stock du magasin MP
  if (['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'super_admin'].includes(role)) {
    ajouter('dbm', 'Arrivages conteneurs en quarantaine à transférer au stock',
      await compter("SELECT COUNT(*)::int AS n FROM lots_stock WHERE statut = 'quarantaine' AND commande_id IS NOT NULL AND qte_disponible > 0"));
  }
  if (['achat', 'super_admin'].includes(role)) {
    ajouter('achat', 'Arrivages conteneurs en quarantaine (à transférer au magasin MP)',
      await compter("SELECT COUNT(*)::int AS n FROM lots_stock WHERE statut = 'quarantaine' AND commande_id IS NOT NULL AND qte_disponible > 0"));
  }
  if (['qualite', 'qhse', 'responsable_qhse', ...ROLES_DIRECTION].includes(role)) {
    ajouter('nc', 'Non-conformités ouvertes',
      await compter("SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut NOT IN ('clos','annule')"));
  }
  if (['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', ...ROLES_DIRECTION].includes(role)) {
    ajouter('stock', 'Mouvements de stock à valider',
      await compter("SELECT COUNT(*)::int AS n FROM mouvements_stock WHERE statut = 'brouillon'"));
  }
  if (['comptable', ...ROLES_DIRECTION].includes(role)) {
    ajouter('vente', 'Ventes à encaisser',
      await compter("SELECT COUNT(*)::int AS n FROM ventes WHERE statut <> 'annule' AND COALESCE(solde_restant, 0) > 0"));
  }
  if (['rh', 'responsable_rh', ...ROLES_DIRECTION].includes(role)) {
    ajouter('rh', 'Demandes de congé en attente',
      await compter("SELECT COUNT(*)::int AS n FROM conges WHERE statut = 'en_attente'"));
  }
  if (['commercial', 'vente', ...ROLES_DIRECTION].includes(role)) {
    ajouter('devis', 'Devis envoyés sans réponse',
      await compter("SELECT COUNT(*)::int AS n FROM devis WHERE statut = 'envoye'"));
  }

  const total = items.reduce((s, i) => s + i.nombre, 0);
  res.json({ total, items });
});

module.exports = router;
