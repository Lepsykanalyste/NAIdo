-- NAIdo - Densité atelier 3 (paramètre admin) : poids des articles = longueur x largeur x épaisseur x densité x facteur
-- Facteur : 2 si l'unité de l'article est la pièce, 1 si elle est le Kg. Additif, sans perte de données.
INSERT INTO parametres_systeme (cle, valeur, type_valeur, description, modifiable_par)
VALUES ('densite_atelier3', '0.92', 'number', 'Densité atelier 3 (0,91 à 1 selon le lot) : le poids des articles se recalcule dès qu''elle change', 'directeur')
ON CONFLICT (cle) DO NOTHING;

SELECT 'densite_atelier3 : OK' AS statut;
