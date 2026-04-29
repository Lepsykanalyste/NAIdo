-- ============================================================
-- NAIdo QHSE v1 — 4 normes : ISO 9001, 14001, 45001, FSSC 22000
-- ============================================================

-- ── RÉFÉRENTIEL NORMES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS normes_qhse (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    libelle VARCHAR(200) NOT NULL,
    version VARCHAR(20),
    organisme VARCHAR(100),
    actif BOOLEAN DEFAULT true
);

INSERT INTO normes_qhse (code, libelle, version, organisme) VALUES
    ('ISO9001',   'Système de Management de la Qualité',              '2015', 'ISO'),
    ('ISO14001',  'Système de Management Environnemental',            '2015', 'ISO'),
    ('ISO45001',  'Système de Management SST',                        '2018', 'ISO'),
    ('FSSC22000', 'Sécurité des Denrées Alimentaires',               'v6',   'FSSC')
ON CONFLICT (code) DO NOTHING;

-- ── CARTOGRAPHIE DES PROCESSUS ────────────────────────────────
CREATE TABLE IF NOT EXISTS processus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    libelle VARCHAR(200) NOT NULL,
    type_processus VARCHAR(30) NOT NULL
        CHECK (type_processus IN ('management','realisation','support')),
    description TEXT,
    finalite TEXT,
    -- Pilotage
    pilote_id UUID REFERENCES utilisateurs(id),
    copilote_id UUID REFERENCES utilisateurs(id),
    -- Normes applicables (JSONB array de codes)
    normes_applicables JSONB DEFAULT '[]',
    -- Données entrée/sortie
    donnees_entree TEXT,
    donnees_sortie TEXT,
    -- Ressources
    ressources TEXT,
    -- Risques associés
    risques TEXT,
    -- Indicateurs clés (JSONB)
    indicateurs JSONB DEFAULT '[]',
    -- Statut
    statut VARCHAR(20) DEFAULT 'actif'
        CHECK (statut IN ('actif','revision','archive')),
    version VARCHAR(10) DEFAULT 'v1',
    date_creation DATE DEFAULT CURRENT_DATE,
    date_revision DATE,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions entre processus
CREATE TABLE IF NOT EXISTS interactions_processus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processus_source_id UUID REFERENCES processus(id) ON DELETE CASCADE,
    processus_dest_id UUID REFERENCES processus(id) ON DELETE CASCADE,
    description VARCHAR(255),
    UNIQUE(processus_source_id, processus_dest_id)
);

-- ── GESTION DOCUMENTAIRE (GED) ────────────────────────────────
CREATE TABLE IF NOT EXISTS documents_qhse (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    titre VARCHAR(255) NOT NULL,
    type_document VARCHAR(30) NOT NULL
        CHECK (type_document IN (
            'procedure','instruction','formulaire','enregistrement',
            'plan','manuel','specification','autre'
        )),
    processus_id UUID REFERENCES processus(id),
    normes_applicables JSONB DEFAULT '[]',
    -- Versioning
    version VARCHAR(10) DEFAULT 'v1',
    version_precedente_id UUID REFERENCES documents_qhse(id),
    -- Contenu
    description TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    -- Circuit de validation
    redacteur_id UUID REFERENCES utilisateurs(id),
    verificateur_id UUID REFERENCES utilisateurs(id),
    approbateur_id UUID REFERENCES utilisateurs(id),
    date_redaction DATE,
    date_verification DATE,
    date_approbation DATE,
    date_prochaine_revision DATE,
    -- Statut workflow
    statut VARCHAR(20) DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon','en_verification','en_approbation','approuve','obsolete','archive')),
    -- Diffusion
    diffusion_liste JSONB DEFAULT '[]',
    -- Métadonnées
    mots_cles TEXT,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NON-CONFORMITÉS (complet) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS non_conformites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_nc VARCHAR(30) UNIQUE,
    -- Source
    source VARCHAR(30) NOT NULL DEFAULT 'interne'
        CHECK (source IN ('interne','client','audit_interne','audit_externe','fournisseur','accident','inspection')),
    type_nc VARCHAR(30) DEFAULT 'qualite'
        CHECK (type_nc IN ('qualite','securite','environnement','alimentaire','reglementaire')),
    gravite VARCHAR(20) DEFAULT 'mineure'
        CHECK (gravite IN ('mineure','majeure','critique','observation')),
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    produit_concerne VARCHAR(200),
    lot_concerne VARCHAR(100),
    quantite_concernee NUMERIC(12,3),
    unite VARCHAR(20),
    -- Localisation
    processus_id UUID REFERENCES processus(id),
    atelier_id INTEGER REFERENCES ateliers(id),
    machine_id INTEGER REFERENCES machines(id),
    -- Dates
    date_detection DATE DEFAULT CURRENT_DATE,
    date_cloture DATE,
    delai_traitement_jours INTEGER DEFAULT 30,
    -- Détection
    detecteur_id UUID REFERENCES utilisateurs(id),
    responsable_traitement_id UUID REFERENCES utilisateurs(id),
    -- Analyse causes (5M, Ishikawa)
    cause_matiere TEXT,
    cause_milieu TEXT,
    cause_machine TEXT,
    cause_methode TEXT,
    cause_main_oeuvre TEXT,
    cause_mesure TEXT,
    cause_principale TEXT,
    -- Actions
    action_immediate TEXT,
    action_corrective TEXT,
    action_preventive TEXT,
    -- Vérification efficacité
    verification_efficacite TEXT,
    date_verification DATE,
    efficacite_confirmee BOOLEAN,
    -- Coûts
    cout_nc NUMERIC(12,2) DEFAULT 0,
    -- Normes
    normes_applicables JSONB DEFAULT '[]',
    -- IPR AMDEC
    gravite_score INTEGER DEFAULT 1,
    occurrence_score INTEGER DEFAULT 1,
    detectabilite_score INTEGER DEFAULT 1,
    ipr_amdec INTEGER GENERATED ALWAYS AS (gravite_score * occurrence_score * detectabilite_score) STORED,
    -- Statut workflow
    statut VARCHAR(20) DEFAULT 'ouverte'
        CHECK (statut IN ('ouverte','en_cours','en_verification','clos','annule')),
    -- Documents joints
    pieces_jointes JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-numérotation NC
CREATE SEQUENCE IF NOT EXISTS nc_seq START 1000;
CREATE OR REPLACE FUNCTION gen_numero_nc()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero_nc := 'NC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('nc_seq')::TEXT,4,'0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_nc ON non_conformites;
CREATE TRIGGER trg_numero_nc BEFORE INSERT ON non_conformites
    FOR EACH ROW WHEN (NEW.numero_nc IS NULL) EXECUTE FUNCTION gen_numero_nc();

-- ── PROGRAMME D'AUDITS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_audit VARCHAR(30) UNIQUE,
    titre VARCHAR(255) NOT NULL,
    type_audit VARCHAR(30) NOT NULL
        CHECK (type_audit IN ('interne','externe','fournisseur','certification','surveillance')),
    norme_auditee VARCHAR(20),
    -- Périmètre
    processus_audites JSONB DEFAULT '[]',
    ateliers_audites JSONB DEFAULT '[]',
    -- Équipe d'audit
    auditeur_chef_id UUID REFERENCES utilisateurs(id),
    auditeurs JSONB DEFAULT '[]',
    -- Planning
    date_planifiee DATE,
    date_realisation DATE,
    duree_jours NUMERIC(4,1) DEFAULT 1,
    -- Résultats
    nb_ecarts_majeurs INTEGER DEFAULT 0,
    nb_ecarts_mineurs INTEGER DEFAULT 0,
    nb_observations INTEGER DEFAULT 0,
    nb_points_forts INTEGER DEFAULT 0,
    conclusion TEXT,
    rapport_path VARCHAR(500),
    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie'
        CHECK (statut IN ('planifie','en_cours','realise','clos','annule')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS audit_seq START 100;
CREATE OR REPLACE FUNCTION gen_numero_audit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero_audit := 'AUD-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('audit_seq')::TEXT,3,'0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_audit ON audits;
CREATE TRIGGER trg_numero_audit BEFORE INSERT ON audits
    FOR EACH ROW WHEN (NEW.numero_audit IS NULL) EXECUTE FUNCTION gen_numero_audit();

-- Écarts d'audit
CREATE TABLE IF NOT EXISTS ecarts_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
    type_ecart VARCHAR(20) NOT NULL CHECK (type_ecart IN ('majeur','mineur','observation','point_fort')),
    processus_id UUID REFERENCES processus(id),
    norme_ref VARCHAR(50),
    description TEXT NOT NULL,
    exigence_ref VARCHAR(100),
    preuve TEXT,
    nc_id UUID REFERENCES non_conformites(id),
    statut VARCHAR(20) DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','clos')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RISQUES & OPPORTUNITÉS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS risques_opportunites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('risque','opportunite')),
    categorie VARCHAR(30) DEFAULT 'qualite'
        CHECK (categorie IN ('qualite','securite','environnement','alimentaire','strategique','operationnel')),
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    processus_id UUID REFERENCES processus(id),
    norme_ref VARCHAR(20),
    -- Cotation initiale
    probabilite INTEGER DEFAULT 1 CHECK (probabilite BETWEEN 1 AND 5),
    gravite INTEGER DEFAULT 1 CHECK (gravite BETWEEN 1 AND 5),
    detectabilite INTEGER DEFAULT 1 CHECK (detectabilite BETWEEN 1 AND 5),
    criticite INTEGER GENERATED ALWAYS AS (probabilite * gravite) STORED,
    ipr INTEGER GENERATED ALWAYS AS (probabilite * gravite * detectabilite) STORED,
    -- Traitement
    plan_traitement TEXT,
    responsable_id UUID REFERENCES utilisateurs(id),
    date_echeance DATE,
    -- Cotation résiduelle (après traitement)
    probabilite_residuelle INTEGER DEFAULT 1,
    gravite_residuelle INTEGER DEFAULT 1,
    criticite_residuelle INTEGER,
    -- Statut
    statut VARCHAR(20) DEFAULT 'identifie'
        CHECK (statut IN ('identifie','en_traitement','traite','accepte','surveille')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── FORMATION & HABILITATIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS formations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    type_formation VARCHAR(30) DEFAULT 'interne'
        CHECK (type_formation IN ('interne','externe','e_learning','habilitation','recyclage')),
    norme_associee VARCHAR(20),
    -- Contenu
    objectifs TEXT,
    contenu TEXT,
    duree_heures NUMERIC(5,1),
    -- Organisation
    formateur VARCHAR(200),
    organisme_formation VARCHAR(200),
    lieu VARCHAR(200),
    -- Dates
    date_planifiee DATE,
    date_realisation DATE,
    date_prochaine_session DATE,
    validite_mois INTEGER DEFAULT 12,
    -- Participants
    participants JSONB DEFAULT '[]',
    -- Documents
    support_path VARCHAR(500),
    attestation_path VARCHAR(500),
    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie'
        CHECK (statut IN ('planifie','realise','annule')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitations individuelles
CREATE TABLE IF NOT EXISTS habilitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type_habilitation VARCHAR(100) NOT NULL,
    numero VARCHAR(100),
    organisme_delivrant VARCHAR(200),
    date_obtention DATE,
    date_expiration DATE,
    statut VARCHAR(20) DEFAULT 'valide'
        CHECK (statut IN ('valide','expire','suspendu','en_cours')),
    document_path VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASPECTS ENVIRONNEMENTAUX (ISO 14001) ──────────────────────
CREATE TABLE IF NOT EXISTS aspects_environnementaux (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processus_id UUID REFERENCES processus(id),
    activite VARCHAR(255) NOT NULL,
    aspect VARCHAR(255) NOT NULL,
    impact VARCHAR(255) NOT NULL,
    condition VARCHAR(20) DEFAULT 'normale'
        CHECK (condition IN ('normale','anormale','urgence')),
    -- Cotation
    frequence INTEGER DEFAULT 1 CHECK (frequence BETWEEN 1 AND 5),
    gravite_env INTEGER DEFAULT 1 CHECK (gravite_env BETWEEN 1 AND 5),
    maitrise INTEGER DEFAULT 1 CHECK (maitrise BETWEEN 1 AND 5),
    significatif BOOLEAN DEFAULT false,
    -- Traitement
    mesure_maitrise TEXT,
    objectif_env TEXT,
    responsable_id UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACCIDENTS / INCIDENTS SST (ISO 45001) ─────────────────────
CREATE TABLE IF NOT EXISTS accidents_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(30) UNIQUE,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('accident','incident','presqu_accident','maladie_pro','danger_grave')),
    gravite_sst VARCHAR(20) DEFAULT 'leger'
        CHECK (gravite_sst IN ('leger','moyen','grave','mortel','sans_arret')),
    -- Description
    titre VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    -- Lieu & personnes
    atelier_id INTEGER REFERENCES ateliers(id),
    machine_id INTEGER REFERENCES machines(id),
    victime_nom VARCHAR(200),
    victime_id UUID REFERENCES utilisateurs(id),
    temoins TEXT,
    -- Dates
    date_accident TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    heure_accident TIME,
    date_reprise_travail DATE,
    nb_jours_arret INTEGER DEFAULT 0,
    -- Analyse
    cause_immediate TEXT,
    cause_profonde TEXT,
    facteurs_aggravants TEXT,
    -- Actions
    action_immediate TEXT,
    action_corrective TEXT,
    -- Déclaration
    declare_inspection BOOLEAN DEFAULT false,
    date_declaration DATE,
    -- Coût
    cout_estime NUMERIC(12,2) DEFAULT 0,
    -- Statut
    statut VARCHAR(20) DEFAULT 'ouvert'
        CHECK (statut IN ('ouvert','en_cours','clos')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS accident_seq START 100;
CREATE OR REPLACE FUNCTION gen_numero_accident()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero := 'ACC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('accident_seq')::TEXT,3,'0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_accident ON accidents_incidents;
CREATE TRIGGER trg_numero_accident BEFORE INSERT ON accidents_incidents
    FOR EACH ROW WHEN (NEW.numero IS NULL) EXECUTE FUNCTION gen_numero_accident();

-- ── INDICATEURS QHSE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indicateurs_qhse (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    processus_id UUID REFERENCES processus(id),
    norme_associee VARCHAR(20),
    -- Définition
    formule TEXT,
    unite VARCHAR(50),
    frequence_mesure VARCHAR(20) DEFAULT 'mensuel'
        CHECK (frequence_mesure IN ('journalier','hebdo','mensuel','trimestriel','annuel')),
    -- Objectifs
    objectif_valeur NUMERIC(12,4),
    seuil_alerte NUMERIC(12,4),
    sens VARCHAR(10) DEFAULT 'hausse' CHECK (sens IN ('hausse','baisse')),
    -- Responsable
    responsable_id UUID REFERENCES utilisateurs(id),
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valeurs des indicateurs (historique)
CREATE TABLE IF NOT EXISTS valeurs_indicateurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicateur_id UUID REFERENCES indicateurs_qhse(id) ON DELETE CASCADE,
    periode DATE NOT NULL,
    valeur NUMERIC(12,4) NOT NULL,
    commentaire TEXT,
    saisi_par UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── VUES UTILES ───────────────────────────────────────────────
CREATE OR REPLACE VIEW vue_qhse_dashboard AS
SELECT
    (SELECT COUNT(*) FROM non_conformites WHERE statut != 'clos') AS nc_ouvertes,
    (SELECT COUNT(*) FROM non_conformites WHERE gravite = 'critique' AND statut != 'clos') AS nc_critiques,
    (SELECT COUNT(*) FROM audits WHERE statut = 'planifie' AND date_planifiee >= CURRENT_DATE) AS audits_planifies,
    (SELECT COUNT(*) FROM risques_opportunites WHERE criticite >= 12 AND statut != 'traite') AS risques_eleves,
    (SELECT COUNT(*) FROM habilitations WHERE date_expiration <= CURRENT_DATE + INTERVAL '30 days' AND statut = 'valide') AS habilitations_expiration,
    (SELECT COUNT(*) FROM accidents_incidents WHERE EXTRACT(YEAR FROM date_accident) = EXTRACT(YEAR FROM NOW())) AS accidents_annee,
    (SELECT COUNT(*) FROM documents_qhse WHERE date_prochaine_revision <= CURRENT_DATE + INTERVAL '30 days' AND statut = 'approuve') AS docs_revision,
    (SELECT COUNT(*) FROM processus WHERE actif = true) AS nb_processus;

SELECT 'Migration QHSE OK ✓' AS statut;
