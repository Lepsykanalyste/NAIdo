-- NAIdo - Lot 1 (partie B) : libelles des postes, plusieurs postes par personne. Idempotent.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS libelle VARCHAR(100);
UPDATE roles SET libelle = COALESCE(libelle, nom);
UPDATE roles SET libelle = v.libelle FROM (VALUES
  ('super_admin','Super administrateur'), ('directeur','Direction'), ('chef_atelier','Chef d''atelier'),
  ('achat','Achats'), ('commercial','Commercial'), ('vente','Vente'), ('magasinier_mp','Magasin matières premières'),
  ('magasinier','Magasinier'), ('qualite','Qualité'), ('regleur','Régleur'), ('technicien','Technicien de maintenance'),
  ('operateur','Opérateur'), ('rh','Ressources humaines'), ('comptable','Comptable')
) AS v(nom, libelle) WHERE roles.nom = v.nom AND roles.libelle = roles.nom;

CREATE TABLE IF NOT EXISTS utilisateur_postes (
  utilisateur_id UUID    NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (utilisateur_id, role_id)
);
-- chaque compte garde son poste actuel comme poste principal
INSERT INTO utilisateur_postes (utilisateur_id, role_id)
SELECT u.id, r.id FROM utilisateurs u JOIN roles r ON r.nom = u.role
ON CONFLICT DO NOTHING;
INSERT INTO utilisateur_postes (utilisateur_id, role_id)
SELECT u.id, u.role_id FROM utilisateurs u WHERE u.role_id IS NOT NULL
ON CONFLICT DO NOTHING;

SELECT 'lot 1 partie B : OK' AS statut;
