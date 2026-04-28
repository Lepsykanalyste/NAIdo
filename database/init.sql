-- ============================================================
-- NAIdo - MES Atelier 3 - Green Industry
-- Schéma PostgreSQL complet
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES DE RÉFÉRENCE
-- ============================================================

-- Rôles utilisateurs
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

INSERT INTO roles (nom, description) VALUES
  ('operateur',    'Saisie de production en atelier'),
  ('regleur',      'Validation paramètres machine avant démarrage OF'),
  ('qualite',      'Contrôle et validation des lots produits'),
  ('chef_atelier', 'Administration, KPI, rapports, gestion utilisateurs');

-- Utilisateurs
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  login VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  badge_qr VARCHAR(100) UNIQUE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Machines
CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('extrudeuse','soudeuse','impression')),
  numero INTEGER NOT NULL,
  actif BOOLEAN DEFAULT true,
  imprimante_type VARCHAR(20) CHECK (imprimante_type IN ('bluetooth','wifi','ethernet')),
  imprimante_adresse VARCHAR(100)
);

-- Insertion des machines
INSERT INTO machines (code, nom, type, numero) VALUES
  ('EX01','Extrudeuse #01','extrudeuse',1),
  ('EX02','Extrudeuse #02','extrudeuse',2),
  ('EX03','Extrudeuse #03','extrudeuse',3),
  ('EX04','Extrudeuse #04','extrudeuse',4),
  ('EX05','Extrudeuse #05','extrudeuse',5),
  ('EX06','Extrudeuse #06','extrudeuse',6),
  ('EX07','Extrudeuse #07','extrudeuse',7),
  ('EX08','Extrudeuse #08','extrudeuse',8),
  ('EX09','Extrudeuse #09','extrudeuse',9),
  ('SO01','Soudeuse #01','soudeuse',1),
  ('SO02','Soudeuse #02','soudeuse',2),
  ('SO03','Soudeuse #03','soudeuse',3),
  ('SO04','Soudeuse #04','soudeuse',4),
  ('SO05','Soudeuse #05','soudeuse',5),
  ('IM01','Machine Impression #01','impression',1),
  ('IM02','Machine Impression #02','impression',2);

-- Shifts
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(20) NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL
);

INSERT INTO shifts (nom, heure_debut, heure_fin) VALUES
  ('Matin',       '06:00', '14:00'),
  ('Apres-midi',  '14:00', '22:00'),
  ('Nuit',        '22:00', '06:00');

-- ============================================================
-- ARTICLES ET COMMANDES (importés depuis Sage)
-- ============================================================

CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(50) UNIQUE NOT NULL,
  designation TEXT NOT NULL,
  type_produit VARCHAR(100),
  dimensions VARCHAR(100),
  couleur VARCHAR(50),
  cadence_heure NUMERIC(10,2) NOT NULL,
  temps_reglage_min INTEGER DEFAULT 30,
  poids_mandrin_kg NUMERIC(6,3) DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_sage VARCHAR(50) UNIQUE NOT NULL,
  nom VARCHAR(200) NOT NULL,
  moyenne_livraison_mensuelle NUMERIC(10,2) DEFAULT 0,
  actif BOOLEAN DEFAULT true
);

CREATE TABLE ordres_fabrication (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_of VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  article_id UUID REFERENCES articles(id),
  quantite_cible NUMERIC(12,2) NOT NULL,
  quantite_produite NUMERIC(12,2) DEFAULT 0,
  date_livraison_prevue DATE,
  priorite INTEGER DEFAULT 5,
  statut VARCHAR(30) DEFAULT 'planifie'
    CHECK (statut IN ('planifie','en_attente_regleur','en_cours','pause','termine','annule')),
  machine_id INTEGER REFERENCES machines(id),
  temps_prevu_min INTEGER,
  date_import TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESSIONS DE PRODUCTION
-- ============================================================

CREATE TABLE sessions_production (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  of_id UUID REFERENCES ordres_fabrication(id),
  operateur_id UUID REFERENCES utilisateurs(id),
  regleur_id UUID REFERENCES utilisateurs(id),
  machine_id INTEGER REFERENCES machines(id),
  shift_id INTEGER REFERENCES shifts(id),
  date_session DATE DEFAULT CURRENT_DATE,
  heure_debut TIMESTAMPTZ,
  heure_fin TIMESTAMPTZ,
  statut VARCHAR(20) DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours','pause','termine')),
  -- Validation régleur (obligatoire avant démarrage)
  regleur_valide BOOLEAN DEFAULT false,
  regleur_validation_at TIMESTAMPTZ,
  regleur_temperature NUMERIC(6,2),
  regleur_pression NUMERIC(6,2),
  regleur_vitesse NUMERIC(6,2),
  regleur_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAISIES DE PRODUCTION & TICKETS
-- ============================================================

CREATE TABLE tickets_production (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ticket VARCHAR(30) UNIQUE NOT NULL,
  session_id UUID REFERENCES sessions_production(id),
  of_id UUID REFERENCES ordres_fabrication(id),
  machine_id INTEGER REFERENCES machines(id),
  operateur_id UUID REFERENCES utilisateurs(id),
  poids_brut_kg NUMERIC(8,3) NOT NULL,
  poids_mandrin_kg NUMERIC(6,3) DEFAULT 0,
  poids_net_kg NUMERIC(8,3) NOT NULL,
  poids_dechets_kg NUMERIC(8,3) DEFAULT 0,
  motif_dechet VARCHAR(100),
  qr_code_contenu TEXT NOT NULL,
  imprime BOOLEAN DEFAULT false,
  imprime_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Génération automatique du numéro de ticket
CREATE SEQUENCE ticket_seq START 1000;

CREATE OR REPLACE FUNCTION generer_numero_ticket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_ticket := 'TK' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('ticket_seq')::TEXT, 4, '0');
  NEW.qr_code_contenu := (
    SELECT o.numero_of || '|' ||
           TO_CHAR(NOW(), 'DDMMYY') || '|' ||
           m.code || '|' ||
           NEW.poids_net_kg::TEXT || '|' ||
           NEW.numero_ticket
    FROM ordres_fabrication o, machines m
    WHERE o.id = NEW.of_id AND m.id = NEW.machine_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_numero
  BEFORE INSERT ON tickets_production
  FOR EACH ROW EXECUTE FUNCTION generer_numero_ticket();

-- ============================================================
-- TEMPS D'ARRÊT
-- ============================================================

CREATE TABLE arrêts_machine (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions_production(id),
  machine_id INTEGER REFERENCES machines(id),
  operateur_id UUID REFERENCES utilisateurs(id),
  heure_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heure_fin TIMESTAMPTZ,
  duree_min INTEGER,
  cause VARCHAR(50) NOT NULL
    CHECK (cause IN (
      'panne_mecanique','panne_electrique',
      'changement_matiere','reglage',
      'coupure_electricite','manque_personnel','autre'
    )),
  details TEXT,
  statut VARCHAR(20) DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours','clos')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calcul automatique de la durée à la clôture
CREATE OR REPLACE FUNCTION calcul_duree_arret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.heure_fin IS NOT NULL AND OLD.heure_fin IS NULL THEN
    NEW.duree_min := EXTRACT(EPOCH FROM (NEW.heure_fin - NEW.heure_debut)) / 60;
    NEW.statut := 'clos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_duree_arret
  BEFORE UPDATE ON arrêts_machine
  FOR EACH ROW EXECUTE FUNCTION calcul_duree_arret();

-- ============================================================
-- CONTRÔLE QUALITÉ
-- ============================================================

CREATE TABLE controles_qualite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  of_id UUID REFERENCES ordres_fabrication(id),
  controleur_id UUID REFERENCES utilisateurs(id),
  session_id UUID REFERENCES sessions_production(id),
  decision VARCHAR(20) NOT NULL
    CHECK (decision IN ('approuve','rejete','en_attente')),
  notes TEXT,
  -- Photos (chemins fichiers sur serveur)
  photos JSONB DEFAULT '[]',
  -- Signature électronique (base64 canvas)
  signature_base64 TEXT,
  signature_at TIMESTAMPTZ,
  -- PDF généré
  pdf_path VARCHAR(255),
  pdf_genere_at TIMESTAMPTZ,
  quantite_approuvee NUMERIC(12,2) DEFAULT 0,
  quantite_rejetee NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK PRODUITS FINIS
-- ============================================================

CREATE TABLE stock_produits_finis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id),
  of_id UUID REFERENCES ordres_fabrication(id),
  controle_id UUID REFERENCES controles_qualite(id),
  quantite NUMERIC(12,2) NOT NULL,
  poids_total_kg NUMERIC(12,3),
  date_entree TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- IMPORTS SAGE
-- ============================================================

CREATE TABLE imports_sage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom_fichier VARCHAR(255),
  nb_of_importes INTEGER DEFAULT 0,
  nb_articles_importes INTEGER DEFAULT 0,
  statut VARCHAR(20) DEFAULT 'succes',
  erreurs JSONB DEFAULT '[]',
  importe_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VUE TRS (Taux de Rendement Synthétique)
-- ============================================================

CREATE VIEW vue_trs AS
SELECT
  sp.machine_id,
  m.code AS machine_code,
  m.nom AS machine_nom,
  sp.date_session,
  sp.shift_id,
  sh.nom AS shift_nom,
  -- Temps total shift en minutes
  480 AS temps_total_min,
  -- Temps arrêts
  COALESCE(SUM(ar.duree_min), 0) AS temps_arret_min,
  -- Temps production réel
  480 - COALESCE(SUM(ar.duree_min), 0) AS temps_prod_min,
  -- TRS
  ROUND(
    (480 - COALESCE(SUM(ar.duree_min), 0))::NUMERIC / 480 * 100, 2
  ) AS trs_pct,
  -- Poids produit
  COALESCE(SUM(tp.poids_net_kg), 0) AS poids_net_total_kg,
  COALESCE(SUM(tp.poids_dechets_kg), 0) AS poids_dechets_kg,
  -- Taux rebus
  CASE
    WHEN COALESCE(SUM(tp.poids_net_kg), 0) > 0
    THEN ROUND(SUM(tp.poids_dechets_kg) / SUM(tp.poids_net_kg) * 100, 2)
    ELSE 0
  END AS taux_rebus_pct
FROM sessions_production sp
JOIN machines m ON m.id = sp.machine_id
JOIN shifts sh ON sh.id = sp.shift_id
LEFT JOIN arrêts_machine ar ON ar.session_id = sp.id AND ar.statut = 'clos'
LEFT JOIN tickets_production tp ON tp.session_id = sp.id
GROUP BY sp.machine_id, m.code, m.nom, sp.date_session, sp.shift_id, sh.nom;

-- ============================================================
-- UTILISATEUR ADMIN PAR DÉFAUT
-- password: Admin2026! (bcrypt hash)
-- ============================================================

INSERT INTO utilisateurs (nom, prenom, login, password_hash, role_id, badge_qr) VALUES
  ('Admin', 'NAIdo', 'admin',
   '$2b$10$rQZ8K1mN9pLxVvYwX3aKsuPQj7iE6nH2bF5cM0dT4gW8sR6uJ1oAe',
   (SELECT id FROM roles WHERE nom = 'chef_atelier'),
   'BADGE-ADMIN-001');
