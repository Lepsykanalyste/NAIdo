-- ============================================================
-- NAIdo v3.1 — Migration améliorations
-- ============================================================

-- 1. Équipement : puissance en kW numérique
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS puissance_kw NUMERIC(10,3) DEFAULT 0;
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS facteur_puissance NUMERIC(4,3) DEFAULT 0.85;
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS tension_v NUMERIC(8,1);
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS intensite_a NUMERIC(8,2);

-- 2. Articles : machines associées + données production
ALTER TABLE articles ADD COLUMN IF NOT EXISTS machines_ids JSONB DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temps_cycle_min NUMERIC(8,3);    -- Temps cycle standard (minutes)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cadence_heure INTEGER;            -- Pièces/heure standard
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temps_reglage_min NUMERIC(8,1) DEFAULT 30;  -- Temps réglage
ALTER TABLE articles ADD COLUMN IF NOT EXISTS conso_mp_kg NUMERIC(10,4);       -- Consommation MP par pièce (kg)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_piece_kg NUMERIC(10,4);    -- Poids pièce finie
ALTER TABLE articles ADD COLUMN IF NOT EXISTS taux_rebut_std NUMERIC(5,2) DEFAULT 2.0;  -- % rebut standard

-- 3. Comptes : roles et permissions enrichis
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS role_details JSONB DEFAULT '{}';
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS atelier_id INTEGER REFERENCES ateliers(id);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500);

-- 4. Dashboard AT3 : vue dédiée production
CREATE OR REPLACE VIEW vue_dashboard_at3 AS
SELECT
    -- Production du jour
    (SELECT COUNT(*) FROM sessions_production sp
     JOIN machines m ON m.id=sp.machine_id
     JOIN ateliers at ON at.id=m.atelier_id
     WHERE at.code='AT3' AND DATE(sp.date_debut)=CURRENT_DATE) AS sessions_jour,
    -- TRS AT3
    (SELECT COALESCE(AVG(
        CASE WHEN sp.temps_total_min > 0
             THEN (sp.quantite_conforme::float / NULLIF(sp.cadence_theorique * sp.temps_total_min / 60.0, 0)) * 100
             ELSE 0 END
    ), 0) FROM sessions_production sp
     JOIN machines m ON m.id=sp.machine_id
     JOIN ateliers at ON at.id=m.atelier_id
     WHERE at.code='AT3' AND DATE(sp.date_debut)=CURRENT_DATE) AS trs_at3_jour,
    -- Machines actives AT3
    (SELECT COUNT(*) FROM machines m
     JOIN ateliers at ON at.id=m.atelier_id
     WHERE at.code='AT3' AND m.statut='en_cours') AS machines_actives_at3,
    -- Pannes AT3
    (SELECT COUNT(*) FROM machines m
     JOIN ateliers at ON at.id=m.atelier_id
     WHERE at.code='AT3' AND m.statut='en_panne') AS pannes_at3,
    -- OF en cours AT3
    (SELECT COUNT(*) FROM ordres_fabrication of2
     WHERE of2.statut IN ('en_cours','lance')
     AND EXISTS (SELECT 1 FROM machines m JOIN ateliers at ON at.id=m.atelier_id
                 WHERE m.id=of2.machine_id AND at.code='AT3')) AS of_en_cours_at3;

-- 5. Vue dashboard général NAI
CREATE OR REPLACE VIEW vue_dashboard_general AS
SELECT
    (SELECT COUNT(*) FROM employes WHERE actif=true AND statut='actif') AS effectif_total,
    (SELECT COUNT(*) FROM ordres_fabrication WHERE statut IN ('en_cours','lance')) AS of_actifs,
    (SELECT COUNT(*) FROM machines WHERE statut='en_panne') AS machines_en_panne,
    (SELECT COUNT(*) FROM non_conformites WHERE statut NOT IN ('clos','annule')) AS nc_ouvertes,
    (SELECT COUNT(*) FROM ordres_travail WHERE statut IN ('ouvert','en_cours','planifie')) AS ot_gmao_ouverts,
    (SELECT COALESCE(SUM(sa.valeur_stock),0) FROM stock_articles sa) AS valeur_stock_total,
    (SELECT COUNT(*) FROM conges WHERE statut='en_attente') AS conges_en_attente,
    (SELECT COUNT(*) FROM habilitations WHERE date_expiration <= CURRENT_DATE + INTERVAL '30 days' AND statut='valide') AS habilitations_expiration;

SELECT 'Migration v3.1 OK ✓' AS statut;

-- Colonnes articles production (si manquantes)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cadence_heure INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temps_cycle_min NUMERIC(8,3);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temps_reglage_min NUMERIC(8,1) DEFAULT 30;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS conso_mp_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_piece_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS taux_rebut_std NUMERIC(5,2) DEFAULT 2.0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS machines_ids JSONB DEFAULT '[]';

-- Colonnes équipements énergie
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS puissance_kw NUMERIC(10,3) DEFAULT 0;
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS facteur_puissance NUMERIC(4,3) DEFAULT 0.85;
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS tension_v NUMERIC(8,1);
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS intensite_a NUMERIC(8,2);

SELECT 'Migration articles+équipements OK' AS statut;
