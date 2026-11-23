-- NAIdo - Lot 6 : maintenance rattachee aux OF, cout de revient par OF. Idempotent.
ALTER TABLE ordres_travail ADD COLUMN IF NOT EXISTS of_id UUID REFERENCES ordres_fabrication(id);
ALTER TABLE demandes_achat ADD COLUMN IF NOT EXISTS ot_id UUID REFERENCES ordres_travail(id);
INSERT INTO parametres_systeme (cle, valeur, type_valeur, description, modifiable_par)
VALUES ('taux_horaire_machine_fcfa', '0', 'nombre', 'Cout horaire machine (FCFA/heure) pour le cout de revient par OF', 'directeur')
ON CONFLICT (cle) DO NOTHING;
INSERT INTO libelles_frais (libelle)
SELECT 'Maintenance machines' WHERE NOT EXISTS (SELECT 1 FROM libelles_frais WHERE lower(btrim(libelle)) = 'maintenance machines');
SELECT 'lot 6 cout OF : OK' AS statut;
