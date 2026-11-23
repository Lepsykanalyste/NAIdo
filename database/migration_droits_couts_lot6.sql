-- NAIdo - Lot 6 : droits du cout de revient et de la maintenance rattachee aux OF. Idempotent.
UPDATE politique_acces
SET contenu = jsonb_set(contenu, '{regles}', (contenu->'regles') || jsonb_build_array(jsonb_build_object(
      'motif', '/api/couts-of',
      'lecture', jsonb_build_array('directeur','super_admin','chef_atelier','achat','comptable','technicien'),
      'ecriture', jsonb_build_array('directeur','super_admin','chef_atelier','achat','technicien'))))
WHERE id = 1 AND NOT (contenu->'regles' @> '[{"motif":"/api/couts-of"}]');
SELECT 'droits cout OF : OK' AS statut;
