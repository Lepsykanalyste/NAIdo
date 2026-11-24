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

  if (ROLES_DIRECTION.includes(role)) {
    ajouter('achat', 'Commandes à valider par la direction',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'en_attente_direction'"));
    ajouter('nc', 'Non-conformités critiques ou bloquantes ouvertes',
      await compter("SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut NOT IN ('clos','annule') AND gravite IN ('critique','bloquante')"));
  }
  if (['achat', ...ROLES_DIRECTION].includes(role)) {
    ajouter('achat', 'Commandes à réceptionner',
      await compter("SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut IN ('confirme','receptionne_partiel')"));
    ajouter('achat', "Demandes d'achat en attente",
      await compter("SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut = 'en_attente'"));
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
