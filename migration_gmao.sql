-- ============================================================
-- NAIdo GMAO — Gestion de Maintenance Assistée par Ordinateur
-- Inspiré : EmacSah/GMAO-Suite-Odoo, wailammar99/gmao, LionelCoutinot/gmao
-- ============================================================

-- ── ÉQUIPEMENTS / PARC MACHINES ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    -- Localisation
    atelier_id INTEGER REFERENCES ateliers(id),
    localisation VARCHAR(200),
    -- Classification
    type_equipement VARCHAR(50) DEFAULT 'machine'
        CHECK (type_equipement IN ('machine','installation','vehicule','outillage','informatique','autre')),
    famille VARCHAR(100),
    criticite VARCHAR(20) DEFAULT 'normale'
        CHECK (criticite IN ('critique','importante','normale','faible')),
    -- Informations techniques
    marque VARCHAR(100),
    modele VARCHAR(100),
    numero_serie VARCHAR(100),
    puissance VARCHAR(50),
    tension VARCHAR(50),
    poids_kg NUMERIC(10,2),
    -- Dates
    date_acquisition DATE,
    date_mise_en_service DATE,
    date_fin_garantie DATE,
    duree_vie_ans INTEGER,
    -- Valeur
    valeur_acquisition NUMERIC(15,2) DEFAULT 0,
    valeur_actuelle NUMERIC(15,2) DEFAULT 0,
    -- Fournisseur
    fournisseur_id UUID REFERENCES fournisseurs(id),
    -- Documentation
    manuel_path VARCHAR(500),
    schema_path VARCHAR(500),
    -- Responsable
    responsable_id UUID REFERENCES utilisateurs(id),
    -- Compteurs
    compteur_heures NUMERIC(12,2) DEFAULT 0,
    compteur_cycles INTEGER DEFAULT 0,
    -- Statut
    statut VARCHAR(20) DEFAULT 'en_service'
        CHECK (statut IN ('en_service','en_panne','en_maintenance','hors_service','reforme')),
    actif BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PIÈCES DÉTACHÉES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pieces_detachees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    -- Classification
    famille VARCHAR(100),
    unite VARCHAR(20) DEFAULT 'pcs',
    -- Stock
    qte_stock INTEGER DEFAULT 0,
    qte_minimum INTEGER DEFAULT 0,
    qte_maximum INTEGER DEFAULT 100,
    -- Prix
    prix_unitaire NUMERIC(12,2) DEFAULT 0,
    -- Fournisseur préférentiel
    fournisseur_id UUID REFERENCES fournisseurs(id),
    reference_fournisseur VARCHAR(100),
    delai_livraison_jours INTEGER DEFAULT 7,
    -- Localisation stock
    emplacement_magasin VARCHAR(100),
    -- Compatibilité équipements
    equipements_compatibles JSONB DEFAULT '[]',
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PLAN DE MAINTENANCE PRÉVENTIVE ────────────────────────────
CREATE TABLE IF NOT EXISTS plans_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE,
    equipement_id UUID REFERENCES equipements(id) ON DELETE CASCADE,
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    type_maintenance VARCHAR(30) DEFAULT 'preventive'
        CHECK (type_maintenance IN ('preventive','predictive','conditionnelle')),
    -- Périodicité
    periodicite_type VARCHAR(20) DEFAULT 'jours'
        CHECK (periodicite_type IN ('jours','semaines','mois','heures','cycles')),
    periodicite_valeur INTEGER DEFAULT 30,
    -- Durée estimée
    duree_estimee_h NUMERIC(5,2) DEFAULT 1,
    -- Ressources
    technicien_id UUID REFERENCES utilisateurs(id),
    nb_techniciens INTEGER DEFAULT 1,
    -- Pièces nécessaires
    pieces_necessaires JSONB DEFAULT '[]',
    -- Checklist
    checklist JSONB DEFAULT '[]',
    -- Coût estimé
    cout_estime NUMERIC(12,2) DEFAULT 0,
    -- Prochaine échéance
    derniere_realisation DATE,
    prochaine_echeance DATE,
    -- Statut
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDRES DE TRAVAIL (OT) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordres_travail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_ot VARCHAR(30) UNIQUE,
    -- Type
    type_ot VARCHAR(20) NOT NULL DEFAULT 'curatif'
        CHECK (type_ot IN ('curatif','preventif','amelioratif','urgence')),
    -- Équipement
    equipement_id UUID REFERENCES equipements(id),
    plan_maintenance_id UUID REFERENCES plans_maintenance(id),
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    symptomes TEXT,
    -- Priorité
    priorite VARCHAR(20) DEFAULT 'normale'
        CHECK (priorite IN ('urgente','haute','normale','basse')),
    -- Planification
    date_demande TIMESTAMPTZ DEFAULT NOW(),
    date_planifiee DATE,
    date_debut_reel TIMESTAMPTZ,
    date_fin_reel TIMESTAMPTZ,
    -- Durée
    duree_estimee_h NUMERIC(5,2),
    duree_reelle_h NUMERIC(5,2),
    -- Équipe
    demandeur_id UUID REFERENCES utilisateurs(id),
    technicien_id UUID REFERENCES utilisateurs(id),
    -- Travaux réalisés
    travaux_realises TEXT,
    cause_panne TEXT,
    solution_appliquee TEXT,
    -- Pièces utilisées
    pieces_utilisees JSONB DEFAULT '[]',
    -- Coûts
    cout_main_oeuvre NUMERIC(12,2) DEFAULT 0,
    cout_pieces NUMERIC(12,2) DEFAULT 0,
    cout_total NUMERIC(12,2) DEFAULT 0,
    -- Statut workflow
    statut VARCHAR(20) DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert','planifie','en_cours','en_attente_pieces','termine','annule')),
    -- Arrêt machine
    arret_machine BOOLEAN DEFAULT false,
    duree_arret_h NUMERIC(5,2) DEFAULT 0,
    -- Notes
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-numérotation OT
CREATE SEQUENCE IF NOT EXISTS ot_seq START 1000;
CREATE OR REPLACE FUNCTION gen_numero_ot()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero_ot := 'OT-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('ot_seq')::TEXT,4,'0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_ot ON ordres_travail;
CREATE TRIGGER trg_numero_ot BEFORE INSERT ON ordres_travail
    FOR EACH ROW WHEN (NEW.numero_ot IS NULL) EXECUTE FUNCTION gen_numero_ot();

-- ── HISTORIQUE PANNES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historique_pannes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipement_id UUID REFERENCES equipements(id),
    ot_id UUID REFERENCES ordres_travail(id),
    date_panne TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_remise_service TIMESTAMPTZ,
    -- Description
    symptomes TEXT NOT NULL,
    cause TEXT,
    type_defaillance VARCHAR(50),
    -- Impact
    duree_arret_h NUMERIC(8,2) DEFAULT 0,
    cout_panne NUMERIC(12,2) DEFAULT 0,
    production_perdue NUMERIC(12,2) DEFAULT 0,
    -- Indicateurs
    mtbf_avant NUMERIC(10,2),  -- Mean Time Between Failures
    mttr NUMERIC(8,2),         -- Mean Time To Repair
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INTERVENTIONS EXTERNES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS interventions_externes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipement_id UUID REFERENCES equipements(id),
    ot_id UUID REFERENCES ordres_travail(id),
    fournisseur_id UUID REFERENCES fournisseurs(id),
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    -- Dates
    date_demande DATE,
    date_intervention DATE,
    date_fin DATE,
    -- Coût
    cout_ht NUMERIC(12,2) DEFAULT 0,
    cout_ttc NUMERIC(12,2) DEFAULT 0,
    numero_facture VARCHAR(100),
    -- Statut
    statut VARCHAR(20) DEFAULT 'demande'
        CHECK (statut IN ('demande','planifie','en_cours','termine','facture')),
    rapport TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── VUES GMAO ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW vue_gmao_dashboard AS
SELECT
    (SELECT COUNT(*) FROM equipements WHERE actif=true AND statut='en_service') AS equipements_en_service,
    (SELECT COUNT(*) FROM equipements WHERE actif=true AND statut='en_panne') AS equipements_en_panne,
    (SELECT COUNT(*) FROM equipements WHERE actif=true AND statut='en_maintenance') AS equipements_maintenance,
    (SELECT COUNT(*) FROM ordres_travail WHERE statut IN ('ouvert','planifie','en_cours')) AS ot_ouverts,
    (SELECT COUNT(*) FROM ordres_travail WHERE statut='urgence' OR (type_ot='urgence' AND statut NOT IN ('termine','annule'))) AS ot_urgents,
    (SELECT COUNT(*) FROM ordres_travail WHERE statut='en_attente_pieces') AS ot_attente_pieces,
    (SELECT COUNT(*) FROM plans_maintenance WHERE actif=true AND prochaine_echeance <= CURRENT_DATE + INTERVAL '7 days') AS maintenances_a_planifier,
    (SELECT COUNT(*) FROM pieces_detachees WHERE qte_stock <= qte_minimum AND actif=true) AS pieces_en_alerte,
    (SELECT COALESCE(SUM(cout_total),0) FROM ordres_travail WHERE EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM NOW()) AND statut='termine') AS cout_maintenance_annee;

-- Vue disponibilité machines
CREATE OR REPLACE VIEW vue_disponibilite_equipements AS
SELECT
    e.id, e.code, e.designation,
    e.statut, e.criticite,
    at.libelle AS atelier,
    COALESCE(e.compteur_heures,0) AS heures_fonctionnement,
    (SELECT COUNT(*) FROM ordres_travail ot WHERE ot.equipement_id=e.id AND ot.statut='termine') AS nb_interventions,
    (SELECT COALESCE(SUM(ot.duree_arret_h),0) FROM ordres_travail ot WHERE ot.equipement_id=e.id AND ot.arret_machine=true) AS total_heures_arret,
    (SELECT COALESCE(AVG(hp.duree_arret_h),0) FROM historique_pannes hp WHERE hp.equipement_id=e.id) AS mttr_moyen,
    (SELECT MAX(hp.date_panne) FROM historique_pannes hp WHERE hp.equipement_id=e.id) AS derniere_panne,
    (SELECT MIN(pm.prochaine_echeance) FROM plans_maintenance pm WHERE pm.equipement_id=e.id AND pm.actif=true) AS prochaine_maintenance
FROM equipements e
LEFT JOIN ateliers at ON at.id=e.atelier_id
WHERE e.actif=true
ORDER BY e.criticite DESC, e.designation;

SELECT 'Migration GMAO OK ✓' AS statut;
