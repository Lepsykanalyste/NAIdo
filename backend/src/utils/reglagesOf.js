'use strict';
// NAIdo - Réglages d'un OF : un OF peut avoir plusieurs réglages (ex. arrêt, puis nouveau réglage au redémarrage).
// Chaque validation du régleur crée une ligne d'historique avec son propre ticket (TKR-AAAA-NNNN) et son rang (1, 2, 3...).
// L'OF garde le dernier réglage (pour l'opérateur) ; rien n'est écrasé dans l'historique.
const db = require('../config/db');

let prete = null;
function assurerReglages() {
  if (!prete) {
    prete = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS reglages_of (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          of_id text NOT NULL,
          session_id text,
          numero_ticket text UNIQUE NOT NULL,
          rang integer NOT NULL DEFAULT 1,
          motif text,
          regleur_id text,
          machine_id text,
          valide_at timestamptz NOT NULL DEFAULT now(),
          temperature numeric, pression numeric, vitesse numeric,
          notes text
        )`);
      await db.query(`CREATE INDEX IF NOT EXISTS reglages_of_of_idx ON reglages_of (of_id, rang)`);
      // Reprise de l'existant : le dernier réglage déjà validé de chaque OF devient son réglage n°1
      await db.query(`
        INSERT INTO reglages_of (of_id, numero_ticket, rang, motif, regleur_id, machine_id, valide_at, temperature, pression, vitesse, notes)
        SELECT o.id::text, o.numero_ticket_reglage, 1, 'Premier réglage', o.regleur_id::text, o.machine_id::text,
               COALESCE(o.regleur_valide_at, now()), o.regleur_temperature, o.regleur_pression, o.regleur_vitesse, o.regleur_notes
        FROM ordres_fabrication o
        WHERE o.regleur_valide = true AND o.numero_ticket_reglage IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM reglages_of r WHERE r.numero_ticket = o.numero_ticket_reglage)`);
    })().catch(e => { prete = null; throw e; });
  }
  return prete;
}

// Enregistre un réglage et renvoie son numéro de ticket et son rang
async function enregistrerReglage(client, d) {
  await assurerReglages();
  const n = await client.query(`SELECT COUNT(*)::int AS n FROM reglages_of WHERE of_id = $1`, [String(d.of_id)]);
  const rang = n.rows[0].n + 1;
  const t = await client.query(`SELECT 'TKR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('seq_ticket_reglage')::text, 4, '0') AS num`);
  const numero = t.rows[0].num;
  const motif = String(d.motif || '').trim() || (rang === 1 ? 'Premier réglage' : 'Réglage pour la session de production');
  await client.query(
    `INSERT INTO reglages_of (of_id, session_id, numero_ticket, rang, motif, regleur_id, machine_id, temperature, pression, vitesse, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [String(d.of_id), d.session_id ? String(d.session_id) : null, numero, rang, motif, d.regleur_id ? String(d.regleur_id) : null,
      d.machine_id ? String(d.machine_id) : null, d.temperature, d.pression, d.vitesse, d.notes]);
  return { numero_ticket: numero, rang, motif };
}

module.exports = { assurerReglages, enregistrerReglage };
