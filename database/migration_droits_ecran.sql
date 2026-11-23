-- NAIdo - Lot 2 (etape 2) : ecran Droits. Garde la politique precedente pour le bouton « Revenir a l'etat precedent ». Idempotent.
ALTER TABLE politique_acces ADD COLUMN IF NOT EXISTS precedente JSONB;
SELECT 'lot 2 etape 2 : OK' AS statut;
