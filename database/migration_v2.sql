-- ============================================================
-- NAIdo v2 — Migrations additionnelles
-- Traçabilité · Bilan matière · Alertes · Planning · Rapports
-- ============================================================

-- ── TRAÇABILITÉ LOT COMPLET ──────────────────────────────────
-- De la matière première au produit fini

CREATE TABLE matieres_premieres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(50) NOT NULL,
  designation VARCHAR(200) NOT NULL,
  type VARCHAR(50) DEFAULT 'granules', -- granules, colorant, additif
  unite VARCHAR(20) DEFAULT 'kg',
  stock_actuel NUMERIC(12,3) DEFAULT 0,
  stock_minimum NUMERIC(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lots_matiere (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matiere_id UUID REFERENCES matieres_premieres(id),
  numero_lot VARCHAR(50) UNIQUE NOT NULL,
  fournisseur VARCHAR(200),
  date_reception DATE DEFAULT CURRENT_DATE,
  quantite_recue_kg NUMERIC(12,3) NOT NULL,
  quantite_restante_kg NUMERIC(12,3) NOT NULL,
  certificat_path VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE consommations_matiere (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_matiere_id UUID REFERENCES lots_matiere(id),
  of_id UUID REFERENCES ordres_fabrication(id),
  session_id UUID REFERENCES sessions_production(id),
  quantite_kg NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lien ticket → lot matière (traçabilité complète)
ALTER TABLE tickets_production
  ADD COLUMN IF NOT EXISTS lot_matiere_id UUID REFERENCES lots_matiere(id);

-- ── BILAN MATIÈRE ─────────────────────────────────────────────

CREATE VIEW vue_bilan_matiere AS
SELECT
  DATE(sp.date_session) AS date_jour,
  m.code AS machine_code,
  o.numero_of,
  a.designation AS article,
  -- Matière entrante
  COALESCE(SUM(cm.quantite_kg), 0) AS matiere_entree_kg,
  -- Produit fini
  COALESCE(SUM(tp.poids_net_kg), 0) AS produit_fini_kg,
  -- Déchets
  COALESCE(SUM(tp.poids_dechets_kg), 0) AS dechets_kg,
  -- Taux de transformation
  CASE WHEN COALESCE(SUM(cm.quantite_kg), 0) > 0
    THEN ROUND(SUM(tp.poids_net_kg) / SUM(cm.quantite_kg) * 100, 2)
    ELSE 0
  END AS taux_transformation_pct
FROM sessions_production sp
JOIN ordres_fabrication o ON o.id = sp.of_id
JOIN articles a ON a.id = o.article_id
JOIN machines m ON m.id = sp.machine_id
LEFT JOIN consommations_matiere cm ON cm.session_id = sp.id
LEFT JOIN tickets_production tp ON tp.session_id = sp.id
GROUP BY DATE(sp.date_session), m.code, o.numero_of, a.designation;

-- ── PLANNING MACHINES ─────────────────────────────────────────

CREATE TABLE planning_machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  of_id UUID REFERENCES ordres_fabrication(id),
  machine_id INTEGER REFERENCES machines(id),
  shift_id INTEGER REFERENCES shifts(id),
  date_planifiee DATE NOT NULL,
  heure_debut_prevue TIME,
  heure_fin_prevue TIME,
  duree_prevue_min INTEGER,
  statut VARCHAR(20) DEFAULT 'planifie'
    CHECK (statut IN ('planifie','en_cours','termine','reporte')),
  ordre_priorite INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance planning
CREATE INDEX idx_planning_date ON planning_machines(date_planifiee);
CREATE INDEX idx_planning_machine ON planning_machines(machine_id, date_planifiee);

-- ── ALERTES & NOTIFICATIONS ───────────────────────────────────

CREATE TABLE alertes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL
    CHECK (type IN (
      'trs_bas','rebus_eleve','arret_long',
      'stock_bas','of_retard','objectif_atteint'
    )),
  machine_id INTEGER REFERENCES machines(id),
  of_id UUID REFERENCES ordres_fabrication(id),
  message TEXT NOT NULL,
  valeur_declenchante NUMERIC(10,2),
  seuil NUMERIC(10,2),
  lue BOOLEAN DEFAULT false,
  destinataires JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE config_alertes (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  seuil NUMERIC(10,2) NOT NULL,
  actif BOOLEAN DEFAULT true,
  canal VARCHAR(20) DEFAULT 'interface' -- interface, email
);

-- Seuils par défaut
INSERT INTO config_alertes (type, seuil, actif) VALUES
  ('trs_bas', 70, true),
  ('rebus_eleve', 5, true),
  ('arret_long', 15, true),   -- minutes
  ('stock_bas', 100, true);   -- kg

-- ── RAPPORTS AUTOMATIQUES ─────────────────────────────────────

CREATE TABLE rapports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(30) NOT NULL CHECK (type IN ('hebdo','mensuel','of')),
  periode_debut DATE,
  periode_fin DATE,
  genere_par UUID REFERENCES utilisateurs(id),
  pdf_path VARCHAR(255),
  excel_path VARCHAR(255),
  envoye_par_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── OBJECTIFS DE PRODUCTION ──────────────────────────────────

CREATE TABLE objectifs_production (
  id SERIAL PRIMARY KEY,
  machine_id INTEGER REFERENCES machines(id),
  shift_id INTEGER REFERENCES shifts(id),
  objectif_trs_pct NUMERIC(5,2) DEFAULT 80,
  objectif_kg_par_shift NUMERIC(10,2),
  objectif_rebus_max_pct NUMERIC(5,2) DEFAULT 3,
  actif BOOLEAN DEFAULT true
);

-- ── VUE PLANNING ENRICHIE ─────────────────────────────────────

CREATE VIEW vue_planning_jour AS
SELECT
  pm.id,
  pm.date_planifiee,
  pm.heure_debut_prevue,
  pm.heure_fin_prevue,
  pm.duree_prevue_min,
  pm.statut AS statut_planning,
  pm.ordre_priorite,
  m.code AS machine_code,
  m.nom AS machine_nom,
  m.type AS machine_type,
  sh.nom AS shift_nom,
  o.numero_of,
  o.statut AS statut_of,
  o.quantite_cible,
  o.quantite_produite,
  ROUND(o.quantite_produite / NULLIF(o.quantite_cible, 0) * 100, 1) AS avancement_pct,
  c.nom AS client_nom,
  a.designation AS article_nom,
  a.dimensions,
  a.couleur,
  o.date_livraison_prevue
FROM planning_machines pm
JOIN machines m ON m.id = pm.machine_id
JOIN shifts sh ON sh.id = pm.shift_id
JOIN ordres_fabrication o ON o.id = pm.of_id
JOIN clients c ON c.id = o.client_id
JOIN articles a ON a.id = o.article_id;

-- ── FONCTION ALERTES AUTOMATIQUES ────────────────────────────

CREATE OR REPLACE FUNCTION verifier_alertes()
RETURNS void AS $$
DECLARE
  seuil_rebus NUMERIC;
  seuil_trs NUMERIC;
  seuil_arret NUMERIC;
BEGIN
  SELECT seuil INTO seuil_rebus FROM config_alertes WHERE type='rebus_eleve' AND actif=true;
  SELECT seuil INTO seuil_trs FROM config_alertes WHERE type='trs_bas' AND actif=true;
  SELECT seuil INTO seuil_arret FROM config_alertes WHERE type='arret_long' AND actif=true;

  -- Alertes rebus élevé
  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'rebus_eleve', machine_id,
    'Taux de rebus élevé sur ' || machine_code || ' : ' || taux_rebus_pct || '%',
    taux_rebus_pct, seuil_rebus
  FROM vue_trs
  WHERE date_session = CURRENT_DATE
    AND taux_rebus_pct > seuil_rebus
    AND machine_id NOT IN (
      SELECT machine_id FROM alertes
      WHERE type='rebus_eleve' AND DATE(created_at)=CURRENT_DATE
    );

  -- Alertes TRS bas
  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'trs_bas', machine_id,
    'TRS bas sur ' || machine_code || ' : ' || trs_pct || '%',
    trs_pct, seuil_trs
  FROM vue_trs
  WHERE date_session = CURRENT_DATE
    AND trs_pct < seuil_trs AND trs_pct > 0
    AND machine_id NOT IN (
      SELECT machine_id FROM alertes
      WHERE type='trs_bas' AND DATE(created_at)=CURRENT_DATE
    );

  -- Alertes arrêts longs
  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'arret_long', am.machine_id,
    'Arrêt long en cours : ' || EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60 || ' min',
    EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60,
    seuil_arret
  FROM arrêts_machine am
  WHERE am.statut = 'en_cours'
    AND EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60 > seuil_arret
    AND am.id NOT IN (
      SELECT CAST(message AS TEXT) FROM alertes WHERE type='arret_long'
    );
END;
$$ LANGUAGE plpgsql;
