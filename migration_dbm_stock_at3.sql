-- ============================================================
-- NAIdo — Migration DBM + Stock AT3 v1.0
-- Demande de Besoin en Matières + Stock Interne AT3
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. STOCK INTERNE AT3
--    Entrées MP depuis Magasin MP
--    Sorties MP vers production
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_at3 (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id      UUID REFERENCES articles(id),
  famille_id      INTEGER REFERENCES familles_articles(id),
  -- Quantités
  qte_disponible  NUMERIC(12,3) DEFAULT 0,
  qte_reservee    NUMERIC(12,3) DEFAULT 0,  -- réservée pour un OF en cours
  qte_consommee   NUMERIC(12,3) DEFAULT 0,  -- consommée en production
  -- Traçabilité
  numero_lot      VARCHAR(60),
  date_entree     TIMESTAMPTZ DEFAULT NOW(),
  date_peremption TIMESTAMPTZ,
  -- Source
  dbm_id          UUID,  -- DBM d'origine
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_at3_article ON stock_at3(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_at3_famille ON stock_at3(famille_id);

-- ─────────────────────────────────────────────────────────────
-- 2. DEMANDES DE BESOIN EN MATIÈRES (DBM)
--    AT3 → Magasin MP
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dbm (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_dbm      VARCHAR(60) NOT NULL UNIQUE,  -- DBM-AT3-20260505-0001
  of_id           UUID REFERENCES ordres_fabrication(id),
  atelier_id      INTEGER REFERENCES ateliers(id),  -- AT3 = 1
  magasin_id      INTEGER REFERENCES ateliers(id),  -- MAG-MP = 16
  -- Statuts
  statut          VARCHAR(20) DEFAULT 'en_attente',
  -- en_attente | approuve | en_preparation | livre | partiel | annule
  -- Urgence
  urgence         BOOLEAN DEFAULT false,
  date_besoin     DATE,  -- date à laquelle les MP sont nécessaires
  -- Acteurs
  demandeur_id    UUID REFERENCES utilisateurs(id),
  approuve_par    UUID REFERENCES utilisateurs(id),
  livre_par       UUID REFERENCES utilisateurs(id),
  -- Dates
  date_demande    TIMESTAMPTZ DEFAULT NOW(),
  date_approbation TIMESTAMPTZ,
  date_livraison  TIMESTAMPTZ,
  -- Notes
  notes_demandeur TEXT,
  notes_magasin   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dbm_of     ON dbm(of_id);
CREATE INDEX IF NOT EXISTS idx_dbm_statut ON dbm(statut);
CREATE INDEX IF NOT EXISTS idx_dbm_mag    ON dbm(magasin_id);

-- Séquence numérotation DBM
CREATE SEQUENCE IF NOT EXISTS seq_dbm_num START 1 INCREMENT 1;

-- ─────────────────────────────────────────────────────────────
-- 3. LIGNES DBM (détail par MP)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dbm_lignes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dbm_id          UUID REFERENCES dbm(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id),
  famille_id      INTEGER REFERENCES familles_articles(id),
  -- Quantités
  qte_demandee    NUMERIC(12,3) NOT NULL,
  qte_livree      NUMERIC(12,3) DEFAULT 0,
  qte_restante    NUMERIC(12,3) GENERATED ALWAYS AS (qte_demandee - qte_livree) STORED,
  unite           VARCHAR(20) DEFAULT 'kg',
  -- Notes
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dbm_lignes_dbm ON dbm_lignes(dbm_id);

-- ─────────────────────────────────────────────────────────────
-- 4. MOUVEMENTS STOCK AT3
--    Traçabilité de chaque entrée/sortie MP dans l'AT3
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mouvements_stock_at3 (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_mvt      VARCHAR(60) NOT NULL UNIQUE,
  type_mvt        VARCHAR(20) NOT NULL,
  -- entree_dbm | sortie_production | retour_magasin | inventaire | perte
  article_id      UUID REFERENCES articles(id),
  quantite        NUMERIC(12,3) NOT NULL,
  unite           VARCHAR(20) DEFAULT 'kg',
  -- Références
  dbm_id          UUID REFERENCES dbm(id),
  of_id           UUID REFERENCES ordres_fabrication(id),
  stock_at3_id    UUID REFERENCES stock_at3(id),
  -- Acteur
  operateur_id    UUID REFERENCES utilisateurs(id),
  notes           TEXT,
  date_mvt        TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS seq_mvt_stock_at3_num START 1 INCREMENT 1;

-- ─────────────────────────────────────────────────────────────
-- 5. DÉCLARATIONS DE PRODUCTION
--    Consommation réelle MP par OF
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declarations_production (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_decl     VARCHAR(60) NOT NULL UNIQUE,
  of_id           UUID REFERENCES ordres_fabrication(id),
  atelier_id      INTEGER REFERENCES ateliers(id),
  -- Production réelle
  poids_produit_kg   NUMERIC(12,3) DEFAULT 0,
  poids_dechets_kg   NUMERIC(12,3) DEFAULT 0,
  poids_rebuts_kg    NUMERIC(12,3) DEFAULT 0,
  -- Temps
  temps_reel_min  INTEGER DEFAULT 0,
  -- Statut
  statut          VARCHAR(20) DEFAULT 'brouillon',
  -- brouillon | soumis | valide
  -- Acteurs
  declare_par     UUID REFERENCES utilisateurs(id),
  valide_par      UUID REFERENCES utilisateurs(id),
  -- Dates
  date_declaration TIMESTAMPTZ DEFAULT NOW(),
  date_validation  TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decl_of ON declarations_production(of_id);

-- ─────────────────────────────────────────────────────────────
-- 6. LIGNES DÉCLARATION (MP consommées)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declaration_lignes_mp (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id  UUID REFERENCES declarations_production(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id),
  famille_id      INTEGER REFERENCES familles_articles(id),
  -- Quantités
  qte_prevue_kg   NUMERIC(12,3) DEFAULT 0,  -- selon composition OF
  qte_reelle_kg   NUMERIC(12,3) DEFAULT 0,  -- réellement consommée
  qte_restante_kg NUMERIC(12,3) DEFAULT 0,  -- reliquat → retour stock AT3
  ecart_kg        NUMERIC(12,3) GENERATED ALWAYS AS (qte_reelle_kg - qte_prevue_kg) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. FONCTIONS NUMÉROTATION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gen_numero_dbm()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'DBM-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_dbm_num')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gen_numero_decl()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'DECL-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_mvt_stock_at3_num')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 8. VUES
-- ─────────────────────────────────────────────────────────────

-- Vue stock AT3 consolidé par article
CREATE OR REPLACE VIEW vue_stock_at3_consolidé AS
SELECT
  a.id AS article_id,
  a.code, a.designation, a.type_article,
  f.libelle AS famille_libelle, f.code AS famille_code,
  COALESCE(SUM(s.qte_disponible), 0) AS qte_disponible,
  COALESCE(SUM(s.qte_reservee),   0) AS qte_reservee,
  COALESCE(SUM(s.qte_consommee),  0) AS qte_consommee
FROM articles a
LEFT JOIN familles_articles f ON f.id = a.famille_id
LEFT JOIN stock_at3 s ON s.article_id = a.id
WHERE a.type_article = 'matiere_premiere'
GROUP BY a.id, a.code, a.designation, a.type_article, f.libelle, f.code;

-- Vue DBM avec totaux
CREATE OR REPLACE VIEW vue_dbm AS
SELECT
  d.*,
  o.numero_of,
  at.libelle AS atelier_libelle,
  mag.libelle AS magasin_libelle,
  u.nom || ' ' || u.prenom AS demandeur_nom,
  COUNT(dl.id) AS nb_lignes,
  COALESCE(SUM(dl.qte_demandee), 0) AS poids_total_demande,
  COALESCE(SUM(dl.qte_livree), 0) AS poids_total_livre
FROM dbm d
LEFT JOIN ordres_fabrication o  ON o.id  = d.of_id
LEFT JOIN ateliers at           ON at.id = d.atelier_id
LEFT JOIN ateliers mag          ON mag.id = d.magasin_id
LEFT JOIN utilisateurs u        ON u.id  = d.demandeur_id
LEFT JOIN dbm_lignes dl         ON dl.dbm_id = d.id
GROUP BY d.id, o.numero_of, at.libelle, mag.libelle, u.nom, u.prenom;

-- ─────────────────────────────────────────────────────────────
-- 9. PERMISSIONS
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions_roles (role, module, peut_voir, peut_creer, peut_modifier, peut_supprimer)
VALUES
  ('chef_atelier',  'dbm',        true, true,  true,  false),
  ('chef_atelier',  'stock_at3',  true, true,  true,  false),
  ('chef_atelier',  'declarations',true,true,  true,  false),
  ('magasinier_mp', 'dbm',        true, false, true,  false),
  ('magasinier_mp', 'stock_at3',  true, false, false, false),
  ('directeur',     'dbm',        true, false, false, false),
  ('directeur',     'stock_at3',  true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 10. MENU MAGASINIER MP
-- ─────────────────────────────────────────────────────────────
-- Le compte mag_mp verra : dashboard, dbm (réception), stock_at3 (son stock MP)

SELECT 'Migration DBM + Stock AT3 v1.0 ✓' AS statut;
SELECT COUNT(*) || ' tables créées' AS info
FROM information_schema.tables
WHERE table_name IN ('stock_at3','dbm','dbm_lignes','mouvements_stock_at3','declarations_production','declaration_lignes_mp');
