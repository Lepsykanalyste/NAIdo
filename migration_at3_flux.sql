-- ============================================================
-- NAIdo — Migration AT3 FLUX COMPLET v1.0
-- Extrusion → Quarantaine → Impression → Emballage → Stock AT3 → Cession Magasin
-- Auteur : SOPHOPSY / Green Industry
-- Date   : 2026-05-05
-- SAFE : utilise ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSION uuid si pas encore activée
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. ZONES INTERNES AT3
--    Représente les zones physiques de l'atelier :
--    QUAR (quarantaine), IMPR (impression), EMBL (emballage/découpe),
--    STKAT3 (stock interne AT3 avant cession)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones_at3 (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20)  NOT NULL UNIQUE,
  libelle   VARCHAR(100) NOT NULL,
  type      VARCHAR(30)  NOT NULL DEFAULT 'zone',
  -- types : quarantaine | impression | emballage | stock_interne | cession
  ordre     INTEGER      DEFAULT 0,   -- ordre dans le flux
  actif     BOOLEAN      DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zones par défaut AT3
INSERT INTO zones_at3 (code, libelle, type, ordre) VALUES
  ('EXTR',   'Extrusion (en cours)',         'extrusion',    1),
  ('QUAR',   'Zone de Quarantaine',           'quarantaine',  2),
  ('IMPR',   'Poste Impression',              'impression',   3),
  ('EMBL',   'Découpe & Emballage',           'emballage',    4),
  ('STKAT3', 'Stock Interne Atelier 3',       'stock_interne',5),
  ('MAGSIN', 'Magasin Central (destination)', 'magasin',      6)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. CONFIG OF → CHEF ATELIER AT3
--    Le chef atelier reçoit l'OF et valide la fiche de production :
--    composition confirmée, poids cible, instructions régleur, etc.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ordres_fabrication
  ADD COLUMN IF NOT EXISTS at3_statut_zone VARCHAR(30) DEFAULT 'nouveau';
  -- nouveau | composition | extrusion | quarantaine | impression | emballage | stock_at3 | cede

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
-- 3. BOBINES DE PRODUCTION
--    Unité physique produite par une extrudeuse.
--    Chaque bobine = 1 lot traçable avec son propre numéro.
--    Une bobine passe par les zones successivement.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bobines_production (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_bobine   VARCHAR(60) NOT NULL UNIQUE,  -- ex: BOB-OF-20260505-EX03-001
  numero_lot      VARCHAR(60),                   -- lot de traçabilité (partagé entre bobines même OF)
  of_id           INTEGER     REFERENCES ordres_fabrication(id),
  article_id      INTEGER     REFERENCES articles(id),
  machine_id      INTEGER     REFERENCES machines(id),
  operateur_id    UUID        REFERENCES utilisateurs(id),
  -- Données physiques
  poids_brut_kg   NUMERIC(10,3) DEFAULT 0,
  poids_net_kg    NUMERIC(10,3) DEFAULT 0,
  poids_mandrin_kg NUMERIC(10,3) DEFAULT 0,
  longueur_m      NUMERIC(10,2),                 -- longueur bobine en mètres
  -- Paramètres machine enregistrés
  temperature_c   NUMERIC(6,1),
  vitesse_m_min   NUMERIC(8,2),
  pression_bar    NUMERIC(6,2),
  -- Traçabilité de zone
  zone_actuelle_id INTEGER REFERENCES zones_at3(id),
  statut          VARCHAR(30) DEFAULT 'extrusion',
  -- extrusion | quarantaine | en_quarantaine | valide_impression
  -- | impression | impression_ok | emballage | stock_at3 | cede | rebut
  -- Contrôle qualité à chaque étape
  qc_quarantaine  JSONB DEFAULT '{}',  -- {ok:bool, observations:str, controleur_id}
  qc_impression   JSONB DEFAULT '{}',  -- {ok:bool, type_encre, observations}
  -- Timestamps de passage par zone
  heure_fin_extrusion   TIMESTAMPTZ,
  heure_entree_quar     TIMESTAMPTZ,
  heure_sortie_quar     TIMESTAMPTZ,
  heure_entree_impr     TIMESTAMPTZ,
  heure_sortie_impr     TIMESTAMPTZ,
  heure_entree_embl     TIMESTAMPTZ,
  heure_fin_embl        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bobines_of ON bobines_production(of_id);
CREATE INDEX IF NOT EXISTS idx_bobines_statut ON bobines_production(statut);
CREATE INDEX IF NOT EXISTS idx_bobines_zone ON bobines_production(zone_actuelle_id);
CREATE INDEX IF NOT EXISTS idx_bobines_lot ON bobines_production(numero_lot);

-- ─────────────────────────────────────────────────────────────
-- 4. MOUVEMENTS ENTRE ZONES AT3
--    Ticket de mouvement traçable à chaque transfert de zone.
--    Utilise le système existant mouvements_stock + lignes_mouvement
--    mais on ajoute une table dédiée AT3 pour plus de détail.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mouvements_at3 (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_ticket   VARCHAR(60) NOT NULL UNIQUE, -- ex: MVT-AT3-20260505-0001
  of_id           INTEGER     REFERENCES ordres_fabrication(id),
  zone_source_id  INTEGER     REFERENCES zones_at3(id),
  zone_dest_id    INTEGER     REFERENCES zones_at3(id),
  type_mouvement  VARCHAR(30) NOT NULL,
  -- extrusion_quarantaine | quarantaine_impression | impression_emballage
  -- | emballage_stock_at3 | stock_at3_magasin
  statut          VARCHAR(20) DEFAULT 'en_attente',
  -- en_attente | valide | rejete | annule
  -- Bobines concernées
  bobines_ids     JSONB DEFAULT '[]',    -- array d'UUIDs bobines
  nb_bobines      INTEGER DEFAULT 0,
  poids_total_kg  NUMERIC(12,3) DEFAULT 0,
  -- Acteurs
  cree_par        UUID REFERENCES utilisateurs(id),
  valide_par      UUID REFERENCES utilisateurs(id),
  date_mouvement  TIMESTAMPTZ DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  notes           TEXT,
  -- Ticket PDF
  ticket_genere   BOOLEAN DEFAULT false,
  ticket_path     VARCHAR(500),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mvt_at3_of ON mouvements_at3(of_id);
CREATE INDEX IF NOT EXISTS idx_mvt_at3_type ON mouvements_at3(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_mvt_at3_statut ON mouvements_at3(statut);

-- ─────────────────────────────────────────────────────────────
-- 5. CONTRÔLE IMPRESSION
--    Enregistrement des opérations d'impression sur chaque bobine
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controles_impression (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bobine_id       UUID        REFERENCES bobines_production(id),
  of_id           INTEGER     REFERENCES ordres_fabrication(id),
  operateur_id    UUID        REFERENCES utilisateurs(id),
  -- Paramètres impression
  type_impression VARCHAR(50),  -- jet_encre | laser | flexographie | serigraphie
  couleur_encre   VARCHAR(50),
  texte_imprime   TEXT,         -- texte/références à imprimer
  -- Résultat contrôle
  controle_ok     BOOLEAN DEFAULT false,
  nb_reprises     INTEGER DEFAULT 0,  -- nombre de reprises impression
  motif_reprise   TEXT,
  observations    TEXT,
  -- Timestamps
  heure_debut     TIMESTAMPTZ DEFAULT NOW(),
  heure_fin       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctrl_impr_bobine ON controles_impression(bobine_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_impr_of ON controles_impression(of_id);

-- ─────────────────────────────────────────────────────────────
-- 6. PALETTES D'EMBALLAGE
--    Résultat de la découpe/emballage : palette de sacs finis
--    prête pour le stock AT3 puis cession magasin.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS palettes_emballage (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_palette  VARCHAR(60) NOT NULL UNIQUE,  -- ex: PAL-OF-20260505-001
  of_id           INTEGER     REFERENCES ordres_fabrication(id),
  article_id      INTEGER     REFERENCES articles(id),
  numero_lot      VARCHAR(60),
  -- Bobines d'origine
  bobines_ids     JSONB DEFAULT '[]',
  -- Données physiques
  nb_sacs         INTEGER DEFAULT 0,
  poids_sacs_kg   NUMERIC(12,3) DEFAULT 0,
  poids_palette_kg NUMERIC(12,3) DEFAULT 0,  -- tare palette
  poids_total_kg  NUMERIC(12,3) DEFAULT 0,   -- sacs + palette
  -- Emballage
  type_emballage  VARCHAR(50),   -- film_etirable | carton | filet | vrac
  nb_couches      INTEGER,
  sacs_par_couche INTEGER,
  -- Étiquette
  etiquette_imprimee BOOLEAN DEFAULT false,
  qr_code         VARCHAR(255),              -- QR code traçabilité
  -- Localisation
  zone_id         INTEGER REFERENCES zones_at3(id),
  statut          VARCHAR(20) DEFAULT 'emballage',
  -- emballage | stock_at3 | en_cession | cede
  -- Acteurs
  emballeur_id    UUID REFERENCES utilisateurs(id),
  controleur_id   UUID REFERENCES utilisateurs(id),
  -- Ticket ESC/POS
  ticket_imprime  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pal_of ON palettes_emballage(of_id);
CREATE INDEX IF NOT EXISTS idx_pal_statut ON palettes_emballage(statut);
CREATE INDEX IF NOT EXISTS idx_pal_zone ON palettes_emballage(zone_id);
CREATE INDEX IF NOT EXISTS idx_pal_lot ON palettes_emballage(numero_lot);

-- ─────────────────────────────────────────────────────────────
-- 7. CESSIONS AT3 → MAGASIN CENTRAL
--    Le chef atelier crée un bon de cession regroupant des palettes.
--    Ce bon est lié à la table bons_cession existante + détail AT3.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cessions_at3 (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_cession  VARCHAR(60) NOT NULL UNIQUE, -- ex: CES-AT3-20260505-001
  of_id           INTEGER     REFERENCES ordres_fabrication(id),
  -- Lien vers le bon de cession existant (table bons_cession)
  bon_cession_id  INTEGER,  -- FK vers bons_cession.id si table existe
  -- Palettes concernées
  palettes_ids    JSONB DEFAULT '[]',
  nb_palettes     INTEGER DEFAULT 0,
  nb_sacs_total   INTEGER DEFAULT 0,
  poids_total_kg  NUMERIC(12,3) DEFAULT 0,
  -- Acteurs
  chef_atelier_id UUID REFERENCES utilisateurs(id),
  receptionnaire_id UUID REFERENCES utilisateurs(id),  -- magasinier
  -- Statuts
  statut          VARCHAR(20) DEFAULT 'brouillon',
  -- brouillon | soumis | accepte | rejete
  date_cession    TIMESTAMPTZ DEFAULT NOW(),
  date_reception  TIMESTAMPTZ,
  -- Documents
  pdf_path        VARCHAR(500),
  pdf_genere      BOOLEAN DEFAULT false,
  notes_chef      TEXT,
  notes_magasin   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ces_of ON cessions_at3(of_id);
CREATE INDEX IF NOT EXISTS idx_ces_statut ON cessions_at3(statut);

-- ─────────────────────────────────────────────────────────────
-- 8. NUMÉROTATION AUTOMATIQUE (séquences AT3)
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_bobine_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_mvt_at3_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_palette_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_cession_at3_num START 1 INCREMENT 1;

-- ─────────────────────────────────────────────────────────────
-- 9. FONCTIONS DE GÉNÉRATION DE NUMÉROS
-- ─────────────────────────────────────────────────────────────

-- Numéro de bobine : BOB-{OF}-{DATE}-{MACHINE}-{SEQ}
CREATE OR REPLACE FUNCTION gen_numero_bobine(p_of_num VARCHAR, p_machine_code VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'BOB-' || p_of_num || '-' ||
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         p_machine_code || '-' ||
         LPAD(nextval('seq_bobine_num')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Numéro de ticket mouvement AT3
CREATE OR REPLACE FUNCTION gen_numero_mvt_at3()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'MVT-AT3-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_mvt_at3_num')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Numéro de palette
CREATE OR REPLACE FUNCTION gen_numero_palette(p_of_num VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'PAL-' || p_of_num || '-' ||
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_palette_num')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Numéro de cession AT3
CREATE OR REPLACE FUNCTION gen_numero_cession_at3()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'CES-AT3-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_cession_at3_num')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 10. TRIGGER updated_at automatique
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_bobines_updated_at') THEN
    CREATE TRIGGER set_bobines_updated_at
      BEFORE UPDATE ON bobines_production
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_palettes_updated_at') THEN
    CREATE TRIGGER set_palettes_updated_at
      BEFORE UPDATE ON palettes_emballage
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 11. VUES UTILES POUR LE DASHBOARD AT3
-- ─────────────────────────────────────────────────────────────

-- Vue : état des bobines par OF et par zone
CREATE OR REPLACE VIEW vue_bobines_at3 AS
SELECT
  b.id, b.numero_bobine, b.numero_lot,
  b.statut, b.poids_net_kg, b.poids_brut_kg,
  b.created_at,
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

-- Vue : stock interne AT3 par article (palettes en stock_at3)
CREATE OR REPLACE VIEW vue_stock_at3 AS
SELECT
  a.id AS article_id,
  a.code AS article_code,
  a.designation AS article_nom,
  COUNT(p.id)            AS nb_palettes,
  SUM(p.nb_sacs)         AS nb_sacs_total,
  SUM(p.poids_sacs_kg)   AS poids_net_total_kg,
  o.numero_of
FROM palettes_emballage p
JOIN articles a ON a.id = p.article_id
JOIN ordres_fabrication o ON o.id = p.of_id
WHERE p.statut = 'stock_at3'
GROUP BY a.id, a.code, a.designation, o.numero_of;

-- Vue : tableau de bord flux AT3 par OF
CREATE OR REPLACE VIEW vue_flux_at3 AS
SELECT
  o.id AS of_id,
  o.numero_of,
  o.at3_statut_zone,
  o.at3_composition_validee,
  o.at3_poids_cible_kg,
  a.code AS article_code,
  a.designation AS article_nom,
  o.quantite AS qte_commandee,
  -- Bobines
  COUNT(DISTINCT b.id)                                          AS nb_bobines_total,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='quarantaine')   AS nb_bobines_quar,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='impression')    AS nb_bobines_impr,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='emballage')     AS nb_bobines_embl,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut='stock_at3')     AS nb_bobines_stock,
  COALESCE(SUM(b.poids_net_kg), 0)                             AS poids_produit_kg,
  -- Palettes
  COUNT(DISTINCT p.id)                                          AS nb_palettes,
  COALESCE(SUM(p.nb_sacs), 0)                                  AS nb_sacs_total
FROM ordres_fabrication o
LEFT JOIN articles a ON a.id = o.article_id
LEFT JOIN bobines_production b ON b.of_id = o.id
LEFT JOIN palettes_emballage p ON p.of_id = o.id
WHERE o.statut NOT IN ('annule', 'archive')
GROUP BY o.id, o.numero_of, o.at3_statut_zone, o.at3_composition_validee,
         o.at3_poids_cible_kg, o.quantite, a.code, a.designation;

-- ─────────────────────────────────────────────────────────────
-- 12. DONNÉES INITIALES — Mettre à jour les OF existants
-- ─────────────────────────────────────────────────────────────
UPDATE ordres_fabrication
SET at3_statut_zone = 'nouveau'
WHERE at3_statut_zone IS NULL;

-- Ajouter les permissions AT3 pour les rôles concernés
INSERT INTO permissions_roles (role, module, peut_voir, peut_creer, peut_modifier, peut_supprimer)
VALUES
  ('chef_atelier',      'at3_flux',  true, true,  true,  false),
  ('technicien_regleur','at3_flux',  true, true,  true,  false),
  ('operateur',         'at3_flux',  true, true,  false, false),
  ('emballeur',         'at3_flux',  true, true,  false, false),
  ('controleur_qualite','at3_flux',  true, true,  false, false),
  ('responsable_stock', 'at3_flux',  true, false, false, false),
  ('directeur',         'at3_flux',  true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

SELECT 'Migration AT3 FLUX COMPLET v1.0 ✓' AS statut;
SELECT COUNT(*) || ' zones AT3 créées' AS info FROM zones_at3;
