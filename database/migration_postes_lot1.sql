-- NAIdo - Lot 1 : postes (roles) utilises par l'ecran d'administration, comptes repositionnes. Idempotent.
INSERT INTO roles (nom, description)
SELECT v.nom, v.description FROM (VALUES
  ('achat',         'Service achats : traite les demandes, emet les bons de commande'),
  ('magasinier_mp', 'Magasin matieres premieres : livraisons a l''atelier, reception'),
  ('magasinier',    'Magasinier (magasin central ou atelier 3)'),
  ('qualite',       'Controle qualite et non-conformites'),
  ('regleur',       'Regleur de machine'),
  ('technicien',    'Technicien de maintenance (electrique, mecanique, electronique, soudure, plomberie...)'),
  ('rh',            'Ressources humaines'),
  ('vente',         'Vente')
) AS v(nom, description)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.nom = v.nom);

-- achat1 : c'etait un chef d'atelier par erreur (droits de production)
UPDATE utilisateurs SET role = 'achat' WHERE login = 'achat1' AND role IS DISTINCT FROM 'achat';
-- tous les regleurs sont des regleurs
UPDATE utilisateurs SET role = 'regleur' WHERE role = 'technicien_regleur' AND login IN ('regleur1', 'regleur2');

-- une seule source : role_id suit le nom du role texte
UPDATE utilisateurs u SET role_id = r.id
FROM roles r
WHERE r.nom = u.role AND u.role_id IS DISTINCT FROM r.id;

SELECT 'lot 1 postes : OK' AS statut;
