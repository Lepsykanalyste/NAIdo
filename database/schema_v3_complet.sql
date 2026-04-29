-- ============================================================
-- NAIdo v3 — Schéma SQL Complet
-- ERP/MES Industriel Multi-Ateliers · ISO · Alimentaire
-- Créé par SOPHOPSY pour Green Industry
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- 1. TABLES DE RÉFÉRENTIEL
-- ============================================================

-- Unités de mesure
CREATE TABLE unites_mesure (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'masse' CHECK (type IN ('masse','volume','longueur','surface','piece','temps')),
  actif BOOLEAN DEFAULT true
);
INSERT INTO unites_mesure (code, libelle, type) VALUES
  ('KG','Kilogramme','masse'),('G','Gramme','masse'),('T','Tonne','masse'),
  ('L','Litre','volume'),('M3','Mètre cube','volume'),
  ('M','Mètre','longueur'),('CM','Centimètre','longueur'),('MM','Millimètre','longueur'),
  ('M2','Mètre carré','surface'),
  ('PC','Pièce','piece'),('SAC','Sac','piece'),('BOB','Bobine','piece'),('CARTON','Carton','piece'),
  ('H','Heure','temps'),('MIN','Minute','temps');

-- Familles articles
CREATE TABLE familles_articles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT true
);
INSERT INTO familles_articles (code, libelle) VALUES
  ('PF','Produits Finis'),('MP','Matières Premières'),
  ('SF','Semi-Finis'),('EMBAL','Emballages'),
  ('CONSO','Consommables'),('PIECE','Pièces détachées'),('OUTIL','Outillage');

-- Sous-familles
CREATE TABLE sous_familles_articles (
  id SERIAL PRIMARY KEY,
  famille_id INTEGER REFERENCES familles_articles(id),
  code VARCHAR(30) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  actif BOOLEAN DEFAULT true
);
INSERT INTO sous_familles_articles (famille_id, code, libelle) VALUES
  (1,'SAC-IND','Sac industriel'),(1,'SAC-ALIM','Sac alimentaire'),
  (1,'SAC-AGRI','Sac agricole'),(2,'GRAN','Granulés plastique'),
  (2,'COLORANT','Colorants'),(2,'ADDITIF','Additifs');

-- Catégories
CREATE TABLE categories_articles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  actif BOOLEAN DEFAULT true
);
INSERT INTO categories_articles (code, libelle) VALUES
  ('STD','Standard'),('CUSTOM','Sur mesure'),
  ('IMPORT','Importé'),('LOCAL','Production locale');

-- Ateliers / Services
CREATE TABLE ateliers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  type VARCHAR(30) DEFAULT 'production'
    CHECK (type IN ('production','technique','mecanique','achat','vente','transit','qhse','magasin','direction','rh')),
  responsable_id UUID,
  localisation VARCHAR(100),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO ateliers (code, libelle, type) VALUES
  ('AT3','Atelier 3 — Production','production'),
  ('MECA','Atelier Mécanique','mecanique'),
  ('TECH','Atelier Technique','technique'),
  ('ACHAT','Service Achat','achat'),
  ('VENTE','Service Vente','vente'),
  ('TRANSIT','Service Transit','transit'),
  ('QHSE','Service QHSE','qhse'),
  ('MAG','Magasin Central','magasin'),
  ('DIR','Direction','direction'),
  ('RH','Ressources Humaines','rh');

-- Emplacements stock (liés aux ateliers)
CREATE TABLE emplacements_stock (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  atelier_id INTEGER REFERENCES ateliers(id),
  type VARCHAR(30) DEFAULT 'stockage'
    CHECK (type IN ('stockage','production','reception','expedition','quarantaine','rebut')),
  capacite_max_kg NUMERIC(12,2),
  actif BOOLEAN DEFAULT true
);
INSERT INTO emplacements_stock (code, libelle, atelier_id, type) VALUES
  ('MAG-MP','Dépôt Matières Premières',8,'reception'),
  ('MAG-PF','Dépôt Produits Finis',8,'stockage'),
  ('AT3-PROD','Zone Production AT3',1,'production'),
  ('AT3-REBUT','Zone Rebut AT3',1,'rebut'),
  ('MAG-QUARAN','Zone Quarantaine',8,'quarantaine'),
  ('MAG-EXPED','Zone Expédition',8,'expedition');

-- ============================================================
-- 2. TABLE ARTICLES (FICHE TECHNIQUE COMPLÈTE)
-- ============================================================

CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identification
  code VARCHAR(50) UNIQUE NOT NULL,
  code_barre VARCHAR(100),
  qr_code_contenu TEXT,
  designation VARCHAR(255) NOT NULL,
  designation_fr VARCHAR(255),
  designation_ar VARCHAR(255),
  -- Classification
  famille_id INTEGER REFERENCES familles_articles(id),
  sous_famille_id INTEGER REFERENCES sous_familles_articles(id),
  categorie_id INTEGER REFERENCES categories_articles(id),
  -- Unités
  unite_mesure_id INTEGER REFERENCES unites_mesure(id),
  unite_mesure_achat_id INTEGER REFERENCES unites_mesure(id),
  unite_mesure_vente_id INTEGER REFERENCES unites_mesure(id),
  -- Dimensions & Poids
  longueur_mm NUMERIC(10,2),
  largeur_mm NUMERIC(10,2),
  hauteur_mm NUMERIC(10,2),
  dimensions_libelle VARCHAR(100),
  poids_theorique_kg NUMERIC(10,4),
  poids_reel_kg NUMERIC(10,4),
  poids_tare_kg NUMERIC(10,4),
  poids_mandrin_kg NUMERIC(10,4) DEFAULT 0,
  -- Caractéristiques production
  couleur VARCHAR(100),
  matiere VARCHAR(100),
  epaisseur_mm NUMERIC(8,3),
  cadence_theorique_kg_h NUMERIC(10,2),
  temps_reglage_min INTEGER DEFAULT 30,
  -- Prix
  prix_achat NUMERIC(12,4) DEFAULT 0,
  prix_vente NUMERIC(12,4) DEFAULT 0,
  prix_cession_interne NUMERIC(12,4) DEFAULT 0,
  devise VARCHAR(10) DEFAULT 'DZD',
  -- Stock
  stock_mini NUMERIC(12,3) DEFAULT 0,
  stock_maxi NUMERIC(12,3),
  stock_securite NUMERIC(12,3) DEFAULT 0,
  delai_appro_jours INTEGER DEFAULT 0,
  -- Alimentaire / ISO
  dlc_jours INTEGER,
  dluo_jours INTEGER,
  temperature_stockage_min NUMERIC(5,2),
  temperature_stockage_max NUMERIC(5,2),
  allergenes TEXT,
  points_ccp BOOLEAN DEFAULT false,
  description_ccp TEXT,
  tracabilite_type VARCHAR(20) DEFAULT 'lot' CHECK (tracabilite_type IN ('lot','serie','aucune')),
  -- Paramètres production
  type_article VARCHAR(20) DEFAULT 'produit_fini'
    CHECK (type_article IN ('produit_fini','matiere_premiere','semi_fini','emballage','consommable','piece_detachee')),
  -- Documents
  fiche_technique_path VARCHAR(255),
  plan_path VARCHAR(255),
  photo_path VARCHAR(255),
  normes_iso TEXT,
  -- Statut
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients (liés aux articles via commandes)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  raison_sociale VARCHAR(200) NOT NULL,
  type VARCHAR(20) DEFAULT 'client' CHECK (type IN ('client','fournisseur','les_deux')),
  adresse TEXT,
  ville VARCHAR(100),
  pays VARCHAR(100) DEFAULT 'Algérie',
  telephone VARCHAR(50),
  email VARCHAR(100),
  contact_principal VARCHAR(100),
  credit_limite NUMERIC(15,2) DEFAULT 0,
  delai_paiement_jours INTEGER DEFAULT 30,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. STOCK MULTI-DÉPÔTS
-- ============================================================

CREATE TABLE stock_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id),
  emplacement_id INTEGER REFERENCES emplacements_stock(id),
  qte_disponible NUMERIC(15,3) DEFAULT 0,
  qte_reservee NUMERIC(15,3) DEFAULT 0,
  qte_en_commande NUMERIC(15,3) DEFAULT 0,
  valeur_stock NUMERIC(15,4) DEFAULT 0,
  derniere_entree TIMESTAMPTZ,
  derniere_sortie TIMESTAMPTZ,
  UNIQUE(article_id, emplacement_id)
);

CREATE TABLE lots_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id),
  emplacement_id INTEGER REFERENCES emplacements_stock(id),
  numero_lot VARCHAR(80) UNIQUE NOT NULL,
  numero_serie VARCHAR(80),
  fournisseur_id UUID REFERENCES clients(id),
  date_reception DATE DEFAULT CURRENT_DATE,
  date_fabrication DATE,
  date_dlc DATE,
  date_dluo DATE,
  qte_initiale NUMERIC(15,3) NOT NULL,
  qte_disponible NUMERIC(15,3) NOT NULL,
  prix_unitaire NUMERIC(12,4) DEFAULT 0,
  certificat_path VARCHAR(255),
  statut VARCHAR(20) DEFAULT 'disponible'
    CHECK (statut IN ('disponible','quarantaine','bloque','perime','epuise')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. MOUVEMENTS DE STOCK & BONS DE CESSION
-- ============================================================

CREATE SEQUENCE mouvement_seq START 1000;

CREATE TABLE mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_bon VARCHAR(30) UNIQUE NOT NULL,
  type_mouvement VARCHAR(30) NOT NULL
    CHECK (type_mouvement IN (
      'cession_atelier',    -- Atelier → Magasin central
      'livraison_mp',       -- Magasin → Atelier (matière première)
      'livraison_pf_interne',-- Atelier → Atelier (produit fini interne)
      'reception_achat',    -- Fournisseur → Magasin
      'expedition_vente',   -- Magasin → Client
      'retour_atelier',     -- Atelier → Magasin (retour)
      'ajustement_positif', -- Inventaire +
      'ajustement_negatif', -- Inventaire -
      'production',         -- Saisie production (entrée PF)
      'consommation_mp'     -- Sortie MP pour production
    )),
  -- Source / Destination
  atelier_source_id INTEGER REFERENCES ateliers(id),
  emplacement_source_id INTEGER REFERENCES emplacements_stock(id),
  atelier_dest_id INTEGER REFERENCES ateliers(id),
  emplacement_dest_id INTEGER REFERENCES emplacements_stock(id),
  client_id UUID REFERENCES clients(id),
  -- Lien production
  of_id UUID,
  session_id UUID,
  -- Statut workflow
  statut VARCHAR(20) DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','valide','expedie','receptionne','annule')),
  -- Dates
  date_mouvement DATE DEFAULT CURRENT_DATE,
  date_validation TIMESTAMPTZ,
  date_reception TIMESTAMPTZ,
  -- Acteurs
  cree_par UUID,
  valide_par UUID,
  receptionne_par UUID,
  -- Documents
  notes TEXT,
  motif_annulation TEXT,
  pdf_path VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lignes_mouvement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mouvement_id UUID REFERENCES mouvements_stock(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id),
  lot_id UUID REFERENCES lots_stock(id),
  -- Quantités
  qte_prevue NUMERIC(15,3) NOT NULL,
  qte_reelle NUMERIC(15,3),
  unite_id INTEGER REFERENCES unites_mesure(id),
  -- Poids
  poids_theorique_kg NUMERIC(12,4),
  poids_reel_kg NUMERIC(12,4),
  -- Prix
  prix_unitaire NUMERIC(12,4) DEFAULT 0,
  montant_total NUMERIC(15,4) DEFAULT 0,
  -- Ecart
  ecart_qte NUMERIC(15,3) GENERATED ALWAYS AS (qte_reelle - qte_prevue) STORED,
  motif_ecart TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Génération automatique numéro bon
CREATE OR REPLACE FUNCTION generer_numero_mouvement()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
BEGIN
  prefix := CASE NEW.type_mouvement
    WHEN 'cession_atelier'      THEN 'BC'   -- Bon de Cession
    WHEN 'livraison_mp'         THEN 'BL'   -- Bon de Livraison MP
    WHEN 'livraison_pf_interne' THEN 'BLI'  -- Bon Livraison Interne
    WHEN 'reception_achat'      THEN 'BR'   -- Bon de Réception
    WHEN 'expedition_vente'     THEN 'BE'   -- Bon d'Expédition
    WHEN 'retour_atelier'       THEN 'BRA'  -- Bon de Retour Atelier
    WHEN 'ajustement_positif'   THEN 'AP'
    WHEN 'ajustement_negatif'   THEN 'AN'
    ELSE 'MV'
  END;
  NEW.numero_bon := prefix || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('mouvement_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_mouvement
  BEFORE INSERT ON mouvements_stock
  FOR EACH ROW EXECUTE FUNCTION generer_numero_mouvement();

-- ============================================================
-- 5. ORDRES DE FABRICATION (enrichis)
-- ============================================================

CREATE TABLE ordres_fabrication (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_of VARCHAR(50) UNIQUE NOT NULL,
  -- Liens
  client_id UUID REFERENCES clients(id),
  article_id UUID REFERENCES articles(id),
  atelier_id INTEGER REFERENCES ateliers(id),
  -- Quantités
  quantite_cible NUMERIC(12,3) NOT NULL,
  quantite_produite NUMERIC(12,3) DEFAULT 0,
  unite_id INTEGER REFERENCES unites_mesure(id),
  -- Poids théorique vs réel
  poids_theorique_total_kg NUMERIC(12,4),
  poids_reel_total_kg NUMERIC(12,4) DEFAULT 0,
  -- Temps
  temps_prevu_min INTEGER,
  temps_reel_min INTEGER DEFAULT 0,
  date_lancement DATE,
  date_livraison_prevue DATE,
  date_livraison_reelle DATE,
  -- Statut
  statut VARCHAR(30) DEFAULT 'planifie'
    CHECK (statut IN ('planifie','en_attente_regleur','en_cours','pause','termine','livre','annule')),
  priorite INTEGER DEFAULT 5,
  -- Import Sage
  reference_sage VARCHAR(100),
  date_import TIMESTAMPTZ,
  -- Notes
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. RAPPORT JOURNALIER DE PRODUCTION
-- ============================================================

CREATE TABLE rapports_journaliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identification
  numero_rapport VARCHAR(30) UNIQUE NOT NULL,
  date_rapport DATE NOT NULL DEFAULT CURRENT_DATE,
  atelier_id INTEGER REFERENCES ateliers(id),
  shift_id INTEGER,
  -- Responsable
  chef_atelier_id UUID,
  -- Production
  of_id UUID REFERENCES ordres_fabrication(id),
  article_id UUID REFERENCES articles(id),
  machine_id INTEGER,
  -- Quantités produites
  qte_produite NUMERIC(12,3) DEFAULT 0,
  poids_net_kg NUMERIC(12,4) DEFAULT 0,
  poids_brut_kg NUMERIC(12,4) DEFAULT 0,
  -- Matière consommée
  matiere_prevue_kg NUMERIC(12,4) DEFAULT 0,
  matiere_reelle_kg NUMERIC(12,4) DEFAULT 0,
  ecart_matiere_kg NUMERIC(12,4) GENERATED ALWAYS AS (matiere_reelle_kg - matiere_prevue_kg) STORED,
  -- Déchets (matière non conforme récupérable)
  qte_dechets NUMERIC(12,3) DEFAULT 0,
  poids_dechets_kg NUMERIC(12,4) DEFAULT 0,
  motif_dechets VARCHAR(200),
  -- Pertes (matière non récupérable : chutes, purges...)
  qte_pertes NUMERIC(12,3) DEFAULT 0,
  poids_pertes_kg NUMERIC(12,4) DEFAULT 0,
  motif_pertes VARCHAR(200),
  -- Rebus (non-conformes rejetés)
  qte_rebus NUMERIC(12,3) DEFAULT 0,
  poids_rebus_kg NUMERIC(12,4) DEFAULT 0,
  motif_rebus VARCHAR(200),
  -- Temps
  temps_prod_prevu_min INTEGER DEFAULT 0,
  temps_prod_reel_min INTEGER DEFAULT 0,
  temps_arret_min INTEGER DEFAULT 0,
  temps_reglage_min INTEGER DEFAULT 0,
  -- KPI calculés
  trs_calcule NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN (temps_prod_reel_min + temps_arret_min) > 0
    THEN ROUND(temps_prod_reel_min::NUMERIC / (temps_prod_reel_min + temps_arret_min) * 100, 2)
    ELSE 0 END
  ) STORED,
  taux_rebus_calcule NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN poids_net_kg > 0
    THEN ROUND((poids_rebus_kg + poids_dechets_kg) / poids_net_kg * 100, 2)
    ELSE 0 END
  ) STORED,
  rendement_matiere_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN matiere_reelle_kg > 0
    THEN ROUND(poids_net_kg / matiere_reelle_kg * 100, 2)
    ELSE 0 END
  ) STORED,
  -- Effectif
  nb_operateurs INTEGER DEFAULT 0,
  heures_travaillees NUMERIC(6,2) DEFAULT 0,
  -- Observations et validation
  observations TEXT,
  problemes_rencontres TEXT,
  actions_correctives TEXT,
  statut VARCHAR(20) DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','soumis','valide','rejete')),
  valide_par UUID,
  valide_at TIMESTAMPTZ,
  pdf_path VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE rapport_seq START 1000;
CREATE OR REPLACE FUNCTION generer_numero_rapport()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_rapport := 'RJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('rapport_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_numero_rapport
  BEFORE INSERT ON rapports_journaliers
  FOR EACH ROW EXECUTE FUNCTION generer_numero_rapport();

-- ============================================================
-- 7. QHSE — NON-CONFORMITÉS, AUDITS, INCIDENTS
-- ============================================================

CREATE TABLE non_conformites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_nc VARCHAR(30) UNIQUE NOT NULL,
  -- Classification
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('interne','client','fournisseur','produit','processus','equipement','securite')),
  gravite VARCHAR(20) DEFAULT 'mineure'
    CHECK (gravite IN ('mineure','majeure','critique','bloquante')),
  -- Origine
  atelier_id INTEGER REFERENCES ateliers(id),
  of_id UUID REFERENCES ordres_fabrication(id),
  article_id UUID REFERENCES articles(id),
  machine_id INTEGER,
  -- Description
  titre VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  causes_identifiees TEXT,
  -- Quantités impactées
  qte_impactee NUMERIC(12,3),
  valeur_impactee NUMERIC(12,4),
  -- Actions
  action_immediate TEXT,
  action_corrective TEXT,
  action_preventive TEXT,
  -- Responsabilités
  detecte_par UUID,
  responsable_traitement UUID,
  -- AMDEC
  gravite_amdec INTEGER CHECK (gravite_amdec BETWEEN 1 AND 10),
  occurrence_amdec INTEGER CHECK (occurrence_amdec BETWEEN 1 AND 10),
  detectabilite_amdec INTEGER CHECK (detectabilite_amdec BETWEEN 1 AND 10),
  ipr_amdec INTEGER GENERATED ALWAYS AS (
    COALESCE(gravite_amdec * occurrence_amdec * detectabilite_amdec, 0)
  ) STORED,
  -- Photos & docs
  photos JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  -- Analyse IA
  analyse_ia TEXT,
  -- Statut & dates
  statut VARCHAR(20) DEFAULT 'ouvert'
    CHECK (statut IN ('ouvert','en_cours','clos','annule')),
  date_detection DATE DEFAULT CURRENT_DATE,
  date_cloture DATE,
  delai_traitement_jours INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE nc_seq START 1000;
CREATE OR REPLACE FUNCTION generer_numero_nc()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_nc := 'NC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('nc_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_numero_nc BEFORE INSERT ON non_conformites FOR EACH ROW EXECUTE FUNCTION generer_numero_nc();

-- Incidents sécurité / OSH
CREATE TABLE incidents_securite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_incident VARCHAR(30) UNIQUE NOT NULL,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('accident','presque_accident','situation_dangereuse','maladie_pro','dommage_materiel')),
  gravite VARCHAR(20) DEFAULT 'sans_arret'
    CHECK (gravite IN ('sans_arret','avec_arret','grave','mortel')),
  atelier_id INTEGER REFERENCES ateliers(id),
  personne_impliquee VARCHAR(200),
  description TEXT NOT NULL,
  causes TEXT,
  actions_immédiates TEXT,
  actions_correctives TEXT,
  temoins TEXT,
  photos JSONB DEFAULT '[]',
  arret_travail_jours INTEGER DEFAULT 0,
  cout_estime NUMERIC(12,2) DEFAULT 0,
  declare_par UUID,
  statut VARCHAR(20) DEFAULT 'ouvert',
  date_incident TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE incident_seq START 100;
CREATE OR REPLACE FUNCTION generer_numero_incident()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_incident := 'INC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('incident_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_numero_incident BEFORE INSERT ON incidents_securite FOR EACH ROW EXECUTE FUNCTION generer_numero_incident();

-- Audits ISO
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_audit VARCHAR(30) UNIQUE NOT NULL,
  type VARCHAR(20) DEFAULT 'interne' CHECK (type IN ('interne','externe','certification','surveillance')),
  norme VARCHAR(50), -- ISO 9001, ISO 22000, HACCP...
  atelier_id INTEGER REFERENCES ateliers(id),
  auditeur_id UUID,
  date_audit DATE NOT NULL,
  date_rapport DATE,
  statut VARCHAR(20) DEFAULT 'planifie'
    CHECK (statut IN ('planifie','en_cours','clos')),
  synthese TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_constats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID REFERENCES audits(id),
  clause_iso VARCHAR(20),
  type VARCHAR(20) CHECK (type IN ('conformite','non_conformite','observation','point_fort')),
  description TEXT NOT NULL,
  evidence TEXT,
  action_requise TEXT,
  responsable UUID,
  echeance DATE,
  statut VARCHAR(20) DEFAULT 'ouvert',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. GMAO — MAINTENANCE
-- ============================================================

CREATE TABLE equipements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) UNIQUE NOT NULL,
  designation VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  marque VARCHAR(100),
  modele VARCHAR(100),
  numero_serie VARCHAR(100),
  atelier_id INTEGER REFERENCES ateliers(id),
  -- Infos techniques
  puissance_kw NUMERIC(8,2),
  tension_v INTEGER,
  annee_fabrication INTEGER,
  date_mise_service DATE,
  valeur_achat NUMERIC(12,2),
  fournisseur_id UUID REFERENCES clients(id),
  -- Docs
  manuel_path VARCHAR(255),
  photo_path VARCHAR(255),
  -- Statut
  statut VARCHAR(20) DEFAULT 'operationnel'
    CHECK (statut IN ('operationnel','en_panne','maintenance','rebut')),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plans_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipement_id UUID REFERENCES equipements(id),
  type VARCHAR(20) DEFAULT 'preventive'
    CHECK (type IN ('preventive','predictive','corrective')),
  designation VARCHAR(200) NOT NULL,
  description TEXT,
  frequence VARCHAR(20)
    CHECK (frequence IN ('quotidien','hebdo','mensuel','trimestriel','semestriel','annuel')),
  duree_prevue_min INTEGER,
  responsable_id UUID,
  actif BOOLEAN DEFAULT true,
  prochaine_echeance DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordres_travail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ot VARCHAR(30) UNIQUE NOT NULL,
  equipement_id UUID REFERENCES equipements(id),
  plan_id UUID REFERENCES plans_maintenance(id),
  type VARCHAR(20) DEFAULT 'correctif'
    CHECK (type IN ('preventif','correctif','amelioratif')),
  priorite VARCHAR(20) DEFAULT 'normale'
    CHECK (priorite IN ('faible','normale','haute','urgente')),
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  -- Panne liée
  cause_panne TEXT,
  symptomes TEXT,
  -- Travaux
  travaux_effectues TEXT,
  pieces_utilisees JSONB DEFAULT '[]',
  -- Temps & coûts
  temps_prevu_min INTEGER,
  temps_reel_min INTEGER DEFAULT 0,
  cout_main_oeuvre NUMERIC(10,2) DEFAULT 0,
  cout_pieces NUMERIC(10,2) DEFAULT 0,
  cout_total NUMERIC(10,2) GENERATED ALWAYS AS (cout_main_oeuvre + cout_pieces) STORED,
  -- Acteurs
  technicien_id UUID,
  valide_par UUID,
  -- Dates
  date_signalement TIMESTAMPTZ DEFAULT NOW(),
  date_debut TIMESTAMPTZ,
  date_fin TIMESTAMPTZ,
  date_planifiee DATE,
  statut VARCHAR(20) DEFAULT 'ouvert'
    CHECK (statut IN ('ouvert','en_cours','suspendu','clos','annule')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE ot_seq START 1000;
CREATE OR REPLACE FUNCTION generer_numero_ot()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_ot := 'OT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('ot_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_numero_ot BEFORE INSERT ON ordres_travail FOR EACH ROW EXECUTE FUNCTION generer_numero_ot();

-- ============================================================
-- 9. PROCESSUS & DOCUMENTATION
-- ============================================================

CREATE TABLE processus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) UNIQUE NOT NULL,
  titre VARCHAR(200) NOT NULL,
  type VARCHAR(30) DEFAULT 'production'
    CHECK (type IN ('production','qualite','maintenance','securite','achat','vente','rh','direction')),
  atelier_id INTEGER REFERENCES ateliers(id),
  proprietaire_id UUID,
  version VARCHAR(10) DEFAULT '1.0',
  statut VARCHAR(20) DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','en_revue','approuve','obsolete')),
  objectif TEXT,
  description TEXT,
  risques TEXT,
  indicateurs TEXT,
  -- ISO
  clause_iso VARCHAR(50),
  points_ccp BOOLEAN DEFAULT false,
  -- IA
  resume_ia TEXT,
  derniere_analyse_ia TIMESTAMPTZ,
  -- Dates
  date_creation DATE DEFAULT CURRENT_DATE,
  date_approbation DATE,
  date_revision DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents_processus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  processus_id UUID REFERENCES processus(id),
  type_doc VARCHAR(30)
    CHECK (type_doc IN ('procedure','instruction_travail','formulaire','enregistrement','plan_controle')),
  titre VARCHAR(200) NOT NULL,
  contenu_html TEXT,
  fichier_path VARCHAR(255),
  version VARCHAR(10) DEFAULT '1.0',
  approuve_par UUID,
  date_approbation DATE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. IA INTERNE (OLLAMA)
-- ============================================================

CREATE TABLE ia_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur_id UUID,
  atelier_id INTEGER REFERENCES ateliers(id),
  -- Contexte
  type_contexte VARCHAR(30)
    CHECK (type_contexte IN ('qhse','production','gmao','processus','stock','general')),
  entite_type VARCHAR(30),
  entite_id UUID,
  -- Conversation
  messages JSONB DEFAULT '[]',
  -- Modèle IA utilisé
  modele_ia VARCHAR(100) DEFAULT 'qwen2.5-coder:7b',
  -- Résumé de la session
  resume TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ia_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(30)
    CHECK (type IN ('action_corrective','analyse_nc','optimisation_production','alerte_predictive','documentation')),
  entite_type VARCHAR(30),
  entite_id UUID,
  suggestion TEXT NOT NULL,
  confiance NUMERIC(4,2),
  appliquee BOOLEAN DEFAULT false,
  rejetee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. UTILISATEURS (enrichi)
-- ============================================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'
);

INSERT INTO roles (nom, description) VALUES
  ('super_admin',    'Accès total au système'),
  ('directeur',      'Tableau de bord direction + validation'),
  ('chef_atelier',   'Gestion atelier + KPI + rapports'),
  ('operateur',      'Saisie production atelier'),
  ('regleur',        'Validation paramètres machine'),
  ('qualite',        'Contrôle qualité + QHSE'),
  ('technicien',     'GMAO + maintenance'),
  ('achat',          'Module achats + réceptions'),
  ('vente',          'Module ventes + expéditions'),
  ('magasinier',     'Gestion stock + bons de cession'),
  ('qhse',           'QHSE + audits + non-conformités'),
  ('rh',             'Ressources humaines');

CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricule VARCHAR(30) UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  login VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  telephone VARCHAR(50),
  role_id INTEGER REFERENCES roles(id),
  atelier_id INTEGER REFERENCES ateliers(id),
  badge_qr VARCHAR(100) UNIQUE,
  photo_path VARCHAR(255),
  -- Habilitations
  habilitations JSONB DEFAULT '[]',
  formations JSONB DEFAULT '[]',
  -- Statut
  actif BOOLEAN DEFAULT true,
  derniere_connexion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. VUES UTILES
-- ============================================================

-- Vue stock global par article
CREATE VIEW vue_stock_global AS
SELECT
  a.code, a.designation, a.poids_theorique_kg,
  f.libelle AS famille,
  um.code AS unite,
  SUM(sa.qte_disponible) AS stock_total_dispo,
  SUM(sa.qte_reservee) AS stock_total_reserve,
  SUM(sa.valeur_stock) AS valeur_totale,
  CASE WHEN SUM(sa.qte_disponible) <= a.stock_mini THEN true ELSE false END AS alerte_stock_bas
FROM articles a
JOIN familles_articles f ON f.id = a.famille_id
JOIN unites_mesure um ON um.id = a.unite_mesure_id
LEFT JOIN stock_articles sa ON sa.article_id = a.id
WHERE a.actif = true
GROUP BY a.id, a.code, a.designation, a.poids_theorique_kg, f.libelle, um.code, a.stock_mini;

-- Vue rapport journalier enrichi
CREATE VIEW vue_rapports_journaliers AS
SELECT
  rj.*,
  at.libelle AS atelier_nom,
  a.code AS article_code,
  a.designation AS article_nom,
  o.numero_of
FROM rapports_journaliers rj
LEFT JOIN ateliers at ON at.id = rj.atelier_id
LEFT JOIN articles a ON a.id = rj.article_id
LEFT JOIN ordres_fabrication o ON o.id = rj.of_id;

-- Vue mouvements de stock enrichis
CREATE VIEW vue_mouvements AS
SELECT
  ms.*, ms.numero_bon,
  ms.type_mouvement,
  as1.code AS source_code, as1.libelle AS source_libelle,
  as2.code AS dest_code, as2.libelle AS dest_libelle,
  COUNT(lm.id) AS nb_lignes,
  SUM(lm.poids_reel_kg) AS poids_total_kg,
  SUM(lm.montant_total) AS montant_total
FROM mouvements_stock ms
LEFT JOIN ateliers as1 ON as1.id = ms.atelier_source_id
LEFT JOIN ateliers as2 ON as2.id = ms.atelier_dest_id
LEFT JOIN lignes_mouvement lm ON lm.mouvement_id = ms.id
GROUP BY ms.id, as1.code, as1.libelle, as2.code, as2.libelle;

-- Vue QHSE dashboard
CREATE VIEW vue_qhse_dashboard AS
SELECT
  COUNT(*) FILTER (WHERE statut='ouvert') AS nc_ouvertes,
  COUNT(*) FILTER (WHERE statut='en_cours') AS nc_en_cours,
  COUNT(*) FILTER (WHERE statut='clos') AS nc_closes,
  COUNT(*) FILTER (WHERE gravite='critique' AND statut!='clos') AS nc_critiques,
  COUNT(*) FILTER (WHERE ipr_amdec > 100) AS ipr_elevé,
  ROUND(AVG(EXTRACT(DAY FROM (COALESCE(date_cloture, CURRENT_DATE) - date_detection))),1) AS delai_moyen_jours
FROM non_conformites;

-- ============================================================
-- 13. INDEX DE PERFORMANCE
-- ============================================================

CREATE INDEX idx_articles_code ON articles(code);
CREATE INDEX idx_articles_famille ON articles(famille_id);
CREATE INDEX idx_articles_type ON articles(type_article);
CREATE INDEX idx_stock_articles ON stock_articles(article_id, emplacement_id);
CREATE INDEX idx_lots_stock_article ON lots_stock(article_id);
CREATE INDEX idx_lots_stock_statut ON lots_stock(statut);
CREATE INDEX idx_mouvements_type ON mouvements_stock(type_mouvement, statut);
CREATE INDEX idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX idx_rapports_date ON rapports_journaliers(date_rapport, atelier_id);
CREATE INDEX idx_nc_statut ON non_conformites(statut, gravite);
CREATE INDEX idx_ot_statut ON ordres_travail(statut, priorite);

-- ============================================================
-- 14. DONNÉES DE BASE
-- ============================================================

-- Admin par défaut (password: Admin2026!)
INSERT INTO utilisateurs (matricule, nom, prenom, login, password_hash, role_id, atelier_id, badge_qr)
VALUES ('ADM001', 'Admin', 'NAIdo',
  'admin', '$2b$10$rQZ8K1mN9pLxVvYwX3aKsuPQj7iE6nH2bF5cM0dT4gW8sR6uJ1oAe',
  1, 8, 'BADGE-ADMIN-001');
