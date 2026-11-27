'use strict';
// NAIdo - Non-conformites matieres (reception) : table, numerotation et creation.
// Circuit : declaration (atelier a la reception d'une DBM, ou magasin a la reception fournisseur)
//   -> validation QHSE (ou refus : la matiere redevient utilisable)
//   -> si besoin validation direction -> magasin (retour fournisseur) -> cloture QHSE.
const db = require('../config/db');

let tablePrete = false;
async function assurerTable(client = db) {
  if (tablePrete) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS nc_matiere (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      numero_nc text UNIQUE NOT NULL,
      origine text NOT NULL,
      statut text NOT NULL DEFAULT 'declaree',
      article_id text, famille_id text, code text, designation text,
      numero_lot text, qte_nc numeric(12,3) NOT NULL, motif text NOT NULL,
      dbm_id text, ligne_id text, livraison_id text, numero_livraison text, numero_dbm text, of_id text, numero_of text,
      commande_id text, numero_commande text, fournisseur_nom text,
      declarant_id text, declarant_nom text, declare_at timestamptz NOT NULL DEFAULT now(),
      qhse_decision text, qhse_par text, qhse_nom text, qhse_at timestamptz, qhse_motif text,
      direction_decision text, direction_par text, direction_nom text, direction_at timestamptz, direction_motif text,
      magasin_par text, magasin_nom text, retour_at timestamptz, retour_ref text,
      close_par text, close_nom text, close_at timestamptz,
      vu_atelier_at timestamptz, vu_achat_at timestamptz,
      stock_restitue boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  tablePrete = true;
}

async function nomUtilisateur(client, id) {
  if (!id) return null;
  try {
    const { rows } = await client.query(`SELECT trim(coalesce(prenom,'') || ' ' || coalesce(nom,'')) AS n FROM utilisateurs WHERE id::text = $1`, [String(id)]);
    return rows[0] ? (rows[0].n || null) : null;
  } catch (e) { return null; }
}

// Numero NC-AAAA-0001 (compteur par annee, protege par un verrou dans la transaction)
async function prochainNumero(client) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('nc_matiere_numero'))`);
  const annee = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(substring(numero_nc from '[0-9]+$')::int), 0) + 1 AS n FROM nc_matiere WHERE numero_nc LIKE $1`, [`NC-${annee}-%`]);
  return `NC-${annee}-${String(rows[0].n).padStart(4, '0')}`;
}

// d : { origine, article_id, famille_id, code, designation, numero_lot, qte_nc, motif, dbm_id, ligne_id, livraison_id,
//       numero_livraison, numero_dbm, of_id, numero_of, commande_id, numero_commande, fournisseur_nom, declarant_id }
async function creerNc(client, d) {
  await assurerTable(client);
  const numero = await prochainNumero(client);
  const nom = await nomUtilisateur(client, d.declarant_id);
  const s = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const { rows } = await client.query(`
    INSERT INTO nc_matiere (numero_nc, origine, article_id, famille_id, code, designation, numero_lot, qte_nc, motif,
      dbm_id, ligne_id, livraison_id, numero_livraison, numero_dbm, of_id, numero_of,
      commande_id, numero_commande, fournisseur_nom, declarant_id, declarant_nom)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING *`,
    [numero, d.origine, s(d.article_id), s(d.famille_id), s(d.code), s(d.designation), s(d.numero_lot), d.qte_nc, String(d.motif).trim(),
     s(d.dbm_id), s(d.ligne_id), s(d.livraison_id), s(d.numero_livraison), s(d.numero_dbm), s(d.of_id), s(d.numero_of),
     s(d.commande_id), s(d.numero_commande), s(d.fournisseur_nom), s(d.declarant_id), nom]);
  return rows[0];
}

module.exports = { assurerTable, creerNc, nomUtilisateur };
