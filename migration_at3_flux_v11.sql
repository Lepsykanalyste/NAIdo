-- ============================================================
-- NAIdo — Migration AT3 FLUX COMPLET v1.1 CORRIGÉE
-- Correction : of_id UUID, article_id UUID, client_id UUID
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. ZONES AT3 (déjà créées, on skip)
-- ─────────────────────────────────────────────────────────────
-- Déjà OK depuis v1.0

-- ─────────────────────────────────────────────────────────────
-- 2. COLONNES AT3 sur ordres_fabrication
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_statut_zone VARCHAR(30) DEFAULT 'nouveau';

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_composition_validee BOOLEAN DEFAULT false;

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_poids_cible_kg NUMERIC(12,3);

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_nb_bobines_cibles INTEGER;

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_notes_regleur TEXT;

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_notes_chef TEXT;

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_valide_par UUID REFERENCES utilisateurs(id);

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_valide_le TIMESTAMPTZ;

ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_machine_assignee_id INTEGER REFERENCES machines(id);

-- ─────────────────────────────────────────────────────────────
-- 3. BOBINES DE PRODUCTION (of_id UUID, article_id UUID)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS bobines_production CASCADE;

CREATE TABLE bobines_production (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_bobine    VARCHAR(60) NOT NULL UNIQUE,
  numero_lot       VARCHAR(60),
  of_id            UUID        REFERENCES ordres_fabrication(id),
  article_id       UUID        REFERENCES articles(id),
  machine_id       INTEGER     REFERENCES machines(id),
  operateur_id     UUID        REFERENCES utilisateurs(id),
  poids_brut_kg    NUMERIC(10,3) DEFAULT 0,
  poids_net_kg     NUMERIC(10,3) DEFAULT 0,
  poids_mandrin_kg NUMERIC(10,3) DEFAULT 0,
  longueur_m       NUMERIC(10,2),
  temperature_c    NUMERIC(6,1),
  vitesse_m_min    NUMERIC(8,2),
  pression_bar     NUMERIC(6,2),
  zone_actuelle_id INTEGER REFERENCES zones_at3(id),
  statut           VARCHAR(30) DEFAULT 'extrusion',
  qc_quarantaine   JSONB DEFAULT '{}',
  qc_impression    JSONB DEFAULT '{}',
  heure_fin_extrusion  TIMESTAMPTZ,
  heure_entree_quar    TIMESTAMPTZ,
  heure_sortie_quar    TIMESTAMPTZ,
  heure_entree_impr    TIMESTAMPTZ,
  heure_sortie_impr    TIMESTAMPTZ,
  heure_entree_embl    TIMESTAMPTZ,
  heure_fin_embl       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bobines_of     ON bobines_production(of_id);
CREATE INDEX IF NOT EXISTS idx_bobines_statut ON bobines_production(statut);
CREATE INDEX IF NOT EXISTS idx_bobines_zone   ON bobines_production(zone_actuelle_id);
CREATE INDEX IF NOT EXISTS idx_bobines_lot    ON bobines_production(numero_lot);

-- ─────────────────────────────────────────────────────────────
-- 4. MOUVEMENTS AT3 (of_id UUID)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS mouvements_at3 CASCADE;

CREATE TABLE mouvements_at3 (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ticket   VARCHAR(60) NOT NULL UNIQUE,
  of_id           UUID        REFERENCES ordres_fabrication(id),
  zone_source_id  INTEGER     REFERENCES zones_at3(id),
  zone_dest_id    INTEGER     REFERENCES zones_at3(id),
  type_mouvement  VARCHAR(30) NOT NULL,
  statut          VARCHAR(20) DEFAULT 'en_attente',
  bobines_ids     JSONB DEFAULT '[]',
  nb_bobines      INTEGER DEFAULT 0,
  poids_total_kg  NUMERIC(12,3) DEFAULT 0,
  cree_par        UUID REFERENCES utilisateurs(id),
  valide_par      UUID REFERENCES utilisateurs(id),
  date_mouvement  TIMESTAMPTZ DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  notes           TEXT,
  ticket_genere   BOOLEAN DEFAULT false,
  ticket_path     VARCHAR(500),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mvt_at3_of     ON mouvements_at3(of_id);
CREATE INDEX IF NOT EXISTS idx_mvt_at3_type   ON mouvements_at3(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_mvt_at3_statut ON mouvements_at3(statut);

-- ─────────────────────────────────────────────────────────────
-- 5. CONTROLES IMPRESSION (of_id UUID)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS controles_impression CASCADE;

CREATE TABLE controles_impression (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bobine_id       UUID REFERENCES bobines_production(id),
  of_id           UUID REFERENCES ordres_fabrication(id),
  operateur_id    UUID REFERENCES utilisateurs(id),
  type_impression VARCHAR(50),
  couleur_encre   VARCHAR(50),
  texte_imprime   TEXT,
  controle_ok     BOOLEAN DEFAULT false,
  nb_reprises     INTEGER DEFAULT 0,
  motif_reprise   TEXT,
  observations    TEXT,
  heure_debut     TIMESTAMPTZ DEFAULT NOW(),
  heure_fin       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctrl_impr_bobine ON controles_impression(bobine_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_impr_of     ON controles_impression(of_id);

-- ─────────────────────────────────────────────────────────────
-- 6. PALETTES EMBALLAGE (of_id UUID, article_id UUID)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS palettes_emballage CASCADE;

CREATE TABLE palettes_emballage (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_palette   VARCHAR(60) NOT NULL UNIQUE,
  of_id            UUID REFERENCES ordres_fabrication(id),
  article_id       UUID REFERENCES articles(id),
  numero_lot       VARCHAR(60),
  bobines_ids      JSONB DEFAULT '[]',
  nb_sacs          INTEGER DEFAULT 0,
  poids_sacs_kg    NUMERIC(12,3) DEFAULT 0,
  poids_palette_kg NUMERIC(12,3) DEFAULT 0,
  poids_total_kg   NUMERIC(12,3) DEFAULT 0,
  type_emballage   VARCHAR(50),
  nb_couches       INTEGER,
  sacs_par_couche  INTEGER,
  etiquette_imprimee BOOLEAN DEFAULT false,
  qr_code          VARCHAR(255),
  zone_id          INTEGER REFERENCES zones_at3(id),
  statut           VARCHAR(20) DEFAULT 'emballage',
  emballeur_id     UUID REFERENCES utilisateurs(id),
  controleur_id    UUID REFERENCES utilisateurs(id),
  ticket_imprime   BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pal_of     ON palettes_emballage(of_id);
CREATE INDEX IF NOT EXISTS idx_pal_statut ON palettes_emballage(statut);
CREATE INDEX IF NOT EXISTS idx_pal_zone   ON palettes_emballage(zone_id);
CREATE INDEX IF NOT EXISTS idx_pal_lot    ON palettes_emballage(numero_lot);

-- ─────────────────────────────────────────────────────────────
-- 7. CESSIONS AT3 (of_id UUID)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS cessions_at3 CASCADE;

CREATE TABLE cessions_at3 (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_cession    VARCHAR(60) NOT NULL UNIQUE,
  of_id             UUID REFERENCES ordres_fabrication(id),
  bon_cession_id    UUID,
  palettes_ids      JSONB DEFAULT '[]',
  nb_palettes       INTEGER DEFAULT 0,
  nb_sacs_total     INTEGER DEFAULT 0,
  poids_total_kg    NUMERIC(12,3) DEFAULT 0,
  chef_atelier_id   UUID REFERENCES utilisateurs(id),
  receptionnaire_id UUID REFERENCES utilisateurs(id),
  statut            VARCHAR(20) DEFAULT 'brouillon',
  date_cession      TIMESTAMPTZ DEFAULT NOW(),
  date_reception    TIMESTAMPTZ,
  pdf_path          VARCHAR(500),
  pdf_genere        BOOLEAN DEFAULT false,
  notes_chef        TEXT,
  notes_magasin     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ces_of     ON cessions_at3(of_id);
CREATE INDEX IF NOT EXISTS idx_ces_statut ON cessions_at3(statut);

-- ─────────────────────────────────────────────────────────────
-- 8. TRIGGERS updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bobines_updated_at ON bobines_production;
CREATE TRIGGER set_bobines_updated_at
  BEFORE UPDATE ON bobines_production
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_palettes_updated_at ON palettes_emballage;
CREATE TRIGGER set_palettes_updated_at
  BEFORE UPDATE ON palettes_emballage
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 9. VUES (avec bons types UUID)
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vue_bobines_at3 CASCADE;
CREATE VIEW vue_bobines_at3 AS
SELECT
  b.id, b.numero_bobine, b.numero_lot,
  b.statut, b.poids_net_kg, b.poids_brut_kg, b.created_at,
  o.numero_of, o.at3_statut_zone,
  a.code AS article_code, a.designation AS article_nom,
  m.code AS machine_code,
  z.code AS zone_code, z.libelle AS zone_libelle,
  u.nom || ' ' || u.prenom AS operateur_nom
FROM bobines_production b
LEFT JOIN ordres_fabrication o ON o.id = b.of_id
LEFT JOIN articles a ON a.id = b.article_id
LEFT JOIN machines m ON m.id = b.machine_id
LEFT JOIN zones_at3 z ON z.id = b.zone_actuelle_id
LEFT JOIN utilisateurs u ON u.id = b.operateur_id;

DROP VIEW IF EXISTS vue_stock_at3 CASCADE;
CREATE VIEW vue_stock_at3 AS
SELECT
  a.id AS article_id,
  a.code AS article_code,
  a.designation AS article_nom,
  COUNT(p.id)          AS nb_palettes,
  SUM(p.nb_sacs)       AS nb_sacs_total,
  SUM(p.poids_sacs_kg) AS poids_net_total_kg,
  o.numero_of
FROM palettes_emballage p
JOIN articles a ON a.id = p.article_id
JOIN ordres_fabrication o ON o.id = p.of_id
WHERE p.statut = 'stock_at3'
GROUP BY a.id, a.code, a.designation, o.numero_of;

DROP VIEW IF EXISTS vue_flux_at3 CASCADE;
CREATE VIEW vue_flux_at3 AS
SELECT
  o.id AS of_id,
  o.numero_of,
  o.at3_statut_zone,
  o.at3_composition_validee,
  o.at3_poids_cible_kg,
  a.code AS article_code,
  a.designation AS article_nom,
  o.quantite_cible AS quantite,
  COUNT(DISTINCT b.id)                                         AS nb_bobines_total,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='quarantaine')  AS nb_bobines_quar,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='impression')   AS nb_bobines_impr,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='emballage')    AS nb_bobines_embl,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='stock_at3')    AS nb_bobines_stock,
  COALESCE(SUM(b.poids_net_kg), 0)                            AS poids_produit_kg,
  COUNT(DISTINCT p.id)                                         AS nb_palettes,
  COALESCE(SUM(p.nb_sacs), 0)                                 AS nb_sacs_total
FROM ordres_fabrication o
LEFT JOIN articles a ON a.id = o.article_id
LEFT JOIN bobines_production b ON b.of_id = o.id
LEFT JOIN palettes_emballage p ON p.of_id = o.id
WHERE o.statut NOT IN ('annule','archive')
GROUP BY o.id, o.numero_of, o.at3_statut_zone, o.at3_composition_validee,
         o.at3_poids_cible_kg, o.quantite_cible, a.code, a.designation;

-- ─────────────────────────────────────────────────────────────
-- 10. PERMISSIONS
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions_roles (role, module, peut_voir, peut_creer, peut_modifier, peut_supprimer)
VALUES
  ('chef_atelier',      'at3_flux', true, true,  true,  false),
  ('technicien_regleur','at3_flux', true, true,  true,  false),
  ('operateur',         'at3_flux', true, true,  false, false),
  ('emballeur',         'at3_flux', true, true,  false, false),
  ('controleur_qualite','at3_flux', true, true,  false, false),
  ('responsable_stock', 'at3_flux', true, false, false, false),
  ('directeur',         'at3_flux', true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- Mettre à jour les OF existants
UPDATE ordres_fabrication
SET at3_statut_zone = 'nouveau'
WHERE at3_statut_zone IS NULL;

SELECT 'Migration AT3 v1.1 CORRIGÉE ✓' AS statut;
SELECT COUNT(*) || ' tables AT3 créées' AS info
FROM information_schema.tables
WHERE table_name IN ('bobines_production','mouvements_at3','controles_impression','palettes_emballage','cessions_at3');
