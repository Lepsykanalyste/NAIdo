-- NAIdo - Lot 8 : un poste operateur par atelier ; suppression des codes sans personne. Idempotent.
INSERT INTO roles (nom, libelle)
SELECT v.nom, v.lib FROM (VALUES
  ('operateur_ext', 'Opérateur extrusion'),
  ('operateur_dec', 'Opérateur découpe / emballage'),
  ('operateur_imp', 'Opérateur impression'),
  ('operateur_sou', 'Opérateur soudure')) AS v(nom, lib)
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.nom = v.nom);

UPDATE utilisateurs SET role = 'operateur_ext', role_id = (SELECT id FROM roles WHERE nom = 'operateur_ext') WHERE login LIKE 'op\_ext%';
UPDATE utilisateurs SET role = 'operateur_dec', role_id = (SELECT id FROM roles WHERE nom = 'operateur_dec') WHERE login LIKE 'op\_dec%';
UPDATE utilisateurs SET role = 'operateur_imp', role_id = (SELECT id FROM roles WHERE nom = 'operateur_imp') WHERE login LIKE 'op\_imp%';
UPDATE utilisateurs SET role = 'operateur_sou', role_id = (SELECT id FROM roles WHERE nom = 'operateur_sou') WHERE login LIKE 'op\_sou%';

-- postes par personne : on resynchronise les operateurs
DELETE FROM utilisateur_postes WHERE utilisateur_id IN (SELECT id FROM utilisateurs WHERE role LIKE 'operateur%');
INSERT INTO utilisateur_postes (utilisateur_id, role_id)
SELECT id, role_id FROM utilisateurs WHERE role LIKE 'operateur%' AND role_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- codes sans personne : supprimes (jamais s'ils sont attribues)
DELETE FROM roles r
WHERE r.nom IN ('operateur','magasinier_at3','magasinier_central','qhse','technicien_regleur','responsable_stock',
                'responsable_qhse','responsable_rh','technicien_gmao','controleur_qualite','emballeur')
  AND NOT EXISTS (SELECT 1 FROM utilisateurs u WHERE u.role = r.nom OR u.role_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM utilisateur_postes up WHERE up.role_id = r.id);

SELECT 'lot 8 postes operateurs : OK' AS statut;
