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
  if (/cette annee|annee en cours/.test(s)) {
    return { debut: iso(new Date(y, 0, 1)), fin: iso(today), libelle: `année ${y} (en cours)` };
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
  const serie = await serieGraphique(source, periode);
  return { text: `Graphique : ${serie.title}.`, graph: serie };
}

// Serie pour un graphique : par jour, ou par mois si la periode depasse 62 jours
async function serieGraphique(source, periode) {
  const table = source === 'achats' ? 'commandes_achat' : 'ventes';
  const colDate = source === 'achats' ? 'date_commande' : 'date_vente';
  const jours = (new Date(periode.fin) - new Date(periode.debut)) / 86400000 + 1;
  const parMois = jours > 62;
  const regroupement = parMois ? `to_char(${colDate}::date, 'YYYY-MM')` : `${colDate}::date`;
  // Pour les ventes, on ajoute le montant encaisse (deuxieme courbe, comme les avoirs dans LEINAD)
  const encaisse = source === 'ventes' ? ', COALESCE(SUM(montant_paye),0)::float AS e' : '';
  const sql = `SELECT ${regroupement} AS cle, COALESCE(SUM(montant_ttc),0)::float AS v${encaisse} FROM ${table}
               WHERE ${colDate}::date BETWEEN $1 AND $2 AND statut <> 'annule'
               GROUP BY 1 ORDER BY 1`;
  const { rows } = await db.query(sql, [periode.debut, periode.fin]);
  const title = `${source === 'achats' ? 'Achats' : 'Ventes'} (TTC) — ${periode.libelle}`;
  const labels = rows.map((r) => (parMois ? String(r.cle) : String(r.cle).slice(8, 10) + '/' + String(r.cle).slice(5, 7)));
  const values = rows.map((r) => Math.round(r.v));
  const serie = { type: 'bar', title, labels, values, total: values.reduce((a, b) => a + b, 0) };
  if (source === 'ventes') serie.encaisse = rows.map((r) => Math.round(r.e));
  return serie;
}

// Indicateurs du panneau de gauche : seulement ce que la personne peut voir
// Calcule les indicateurs pour une personne (role) et une periode (p) : sert au panneau et au PDF
async function kpisPour(role, p) {
    const periodes = { month: 'ce mois', last_month: 'mois dernier', days30: '30 derniers jours', year: 'cette annee' };
    const periode = periodeDe(norm(periodes[p] || 'ce mois'));
    const out = { periode: periode.libelle, ca: null, ventes: null, achats: null, commandes: null, graph: null,
      produits: null, paiements: null, statuts: null, encaisse: null, points: null };
    if (accesA(role, '/api/vente')) {
      const { rows } = await db.query("SELECT COUNT(*)::int AS n, COALESCE(SUM(montant_ttc),0)::float AS m FROM ventes WHERE date_vente::date BETWEEN $1 AND $2 AND statut <> 'annule'", [periode.debut, periode.fin]);
      out.ca = Math.round(rows[0].m); out.ventes = rows[0].n;
      out.graph = await serieGraphique('ventes', periode);
      // Produits les plus vendus (chiffre d'affaires TTC par designation)
      const top = await db.query(`SELECT l.designation AS nom, COALESCE(SUM(l.montant_ttc),0)::float AS v
        FROM lignes_vente l JOIN ventes v ON v.id = l.vente_id
        WHERE v.date_vente::date BETWEEN $1 AND $2 AND v.statut <> 'annule'
        GROUP BY l.designation ORDER BY 2 DESC LIMIT 5`, [periode.debut, periode.fin]);
      out.produits = top.rows.map((r) => ({ nom: r.nom, valeur: Math.round(r.v) }));
      // Modes de paiement
      const pay = await db.query(`SELECT COALESCE(mode_paiement, 'non renseigné') AS nom, COALESCE(SUM(montant_ttc),0)::float AS v
        FROM ventes WHERE date_vente::date BETWEEN $1 AND $2 AND statut <> 'annule'
        GROUP BY 1 ORDER BY 2 DESC`, [periode.debut, periode.fin]);
      out.paiements = pay.rows.map((r) => ({ nom: r.nom, valeur: Math.round(r.v) }));
      // Statut des ventes (nombre de ventes par statut), comme la carte « Certification FNE » de LEINAD
      const etats = { brouillon: 'Brouillon', confirme: 'Confirmées', livre: 'Livrées', facture: 'Facturées', paye: 'Payées', annule: 'Annulées' };
      const st = await db.query(`SELECT statut, COUNT(*)::int AS n FROM ventes
        WHERE date_vente::date BETWEEN $1 AND $2 GROUP BY statut ORDER BY 2 DESC`, [periode.debut, periode.fin]);
      out.statuts = st.rows.map((r) => ({ nom: etats[r.statut] || r.statut, valeur: r.n }));
      // Montant encaisse, en plus du chiffre d'affaires
      const enc = await db.query(`SELECT COALESCE(SUM(montant_paye),0)::float AS e FROM ventes
        WHERE date_vente::date BETWEEN $1 AND $2 AND statut <> 'annule'`, [periode.debut, periode.fin]);
      out.encaisse = Math.round(enc.rows[0].e);
      // Points clés
      const meilleur = out.graph && out.graph.values.length
        ? out.graph.labels[out.graph.values.indexOf(Math.max(...out.graph.values))] : null;
      out.points = [
        `Chiffre d'affaires TTC : ${fcfa(out.ca)} FCFA sur ${out.ventes} vente(s).`,
        out.ventes ? `Panier moyen : ${fcfa(out.ca / out.ventes)} FCFA.` : 'Panier moyen : —.',
        out.ca ? `Montant encaissé : ${fcfa(out.encaisse)} FCFA, soit ${Math.round((out.encaisse / out.ca) * 100)} % du chiffre d'affaires.` : null,
        meilleur ? `Meilleur jour : ${meilleur}.` : null,
        out.produits && out.produits.length ? `Produit en tête : ${out.produits[0].nom}.` : null,
      ].filter(Boolean);
    }
    if (accesA(role, '/api/achat')) {
      const { rows } = await db.query("SELECT COUNT(*)::int AS n, COALESCE(SUM(montant_ttc),0)::float AS m FROM commandes_achat WHERE date_commande::date BETWEEN $1 AND $2 AND statut <> 'annule'", [periode.debut, periode.fin]);
      out.achats = Math.round(rows[0].m); out.commandes = rows[0].n;
      if (!out.graph) out.graph = await serieGraphique('achats', periode);
    }
    return out;
}

router.get('/kpis', auth, async (req, res) => {
  try {
    res.json(await kpisPour(String(req.user?.role || ''), req.query.p));
  } catch (e) {
    console.error('[ASSISTANT kpis]', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Export PDF du rapport d'activite : memes droits que le panneau
router.get('/export', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '');
    const k = await kpisPour(role, req.query.p);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const nomFichier = `rapport-activite-${k.periode.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    doc.pipe(res);

    const VERT = '#1a8f5c', G = 40, W = 595 - 80;
    const acces = (v, f) => (v === null || v === undefined ? 'Accès limité' : f(v));
    const titre = (t) => {
      if (doc.y > 740) doc.addPage();
      doc.moveDown(0.8);
      doc.fillColor(VERT).font('Helvetica-Bold').fontSize(12).text(t, G, doc.y, { width: W });
      doc.moveTo(G, doc.y + 2).lineTo(G + W, doc.y + 2).strokeColor('#e5e7eb').lineWidth(0.8).stroke();
      doc.moveDown(0.6);
      doc.fillColor('#111827');
    };
    const tableau = (entetes, lignes, poids) => {
      const total = poids.reduce((a, b) => a + b, 0);
      const largeurs = poids.map((p) => (W * p) / total);
      const ligne = (cellules, fond, gras) => {
        if (doc.y > 770) doc.addPage();
        const y0 = doc.y;
        if (fond) doc.rect(G, y0 - 2, W, 17).fill(fond);
        let x = G;
        cellules.forEach((c, i) => {
          doc.fillColor(gras ? '#ffffff' : '#111827').font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
            .text(String(c), x + 5, y0, { width: largeurs[i] - 10, align: i === 0 ? 'left' : 'right', lineBreak: false });
          x += largeurs[i];
        });
        doc.y = y0 + 17;
      };
      ligne(entetes, VERT, true);
      lignes.forEach((l, i) => ligne(l, i % 2 ? '#f3f4f6' : null, false));
      doc.moveDown(0.4);
    };

    // Entete
    doc.rect(0, 0, 595, 80).fill(VERT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text("Rapport d'activité", G, 24);
    doc.font('Helvetica').fontSize(10).text(`Période : ${k.periode}`, G, 50);
    doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, 300, 50, { width: 255, align: 'right' });
    doc.fillColor('#111827');
    doc.y = 100;

    // Indicateurs
    const cartes = [
      ["Chiffre d'affaires TTC", acces(k.ca, (v) => `${fcfa(v)} FCFA`)],
      ['Ventes', acces(k.ventes, (v) => String(v))],
      ['Achats TTC', acces(k.achats, (v) => `${fcfa(v)} FCFA`)],
      ["Commandes d'achat", acces(k.commandes, (v) => String(v))],
    ];
    const bw = (W - 18) / 4, yc = doc.y;
    cartes.forEach(([t, v], i) => {
      const x = G + i * (bw + 6);
      doc.roundedRect(x, yc, bw, 50, 6).lineWidth(0.8).strokeColor('#e5e7eb').stroke();
      doc.fillColor('#6b7280').font('Helvetica').fontSize(8).text(t, x + 8, yc + 8, { width: bw - 16 });
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(v, x + 8, yc + 26, { width: bw - 16 });
    });
    doc.y = yc + 60;

    // Points cles
    titre('Points clés de la période');
    if (k.points === null) doc.fillColor('#6b7280').font('Helvetica').fontSize(10).text('Accès limité');
    else k.points.forEach((p) => doc.font('Helvetica').fontSize(10).fillColor('#111827').text(`•  ${p}`, G, doc.y, { width: W }));

    // Produits
    titre('Produits les plus vendus');
    if (k.produits === null) doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Accès limité');
    else if (!k.produits.length) doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Aucune vente sur la période.');
    else tableau(['Produit', 'Montant TTC (FCFA)'], k.produits.map((p) => [p.nom, fcfa(p.valeur)]), [3, 1.2]);

    // Modes de paiement
    titre('Modes de paiement');
    if (k.paiements === null) doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Accès limité');
    else if (!k.paiements.length) doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Aucune vente sur la période.');
    else {
      const tot = k.paiements.reduce((a, b) => a + b.valeur, 0) || 1;
      tableau(['Mode', 'Montant TTC (FCFA)', 'Part'], k.paiements.map((p) => [p.nom, fcfa(p.valeur), `${Math.round((p.valeur / tot) * 100)} %`]), [2.4, 1.6, 0.8]);
    }

    // Evolution
    titre('Évolution des ventes');
    if (!k.graph) doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Accès limité ou aucune donnée sur la période.');
    else tableau(['Période', 'Montant TTC (FCFA)'], k.graph.labels.map((l, i) => [l, fcfa(k.graph.values[i])]), [2, 1.5]);

    // Pied de page sur chaque page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(`NAIdo — rapport d'activité · page ${i + 1} / ${range.count}`, G, 800, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  } catch (e) {
    console.error('[ASSISTANT export]', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
