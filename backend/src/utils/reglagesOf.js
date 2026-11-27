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
      // Reprises : l'opérateur qui monte (changement de quart) reprend le réglage en cours, avec le même ticket
      await db.query(`
        CREATE TABLE IF NOT EXISTS reglages_reprises (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          of_id text NOT NULL, numero_ticket text, rang integer, session_id text,
          operateur_id text, operateur_nom text, shift_id text, shift_nom text, mode text,
          at timestamptz NOT NULL DEFAULT now()
        )`);
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
  const n = await client.query(`SELECT COALESCE(MAX(rang), 0)::int AS n FROM reglages_of WHERE of_id = $1`, [String(d.of_id)]);
  const rang = n.rows[0].n + 1;
  // Le ticket suit l'OF et se compte : OF-2026-1003 -> TKR-2026-1003-001, -002, -003...
  const o = await client.query(`SELECT numero_of FROM ordres_fabrication WHERE id::text = $1`, [String(d.of_id)]);
  let numero;
  if (o.rows[0] && o.rows[0].numero_of) {
    numero = 'TKR-' + String(o.rows[0].numero_of).replace(/^OF-/i, '') + '-' + String(rang).padStart(3, '0');
  } else {
    const t = await client.query(`SELECT 'TKR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('seq_ticket_reglage')::text, 4, '0') AS num`);
    numero = t.rows[0].num;
  }
  const motif = String(d.motif || '').trim() || (rang === 1 ? 'Premier réglage' : 'Réglage pour la session de production');
  await client.query(
    `INSERT INTO reglages_of (of_id, session_id, numero_ticket, rang, motif, regleur_id, machine_id, temperature, pression, vitesse, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [String(d.of_id), d.session_id ? String(d.session_id) : null, numero, rang, motif, d.regleur_id ? String(d.regleur_id) : null,
      d.machine_id ? String(d.machine_id) : null, d.temperature, d.pression, d.vitesse, d.notes]);
  return { numero_ticket: numero, rang, motif };
}

// Reprise d'un réglage : même ticket, tracé au nom et au quart de l'opérateur de la session (mode : premier | modif | reprise)
async function enregistrerReprise(client, d) {
  await assurerReglages();
  const rg = await client.query(`SELECT numero_ticket, rang FROM reglages_of WHERE of_id = $1 ORDER BY rang DESC LIMIT 1`, [String(d.of_id)]);
  const s = await client.query(
    `SELECT sp.operateur_id, sp.shift_id, sh.nom AS shift_nom, trim(COALESCE(u.prenom,'') || ' ' || COALESCE(u.nom,'')) AS operateur_nom
     FROM sessions_production sp
     LEFT JOIN shifts sh ON sh.id::text = sp.shift_id::text
     LEFT JOIN utilisateurs u ON u.id::text = sp.operateur_id::text
     WHERE sp.id::text = $1`, [String(d.session_id)]);
  const r = rg.rows[0] || {};
  const x = s.rows[0] || {};
  await client.query(
    `INSERT INTO reglages_reprises (of_id, numero_ticket, rang, session_id, operateur_id, operateur_nom, shift_id, shift_nom, mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [String(d.of_id), r.numero_ticket || null, r.rang || null, String(d.session_id), x.operateur_id ? String(x.operateur_id) : null,
      x.operateur_nom || null, x.shift_id ? String(x.shift_id) : null, x.shift_nom || null, d.mode || 'reprise']);
  if (x.operateur_id) {
    await client.query(`UPDATE sessions_production SET regleur_id = $1, regleur_valide = true, regleur_validation_at = NOW() WHERE id::text = $2`, [x.operateur_id, String(d.session_id)]);
  }
  return { numero_ticket: r.numero_ticket || null, rang: r.rang || null, operateur_nom: x.operateur_nom || null, shift_nom: x.shift_nom || null };
}

module.exports = { assurerReglages, enregistrerReglage, enregistrerReprise };
