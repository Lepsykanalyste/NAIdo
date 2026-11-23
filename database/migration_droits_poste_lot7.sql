-- NAIdo - Lot 7 : chaque poste connecte peut lire son tableau de bord (/api/poste). Idempotent.
UPDATE politique_acces
SET contenu = jsonb_set(contenu, '{tous_connectes}', (contenu->'tous_connectes') || jsonb_build_array(jsonb_build_object('motif', '/api/poste')))
WHERE id = 1 AND NOT (contenu->'tous_connectes' @> '[{"motif":"/api/poste"}]');
SELECT 'droits tableaux de poste : OK' AS statut;
