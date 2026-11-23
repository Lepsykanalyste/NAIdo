-- NAIdo - Droit « devis » : le commercial crée et modifie les devis ; le poste vente ne les modifie plus.
-- Le droit se règle ensuite dans l'écran Droits (écran « devis », colonne modifier).
-- Additif et réversible : ne touche ni aux autres écrans ni à la politique d'accès (politique_acces).

INSERT INTO droits_ecrans (poste, ecran, voir, modifier)
VALUES ('commercial', 'devis', true, true)
ON CONFLICT (poste, ecran) DO UPDATE SET voir = true, modifier = true;

INSERT INTO droits_ecrans (poste, ecran, voir, modifier)
VALUES ('vente', 'devis', true, false)
ON CONFLICT (poste, ecran) DO UPDATE SET voir = true, modifier = false;

SELECT 'droit devis : OK' AS statut;
