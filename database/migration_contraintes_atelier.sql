-- NAIdo - contraintes alignees sur ce que l'application envoie reellement (idempotent : peut etre rejoue sans risque)

-- Causes d'arret proposees a l'operateur : l'ecran offre aussi "Fin de shift" (fin_shift), que la base refusait
ALTER TABLE "arrêts_machine" DROP CONSTRAINT IF EXISTS "arrêts_machine_cause_check";
ALTER TABLE "arrêts_machine" ADD CONSTRAINT "arrêts_machine_cause_check" CHECK (cause::text = ANY (ARRAY[
  'panne_mecanique', 'panne_electrique', 'changement_matiere', 'reglage', 'coupure_electricite', 'manque_personnel', 'fin_shift', 'autre']));

-- Statuts d'OF : la validation du reglage par OF (PATCH /api/of/:id/reglage) ecrit 'en_attente_operateur', que la base refusait
ALTER TABLE ordres_fabrication DROP CONSTRAINT IF EXISTS ordres_fabrication_statut_check;
ALTER TABLE ordres_fabrication ADD CONSTRAINT ordres_fabrication_statut_check CHECK (statut::text = ANY (ARRAY[
  'planifie', 'en_attente_regleur', 'en_attente_operateur', 'lance', 'en_cours', 'pause', 'termine', 'pret_livraison', 'annule']));

SELECT 'contraintes atelier : OK' AS statut;
