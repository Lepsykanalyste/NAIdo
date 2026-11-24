'use strict';
// NAIdo - Assistant local (sans modele de langage, sans service externe), sur le modele de l'assistant LEINAD :
// question -> periode (ce mois, hier, un mois precis...) -> sujets reperes par mots-cles -> chiffres calcules dans la base,
// et graphiques. Chaque sujet est verifie avec les memes regles RBAC que les ecrans : l'assistant ne montre jamais plus que le menu.
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { decider } = require('../middleware/rbac');
const router = express.Router();

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const accesA = (role, motif) => decider(role, 'GET', motif).autorise;

// ---------------------------------------------------------------- periodes
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const MOIS_LABEL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const bornes = (an, mo) => ({
  debut: iso(new Date(an, mo, 1)), fin: iso(new Date(an, mo + 1, 0)), libelle: `${MOIS_LABEL[mo]} ${an}`,
});

// Retourne {debut, fin, libelle} deduit de la question ; par defaut le mois en cours
function periodeDe(s, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth();
  if (/aujourd/.test(s)) return { debut: iso(today), fin: iso(today), libelle: "aujourd'hui" };
  if (/\bhier\b/.test(s)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return { debut: iso(d), fin: iso(d), libelle: 'hier' };
  }
  if (/30 derniers jours|trente derniers jours/.test(s)) {
    const d = new Date(today); d.setDate(d.getDate() - 29);
    return { debut: iso(d), fin: iso(today), libelle: '30 derniers jours' };
  }
  if (/mois dernier|mois precedent/.test(s)) {
    const d = new Date(y, m - 1, 1);
    return bornes(d.getFullYear(), d.getMonth());
  }
  const idx = MOIS.findIndex((x) => new RegExp(`\\b${x}\\b`).test(s));
  if (idx >= 0) {
    const an = (s.match(/\b(20\d\d)\b/) || [])[1];
    const annee = an ? Number(an) : (idx > m ? y - 1 : y);
    return bornes(annee, idx);
  }
  const p = bornes(y, m);
  p.libelle = `${MOIS_LABEL[m]} ${y} (mois en cours)`;
  return p;
}

// ---------------------------------------------------------------- sujets chiffres
// periode = true : la requete attend $1 (debut) et $2 (fin)
const SUJETS = [
  { id: 'achats_resume', nom: 'Achats', motif: '/api/achat', rx: /achat|commande|depense|bon de commande/, periode: true,
    sql: "SELECT COUNT(*)::int AS n, COALESCE(SUM(montant_ttc),0)::float AS m FROM commandes_achat WHERE date_commande::date BETWEEN $1 AND $2 AND statut <> 'annule'",
    texte: (r, p) => `Achats ${p.libelle} : ${r.n} commande(s), ${fcfa(r.m)} FCFA TTC.` },
  { id: 'achats_validation', nom: 'Achats - validation direction', motif: '/api/achat', rx: /valid|attente.*direction|a valider/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'en_attente_direction'",
    texte: (r) => `${r.n} commande(s) en attente de validation par la direction.` },
  { id: 'achats_envoi', nom: 'Achats - envoi fournisseur', motif: '/api/achat', rx: /envoy|envoi|a envoyer/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE validation = 'validee' AND statut = 'brouillon'",
    texte: (r) => `${r.n} bon(s) validé(s) à envoyer au fournisseur.` },
  { id: 'achats_reception', nom: 'Achats - réception', motif: '/api/achat', rx: /receptionn|reception|livrai|livrer/,
    sql: "SELECT COUNT(*)::int AS n FROM commandes_achat WHERE statut IN ('confirme','receptionne_partiel')",
    texte: (r) => `${r.n} commande(s) à réceptionner.` },
  { id: 'demandes_achat', nom: "Demandes d'achat", motif: '/api/achat', rx: /demande/,
    sql: "SELECT COUNT(*)::int AS n FROM demandes_achat WHERE statut = 'en_attente'",
    texte: (r) => `${r.n} demande(s) d'achat en attente.` },
  { id: 'fournisseurs', nom: 'Fournisseurs', motif: '/api/fournisseurs', rx: /fournisseur/,
    sql: "SELECT COUNT(*)::int AS n FROM fournisseurs WHERE actif IS NOT FALSE",
    texte: (r) => `${r.n} fournisseur(s) actif(s).` },
  { id: 'ventes_resume', nom: 'Ventes', motif: '/api/vente', rx: /\bca\b|chiffre|revenu|vente|\bventes?\b/, periode: true,
    sql: "SELECT COUNT(*)::int AS n, COALESCE(SUM(montant_ttc),0)::float AS m FROM ventes WHERE date_vente::date BETWEEN $1 AND $2 AND statut <> 'annule'",
    texte: (r, p) => `Chiffre d'affaires TTC ${p.libelle} : ${fcfa(r.m)} FCFA, sur ${r.n} vente(s).` },
  { id: 'ventes_encaisser', nom: 'Ventes - à encaisser', motif: '/api/vente', rx: /encaiss|impaye|solde|a payer|creance/,
    sql: "SELECT COUNT(*)::int AS n FROM ventes WHERE statut <> 'annule' AND COALESCE(solde_restant, 0) > 0",
    texte: (r) => `${r.n} vente(s) avec un solde à encaisser.` },
  { id: 'nc', nom: 'Non-conformités', motif: '/api/non-conformites', rx: /non.?conform|\bnc\b|qualit/,
    sql: "SELECT COUNT(*)::int AS n FROM non_conformites WHERE statut NOT IN ('clos','annule')",
    texte: (r) => `${r.n} non-conformité(s) ouverte(s).` },
  { id: 'alertes', nom: 'Alertes', motif: '/api/alertes', rx: /alerte/,
    sql: "SELECT COUNT(*)::int AS n FROM alertes WHERE lue = false",
    texte: (r) => `${r.n} alerte(s) non lue(s).` },
  { id: 'conges', nom: 'Congés', motif: '/api/rh', rx: /conge/,
    sql: "SELECT COUNT(*)::int AS n FROM conges WHERE statut = 'en_attente'",
    texte: (r) => `${r.n} demande(s) de congé en attente.` },
];

const SUGGESTIONS = ['CA du mois', 'Achats du mois', 'Combien de bons à envoyer ?', 'Graphique des ventes du mois', 'Mes droits'];

const AIDE = "Je suis l'assistant de NAIdo. Je réponds à partir des données de l'entreprise, uniquement dans les domaines accessibles à votre rôle, et je calcule tout sur place. Exemples : « CA du mois », « achats de mars 2026 », « ventes d'hier », « graphique des ventes ce mois », « combien de bons à envoyer ? ». Tapez « mes droits » pour voir votre périmètre.";

// ---------------------------------------------------------------- graphiques (par jour, ou par mois si la periode est longue)
async function graphique(role, s, periode) {
  const veutAchats = /achat|commande|depense/.test(s);
  const veutVentes = /vente|\bca\b|chiffre|revenu/.test(s);
  let source = null;
  if (veutAchats && accesA(role, '/api/achat')) source = 'achats';
  else if (veutVentes && accesA(role, '/api/vente')) source = 'ventes';
  else if (!veutAchats && !veutVentes) {
    if (accesA(role, '/api/vente')) source = 'ventes';
    else if (accesA(role, '/api/achat')) source = 'achats';
  }
  if (!source) {
    return { text: "Vous n'avez pas accès aux données nécessaires à ce graphique avec votre rôle. Adressez-vous à un administrateur." };
  }
  const table = source === 'achats' ? 'commandes_achat' : 'ventes';
  const colDate = source === 'achats' ? 'date_commande' : 'date_vente';
  const jours = (new Date(periode.fin) - new Date(periode.debut)) / 86400000 + 1;
  const parMois = jours > 62;
  const regroupement = parMois ? `to_char(${colDate}::date, 'YYYY-MM')` : `${colDate}::date`;
  const sql = `SELECT ${regroupement} AS cle, COALESCE(SUM(montant_ttc),0)::float AS v FROM ${table}
               WHERE ${colDate}::date BETWEEN $1 AND $2 ${source === 'ventes' ? "AND statut <> 'annule'" : "AND statut <> 'annule'"}
               GROUP BY 1 ORDER BY 1`;
  const { rows } = await db.query(sql, [periode.debut, periode.fin]);
  const titre = `${source === 'achats' ? 'Achats' : 'Ventes'} (TTC) — ${periode.libelle}`;
  const labels = rows.map((r) => (parMois ? String(r.cle) : String(r.cle).slice(8, 10) + '/' + String(r.cle).slice(5, 7)));
  const values = rows.map((r) => Math.round(r.v));
  return {
    text: `Graphique : ${titre}.`,
    graph: { type: 'bar', title: titre, labels, values, total: values.reduce((a, b) => a + b, 0) },
  };
}

// ---------------------------------------------------------------- route
router.post('/ask', auth, async (req, res) => {
  try {
    const question = String(req.body?.question || '').slice(0, 300);
    const role = String(req.user?.role || '');
    const s = norm(question);

    if (!s) return res.json({ text: AIDE, suggestions: SUGGESTIONS });

    if (/^(bonjour|bonsoir|bjr|salut|hello|hi|salam|coucou|bonne (journee|soiree))\b/.test(s)) {
      return res.json({ text: `Bonjour ! ${AIDE}`, suggestions: SUGGESTIONS });
    }
    if (/qui (es|est)[- ]tu|tu es qui|ton nom|presente[- ]toi|c.est quoi/.test(s)) {
      return res.json({ text: "Je suis l'assistant interne de NAIdo. Je ne fais appel à aucun service extérieur : mes réponses viennent des données de votre entreprise, selon vos droits.", suggestions: SUGGESTIONS });
    }
    if (/mes droits|mon role|mes acces|mes permissions|qu.est.ce que je peux|que puis.je|aide|que sais|help/.test(s)) {
      const ok = SUJETS.filter((x) => accesA(role, x.motif)).map((x) => x.nom);
      const graphOk = accesA(role, '/api/vente') || accesA(role, '/api/achat');
      const texte = ok.length
        ? `Avec votre rôle (${role}), je peux répondre sur : ${[...new Set(ok)].join(', ')}${graphOk ? ', et faire des graphiques' : ''}.`
        : `Avec votre rôle (${role}), je ne peux répondre sur aucun sujet. Adressez-vous à un administrateur.`;
      return res.json({ text: texte, suggestions: SUGGESTIONS });
    }

    const periode = periodeDe(s);
    const lignes = [];
    let graph = null;

    if (/graph|courbe|diagramme|histogramme|camembert|chart/.test(s)) {
      const g = await graphique(role, s, periode);
      if (g.graph) graph = g.graph;
      lignes.push(g.text);
    }

    const trouves = SUJETS.filter((x) => x.rx.test(s));
    for (const sujet of trouves) {
      if (!accesA(role, sujet.motif)) {
        lignes.push(`Vous n'avez pas accès à « ${sujet.nom} » avec votre rôle. Adressez-vous à un administrateur.`);
        continue;
      }
      try {
        const { rows } = await db.query(sujet.sql, sujet.periode ? [periode.debut, periode.fin] : []);
        lignes.push(sujet.texte(rows[0] || {}, periode));
      } catch (e) {
        console.error('[ASSISTANT] sujet', sujet.id, e.message);
        lignes.push(`Donnée indisponible pour « ${sujet.nom} ».`);
      }
    }

    if (lignes.length === 0) {
      return res.json({ text: `Je n'ai pas compris la question. ${AIDE}`, suggestions: SUGGESTIONS });
    }
    res.json({ text: lignes.join('\n'), graph, suggestions: SUGGESTIONS });
  } catch (e) {
    console.error('[ASSISTANT]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
