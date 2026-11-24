-- NAIdo - Photo de profil par utilisateur. Additif : une colonne nouvelle, aucune modification existante.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS photo_path varchar(255);

SELECT 'photo_path : OK' AS statut;
