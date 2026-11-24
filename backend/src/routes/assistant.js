'use strict';
// NAIdo - Assistant local (sans modele de langage, sans service externe) : comme l'assistant LEINAD.
// Une question -> reperage des sujets par mots-cles -> chiffres calcules dans la base.
// Chaque sujet est verifie avec les memes regles RBAC que les ecrans : l'assistant ne montre jamais plus que le menu.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { decider } = require('../middleware/rbac');
const router = express.Router();

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Sujets : motif = route protegee par RBAC ; rx = mots-cles ; sql = chiffre a calculer
const SUJETS = [
  { id: 'achats_validation', nom: 'Achats - validation direction', motif: '/api/achat',
    rx: /valid|attente.*direction|a valider|direction/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'en_attente_direction'",
    texte: (n) => `${n} commande(s) en attente de validation par la direction.` },
  { id: 'achats_envoi', nom: 'Achats - envoi fournisseur', motif: '/api/achat',
    rx: /envoy|envoi|fournisseur.*bon|bon.*fournisseur|a envoyer/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'validee' AND statut = 'brouillon'",
    texte: (n) => `${n} bon(s) validé(s) à envoyer au fournisseur.` },
  { id: 'achats_reception', nom: 'Achats - réception', motif: '/api/achat',
    rx: /receptionn|reception|livrai|livrer/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut IN ('confirme','receptionne_partiel')",
    texte: (n) => `${n} commande(s) à réceptionner.` },
  { id: 'achats_mois', nom: 'Achats - montant du mois', motif: '/api/achat',
    rx: /montant|depense|combien.*achat|total.*achat|achat.*mois/,
    sql: "SELECT COALESCE(SUM(montant_ttc),0)::float AS n FROM commandes_achat WHERE date_commande >= date_trunc('month', now()) AND statut <> 'annule'",
    texte: (n) => `Montant TTC des commandes du mois en cours : ${Math.round(n).toLocaleString('fr-FR')} FCFA.`, montant: true },
  { id: 'demandes_achat', nom: "Demandes d'achat", motif: '/api/achat',
    rx: /demande/,
    sql: "SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut = 'en_attente'",
    texte: (n) => `${n} demande(s) d'achat en attente.` },
  { id: 'fournisseurs', nom: 'Fournisseurs', motif: '/api/fournisseurs',
    rx: /fournisseur/,
    sql: "SELECT COUNT(*)::int AS n FROM fournisseurs WHERE actif IS NOT FALSE",
    texte: (n) => `${n} fournisseur(s) actif(s).` },
  { id: 'nc', nom: 'Non-conformités', motif: '/api/non-conformites',
    rx: /non.?conform|\bnc\b|qualit/,
    sql: "SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut NOT IN ('clos','annule')",
    texte: (n) => `${n} non-conformité(s) ouverte(s).` },
  { id: 'alertes', nom: 'Alertes', motif: '/api/alertes',
    rx: /alerte/,
    sql: "SELECT COUNT(*)::int AS n FROM alertes WHERE lue = false",
    texte: (n) => `${n} alerte(s) non lue(s).` },
  { id: 'conges', nom: 'Congés', motif: '/api/rh',
    rx: /conge/,
    sql: "SELECT COUNT(*)::int AS n FROM conges WHERE statut = 'en_attente'",
    texte: (n) => `${n} demande(s) de congé en attente.` },
];

const SUGGESTIONS = ['Combien de bons à envoyer ?', 'Commandes à réceptionner', 'Achats du mois', 'Alertes non lues', 'Mes droits'];

const accesA = (role, motif) => decider(role, 'GET', motif).autorise;

router.post('/ask', auth, async (req, res) => {
  try {
    const question = String(req.body?.question || '').slice(0, 300);
    const role = String(req.user?.role || '');
    const s = norm(question);

    // Mes droits : liste ce que l'utilisateur peut consulter
    if (/mes droits|mon role|mes acces|mes permissions|qu.est.ce que je peux/.test(s)) {
      const ok = SUJETS.filter((x) => accesA(role, x.motif)).map((x) => x.nom);
      return res.json({ text: ok.length
        ? `Avec votre rôle (${role}), je peux répondre sur : ${ok.join(', ')}.`
        : `Avec votre rôle (${role}), je ne peux répondre sur aucun sujet. Adressez-vous à un administrateur.` });
    }

    const trouves = question ? SUJETS.filter((x) => x.rx.test(s)) : [];
    if (trouves.length === 0) {
      return res.json({ text: "Je peux répondre sur les achats, les fournisseurs, les non-conformités, les alertes et les congés, à partir des données de votre entreprise. Essayez par exemple : « combien de bons à envoyer ? ». Tapez « mes droits » pour voir ce que vous pouvez consulter.", suggestions: SUGGESTIONS });
    }

    const lignes = [];
    for (const sujet of trouves) {
      if (!accesA(role, sujet.motif)) {
        lignes.push(`Vous n'avez pas accès à « ${sujet.nom} » avec votre rôle. Adressez-vous à un administrateur.`);
        continue;
      }
      try {
        const { rows } = await db.query(sujet.sql);
        const n = sujet.montant ? Number(rows[0].n) : parseInt(rows[0].n, 10) || 0;
        lignes.push(sujet.texte(n));
      } catch (e) {
        // Une table absente ne doit pas bloquer les autres reponses
        console.error('[ASSISTANT] sujet', sujet.id, e.message);
        lignes.push(`Donnée indisponible pour « ${sujet.nom} ».`);
      }
    }
    res.json({ text: lignes.join('\n'), suggestions: SUGGESTIONS });
  } catch (e) {
    console.error('[ASSISTANT]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
