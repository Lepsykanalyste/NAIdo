-- NAIdo - Signature de chaque utilisateur (image importee dans son compte, utilisee sur les documents). Additif.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS signature_path varchar(255);

SELECT 'signature_path : OK' AS statut;
