'use strict';
// NAIdo - Poids théorique d'un article à partir de ses dimensions (règle de l'atelier 3, fichier SACHERIE) :
//   poids unitaire (kg) = (longueur / 100) x (largeur / 100) x épaisseur x densité x facteur
//   facteur = 2 si l'unité de l'article est la pièce, 1 si elle est le Kg.
// Les articles sans dimensions gardent leur poids saisi à la main.

// Recalcule le poids des articles (tous, ou un seul si articleId est donné). Renvoie le nombre de lignes modifiées.
async function recalculerPoids(db, articleId = null) {
  const { rows } = await db.query("SELECT valeur FROM parametres_systeme WHERE cle = 'densite_atelier3'");
  const densite = parseFloat(rows[0]?.valeur);
  if (!Number.isFinite(densite) || densite <= 0) return 0;
  const params = [densite];
  let filtre = '';
  if (articleId) { params.push(String(articleId)); filtre = ` AND a.id = $2`; }
  const res = await db.query(
    `UPDATE articles a
        SET poids_theorique_kg = ROUND(((a.longueur_mm / 100) * (a.largeur_mm / 100) * a.epaisseur_mm * $1
              * (CASE WHEN LOWER(um.code) = 'kg' THEN 1 ELSE 2 END))::numeric, 4)
       FROM unites_mesure um
      WHERE um.id = a.unite_mesure_id
        AND LOWER(um.code) IN ('pce', 'pc', 'piece', 'pièce', 'kg')
        AND a.longueur_mm > 0 AND a.largeur_mm > 0 AND a.epaisseur_mm > 0${filtre}`,
    params
  );
  return res.rowCount || 0;
}

module.exports = { recalculerPoids };
