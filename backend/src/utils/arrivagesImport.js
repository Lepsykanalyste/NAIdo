'use strict';
// NAIdo - Arrivages import (conteneurs) : zone de quarantaine puis transfert vers le magasin MP.
//   - une reception d'achat IMPORT (commande « import » ou transport par conteneur) range la matiere dans la zone de quarantaine
//     (lot au statut « quarantaine », hors stock disponible : la DBM et le FIFO ne le voient pas) ;
//   - le magasin MP ou les achats la transferent ensuite, en totalite ou en partie, vers le stock du magasin MP.
// Les achats locaux ne changent pas : ils entrent directement en stock.
const db = require('../config/db');

let prete = null;
function assurerStructure() {
  if (!prete) {
    prete = (async () => {
      await db.query(`ALTER TABLE lots_stock
        ADD COLUMN IF NOT EXISTS commande_id uuid,
        ADD COLUMN IF NOT EXISTS reception_id uuid,
        ADD COLUMN IF NOT EXISTS numero_conteneur text,
        ADD COLUMN IF NOT EXISTS numero_plomb text`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS transferts_quarantaine (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          lot_id uuid, article_id uuid, code text, designation text, numero_lot text, numero_lot_stock text,
          qte numeric(15,3) NOT NULL, commande_id uuid, numero_commande text, numero_conteneur text,
          par_id text, par_nom text, at timestamptz NOT NULL DEFAULT now()
        )`);
    })().catch(e => { prete = null; throw e; });
  }
  return prete;
}

// Emplacement « quarantaine » : on utilise celui qui existe, sinon on le cree
async function emplacementQuarantaine(client) {
  const r = await client.query(`SELECT id FROM emplacements_stock WHERE actif = true AND type = 'quarantaine' ORDER BY id LIMIT 1`);
  if (r.rows[0]) return r.rows[0].id;
  const ex = await client.query(`SELECT id FROM emplacements_stock WHERE code = 'QUAR-IMPORT' LIMIT 1`);
  if (ex.rows[0]) {
    await client.query(`UPDATE emplacements_stock SET actif = true, type = 'quarantaine' WHERE id = $1`, [ex.rows[0].id]);
    return ex.rows[0].id;
  }
  const c = await client.query(`INSERT INTO emplacements_stock (code, libelle, type, actif) VALUES ('QUAR-IMPORT', 'Zone de quarantaine - arrivages import', 'quarantaine', true) RETURNING id`);
  return c.rows[0].id;
}

module.exports = { assurerStructure, emplacementQuarantaine };
