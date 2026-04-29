-- ============================================================
-- NAIdo RH Complet — Employés, Contrats, Congés, Paie
-- ============================================================

-- POSTES / FONCTIONS
CREATE TABLE IF NOT EXISTS postes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    intitule VARCHAR(200) NOT NULL,
    departement VARCHAR(100),
    niveau VARCHAR(50),
    description TEXT,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYÉS
CREATE TABLE IF NOT EXISTS employes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricule VARCHAR(30) UNIQUE NOT NULL,
    -- Identité
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE,
    lieu_naissance VARCHAR(200),
    nationalite VARCHAR(100) DEFAULT 'Ivoirienne',
    sexe VARCHAR(10) CHECK (sexe IN ('M','F')),
    situation_familiale VARCHAR(20) CHECK (situation_familiale IN ('celibataire','marie','divorce','veuf')),
    nb_enfants INTEGER DEFAULT 0,
    -- Contact
    telephone VARCHAR(50),
    telephone2 VARCHAR(50),
    email VARCHAR(100),
    adresse TEXT,
    ville VARCHAR(100),
    -- Identification
    num_cni VARCHAR(50),
    num_cnps VARCHAR(50),
    num_passport VARCHAR(50),
    -- Poste
    poste_id INTEGER REFERENCES postes(id),
    atelier_id INTEGER REFERENCES ateliers(id),
    responsable_id UUID REFERENCES employes(id),
    -- Dates
    date_embauche DATE,
    date_fin_contrat DATE,
    -- Compte utilisateur lié
    user_id UUID REFERENCES utilisateurs(id),
    -- Photo
    photo_path VARCHAR(500),
    -- Statut
    statut VARCHAR(20) DEFAULT 'actif'
        CHECK (statut IN ('actif','conge','suspendu','demissionne','licencie','retraite')),
    actif BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-matricule
CREATE SEQUENCE IF NOT EXISTS matricule_seq START 1000;
CREATE OR REPLACE FUNCTION gen_matricule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.matricule IS NULL OR NEW.matricule = '' THEN
        NEW.matricule := 'NAI-' || LPAD(nextval('matricule_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_matricule ON employes;
CREATE TRIGGER trg_matricule BEFORE INSERT ON employes
    FOR EACH ROW EXECUTE FUNCTION gen_matricule();

-- CONTRATS
CREATE TABLE IF NOT EXISTS contrats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id) ON DELETE CASCADE,
    type_contrat VARCHAR(20) NOT NULL
        CHECK (type_contrat IN ('CDI','CDD','Stage','Apprentissage','Interim','Prestation')),
    date_debut DATE NOT NULL,
    date_fin DATE,
    duree_mois INTEGER,
    -- Rémunération
    salaire_base NUMERIC(12,2) DEFAULT 0,
    devise VARCHAR(10) DEFAULT 'FCFA',
    -- Conditions
    temps_travail VARCHAR(20) DEFAULT 'plein'
        CHECK (temps_travail IN ('plein','partiel','mi_temps')),
    heures_semaine NUMERIC(5,2) DEFAULT 40,
    -- Période d'essai
    periode_essai_mois INTEGER DEFAULT 0,
    date_fin_essai DATE,
    -- Avantages
    prime_transport NUMERIC(10,2) DEFAULT 0,
    prime_logement NUMERIC(10,2) DEFAULT 0,
    autres_avantages TEXT,
    -- Document
    contrat_path VARCHAR(500),
    -- Statut
    statut VARCHAR(20) DEFAULT 'actif'
        CHECK (statut IN ('actif','expire','resilie','suspendu')),
    motif_fin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONGÉS
CREATE TABLE IF NOT EXISTS conges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id) ON DELETE CASCADE,
    type_conge VARCHAR(30) NOT NULL
        CHECK (type_conge IN ('annuel','maladie','maternite','paternite','sans_solde','exceptionnel','recuperation')),
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    nb_jours INTEGER NOT NULL,
    motif TEXT,
    -- Validation
    statut VARCHAR(20) DEFAULT 'en_attente'
        CHECK (statut IN ('en_attente','approuve','refuse','annule')),
    valideur_id UUID REFERENCES employes(id),
    date_validation TIMESTAMPTZ,
    commentaire_valideur TEXT,
    -- Document
    justificatif_path VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOLDES DE CONGÉS
CREATE TABLE IF NOT EXISTS soldes_conges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id) ON DELETE CASCADE,
    annee INTEGER NOT NULL,
    jours_acquis NUMERIC(5,1) DEFAULT 0,
    jours_pris NUMERIC(5,1) DEFAULT 0,
    jours_restants NUMERIC(5,1) GENERATED ALWAYS AS (jours_acquis - jours_pris) STORED,
    UNIQUE(employe_id, annee)
);

-- PAIE
CREATE TABLE IF NOT EXISTS bulletins_paie (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id),
    periode DATE NOT NULL,  -- Premier jour du mois
    -- Salaire de base
    salaire_base NUMERIC(12,2) DEFAULT 0,
    -- Primes et indemnités
    prime_transport NUMERIC(10,2) DEFAULT 0,
    prime_logement NUMERIC(10,2) DEFAULT 0,
    prime_performance NUMERIC(10,2) DEFAULT 0,
    prime_anciennete NUMERIC(10,2) DEFAULT 0,
    autres_primes NUMERIC(10,2) DEFAULT 0,
    -- Heures supplémentaires
    heures_supp NUMERIC(5,2) DEFAULT 0,
    taux_heures_supp NUMERIC(10,2) DEFAULT 0,
    montant_heures_supp NUMERIC(10,2) DEFAULT 0,
    -- Brut
    salaire_brut NUMERIC(12,2) DEFAULT 0,
    -- Cotisations salariales
    cotisation_cnps NUMERIC(10,2) DEFAULT 0,
    impot_sur_salaire NUMERIC(10,2) DEFAULT 0,
    autres_retenues NUMERIC(10,2) DEFAULT 0,
    -- Net
    salaire_net NUMERIC(12,2) DEFAULT 0,
    -- Cotisations patronales
    cotisation_patronale NUMERIC(10,2) DEFAULT 0,
    -- Paiement
    date_paiement DATE,
    mode_paiement VARCHAR(20) DEFAULT 'virement',
    reference_paiement VARCHAR(100),
    -- Document
    bulletin_path VARCHAR(500),
    -- Statut
    statut VARCHAR(20) DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon','valide','paye')),
    cree_par UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employe_id, periode)
);

-- PRÉSENCES / POINTAGE
CREATE TABLE IF NOT EXISTS presences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id) ON DELETE CASCADE,
    date_presence DATE NOT NULL,
    heure_entree TIME,
    heure_sortie TIME,
    heures_travaillees NUMERIC(5,2),
    heures_supp NUMERIC(5,2) DEFAULT 0,
    type_presence VARCHAR(20) DEFAULT 'present'
        CHECK (type_presence IN ('present','absent','conge','maladie','mission','ferie')),
    notes TEXT,
    saisi_par UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employe_id, date_presence)
);

-- FORMATIONS RH (liées aux habilitations QHSE)
CREATE TABLE IF NOT EXISTS plan_formation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre VARCHAR(255) NOT NULL,
    type_formation VARCHAR(30) DEFAULT 'interne',
    organisme VARCHAR(200),
    date_debut DATE,
    date_fin DATE,
    duree_heures NUMERIC(5,1),
    cout NUMERIC(12,2) DEFAULT 0,
    lieu VARCHAR(200),
    objectifs TEXT,
    -- Participants
    participants JSONB DEFAULT '[]',
    nb_participants INTEGER DEFAULT 0,
    -- Statut
    statut VARCHAR(20) DEFAULT 'planifie'
        CHECK (statut IN ('planifie','en_cours','realise','annule')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÉVALUATIONS
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employe_id UUID REFERENCES employes(id),
    evaluateur_id UUID REFERENCES employes(id),
    periode VARCHAR(20),  -- Ex: "2026-S1"
    date_evaluation DATE DEFAULT CURRENT_DATE,
    -- Critères (notes /5)
    note_qualite_travail NUMERIC(3,1),
    note_productivite NUMERIC(3,1),
    note_ponctualite NUMERIC(3,1),
    note_esprit_equipe NUMERIC(3,1),
    note_initiative NUMERIC(3,1),
    note_securite NUMERIC(3,1),
    note_globale NUMERIC(3,1),
    -- Commentaires
    points_forts TEXT,
    axes_amelioration TEXT,
    objectifs_prochaine_periode TEXT,
    commentaire_employe TEXT,
    -- Statut
    statut VARCHAR(20) DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon','signe_evaluateur','signe_employe','valide')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VUES UTILES RH
CREATE OR REPLACE VIEW vue_effectifs AS
SELECT
    e.id, e.matricule, e.nom, e.prenom,
    e.statut, e.date_embauche, e.sexe,
    p.intitule AS poste,
    p.departement,
    at.libelle AS atelier,
    c.type_contrat, c.salaire_base, c.date_fin AS fin_contrat,
    sc.jours_restants AS solde_conges,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_embauche))::INTEGER AS anciennete_ans
FROM employes e
LEFT JOIN postes p ON p.id = e.poste_id
LEFT JOIN ateliers at ON at.id = e.atelier_id
LEFT JOIN contrats c ON c.employe_id = e.id AND c.statut = 'actif'
LEFT JOIN soldes_conges sc ON sc.employe_id = e.id AND sc.annee = EXTRACT(YEAR FROM NOW())
WHERE e.actif = true;

CREATE OR REPLACE VIEW vue_rh_dashboard AS
SELECT
    (SELECT COUNT(*) FROM employes WHERE actif=true AND statut='actif') AS nb_employes,
    (SELECT COUNT(*) FROM employes WHERE actif=true AND sexe='M') AS nb_hommes,
    (SELECT COUNT(*) FROM employes WHERE actif=true AND sexe='F') AS nb_femmes,
    (SELECT COUNT(*) FROM contrats WHERE statut='actif' AND type_contrat='CDI') AS nb_cdi,
    (SELECT COUNT(*) FROM contrats WHERE statut='actif' AND type_contrat='CDD') AS nb_cdd,
    (SELECT COUNT(*) FROM conges WHERE statut='en_attente') AS conges_en_attente,
    (SELECT COUNT(*) FROM contrats WHERE date_fin <= CURRENT_DATE + INTERVAL '30 days' AND statut='actif') AS contrats_expiration,
    (SELECT COALESCE(SUM(salaire_net),0) FROM bulletins_paie WHERE periode = DATE_TRUNC('month', CURRENT_DATE) AND statut='paye') AS masse_salariale_mois;

SELECT 'Migration RH OK ✓' AS statut;
