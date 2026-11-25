'use strict';
// NAIdo - Poids théorique d'un article à partir de ses dimensions (règle de l'atelier 3, fichier SACHERIE) :
//   longueur et largeur en mm (longueur_mm, largeur_mm), épaisseur en mm (epaisseur_mm)
//   poids unitaire (kg) = (longueur_mm / 10) x (largeur_mm / 10) x épaisseur_mm x densité / 10000 x facteur
//   (longueur_mm / 10 = cm, donc cm x cm x mm / 10000 = kg)
//   largeur_mm = largeur réelle à plat (pour une housse : A + 2B, voir le script de reprise)
//   facteur = 2 pour une housse (deux plis), 1 pour les autres articles.
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
        SET poids_theorique_kg = ROUND(((a.longueur_mm / 10.0) * (a.largeur_mm / 10.0) * a.epaisseur_mm * $1 / 10000.0
              * (CASE WHEN UPPER(a.designation) LIKE '%HOUSSE%' OR UPPER(a.code) LIKE 'HOUS%' THEN 2 ELSE 1 END))::numeric, 4)
       FROM unites_mesure um, ateliers at
      WHERE um.id = a.unite_mesure_id
        AND at.id = a.atelier_production_id
        AND (UPPER(at.code) = 'AT3' OR UPPER(at.parent_code) = 'AT3' OR at.libelle ILIKE '%atelier 3%')
        AND LOWER(um.code) IN ('pce', 'pc', 'piece', 'pièce', 'kg')
        AND a.longueur_mm > 0 AND a.largeur_mm > 0 AND a.epaisseur_mm > 0${filtre}`,
    params
  );
  return res.rowCount || 0;
}

module.exports = { recalculerPoids };
