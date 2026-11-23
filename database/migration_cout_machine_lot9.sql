-- NAIdo - Lot 9 : cout horaire par machine (vide = valeur provisoire de l'atelier). Idempotent.
ALTER TABLE machines ADD COLUMN IF NOT EXISTS cout_horaire_fcfa NUMERIC(12,2);
SELECT 'lot 9 cout horaire machine : OK' AS statut;
