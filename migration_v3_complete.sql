-- ============================================================
-- NAIdo — Migration v3 COMPLETE
-- Transforme la table articles v1 → v3 complète
-- ============================================================

-- 1. Renommer reference → code (si pas déjà fait)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='articles' AND column_name='reference'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='articles' AND column_name='code'
  ) THEN
    ALTER TABLE articles RENAME COLUMN reference TO code;
    RAISE NOTICE 'Colonne reference renommée en code';
  ELSE
    RAISE NOTICE 'Colonne code déjà existante ou reference absente';
  END IF;
END $$;

-- 2. Renommer cadence_heure → cadence_theorique_kg_h
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='cadence_heure')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='cadence_theorique_kg_h')
  THEN
    ALTER TABLE articles RENAME COLUMN cadence_heure TO cadence_theorique_kg_h;
    RAISE NOTICE 'cadence_heure renommée';
  END IF;
END $$;

-- 3. Renommer type_produit → type_article
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='type_produit')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='type_article')
  THEN
    ALTER TABLE articles RENAME COLUMN type_produit TO type_article;
    ALTER TABLE articles ALTER COLUMN type_article SET DEFAULT 'produit_fini';
    RAISE NOTICE 'type_produit renommé en type_article';
  END IF;
END $$;

-- 4. Renommer dimensions → dimensions_libelle
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='dimensions')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='dimensions_libelle')
  THEN
    ALTER TABLE articles RENAME COLUMN dimensions TO dimensions_libelle;
  END IF;
END $$;

-- 5. Ajouter toutes les colonnes manquantes
ALTER TABLE articles ADD COLUMN IF NOT EXISTS code_barre VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS designation_fr VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS designation_ar VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS famille_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS sous_famille_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS categorie_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS unite_mesure_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS unite_mesure_achat_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS longueur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS largeur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS hauteur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_theorique_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_reel_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_tare_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS epaisseur_mm NUMERIC(8,3);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS densite NUMERIC(8,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temperature_fusion NUMERIC(6,1);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temperature_traitement NUMERIC(6,1);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS prix_achat NUMERIC(12,4) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS prix_vente NUMERIC(12,4) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS prix_cession_interne NUMERIC(12,4) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS devise VARCHAR(10) DEFAULT 'DZD';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS stock_mini NUMERIC(12,3) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS stock_maxi NUMERIC(12,3);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS stock_securite NUMERIC(12,3) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS delai_appro_jours INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS dlc_jours INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS dluo_jours INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temperature_stockage_min NUMERIC(5,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temperature_stockage_max NUMERIC(5,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS conditions_stockage TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS allergenes TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS points_ccp BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS description_ccp TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tracabilite_type VARCHAR(20) DEFAULT 'lot';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS format_lot VARCHAR(100) DEFAULT 'LOT-YYYYMMDD-001';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS normes_iso TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fournisseur VARCHAR(200);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reference_fournisseur VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS risques_securite TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS epi_requis TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS composition JSONB DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS matieres_principales JSONB DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS atelier_production_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fiche_technique_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fiche_securite_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS plan_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Contrainte unique sur code si pas déjà là
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name='articles' AND constraint_name='articles_code_key'
  ) THEN
    ALTER TABLE articles ADD CONSTRAINT articles_code_key UNIQUE (code);
    RAISE NOTICE 'Contrainte UNIQUE sur code ajoutée';
  END IF;
END $$;

-- 7. Mettre à jour les articles existants avec type par défaut
UPDATE articles SET type_article = 'produit_fini' WHERE type_article IS NULL;

-- 8. Utilisateurs - colonnes manquantes
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS matricule VARCHAR(30);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS habilitations JSONB DEFAULT '[]';
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS formations JSONB DEFAULT '[]';
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;

-- 9. Clients - colonnes manquantes
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'client';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ville VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pays VARCHAR(100) DEFAULT 'Algérie';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_principal VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limite NUMERIC(15,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS delai_paiement_jours INTEGER DEFAULT 30;

-- 10. Ordres de fabrication - colonnes manquantes
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS atelier_id INTEGER;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS poids_theorique_total_kg NUMERIC(12,4);
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS poids_reel_total_kg NUMERIC(12,4) DEFAULT 0;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS temps_reel_min INTEGER DEFAULT 0;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS date_lancement DATE;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS date_livraison_reelle DATE;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS reference_sage VARCHAR(100);
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS instructions TEXT;

-- 11. Rôles manquants
INSERT INTO roles (nom, description) VALUES
  ('super_admin','Accès total'),('directeur','Direction'),
  ('magasinier','Magasin'),('achat','Achats'),('vente','Ventes'),
  ('rh','RH'),('technicien','GMAO'),('qhse','QHSE')
ON CONFLICT (nom) DO NOTHING;

-- 12. Mettre admin en super_admin
UPDATE utilisateurs 
SET role_id = (SELECT id FROM roles WHERE nom='super_admin')
WHERE login='admin';

-- 13. Recréer les vues
DROP VIEW IF EXISTS vue_mouvements CASCADE;
CREATE VIEW vue_mouvements AS
SELECT ms.id, ms.numero_bon, ms.type_mouvement, ms.statut,
  ms.date_mouvement, ms.created_at, ms.notes,
  ms.atelier_source_id, ms.atelier_dest_id,
  ms.cree_par, ms.valide_par, ms.pdf_path, ms.of_id,
  as1.code AS source_code, as1.libelle AS source_libelle,
  as2.code AS dest_code, as2.libelle AS dest_libelle,
  COUNT(lm.id) AS nb_lignes,
  COALESCE(SUM(lm.poids_reel_kg), 0) AS poids_total_kg,
  COALESCE(SUM(lm.montant_total), 0) AS montant_total
FROM mouvements_stock ms
LEFT JOIN ateliers as1 ON as1.id = ms.atelier_source_id
LEFT JOIN ateliers as2 ON as2.id = ms.atelier_dest_id
LEFT JOIN lignes_mouvement lm ON lm.mouvement_id = ms.id
GROUP BY ms.id, as1.code, as1.libelle, as2.code, as2.libelle;

DROP VIEW IF EXISTS vue_rapports_journaliers CASCADE;
CREATE VIEW vue_rapports_journaliers AS
SELECT rj.*,
  at.libelle AS atelier_nom,
  a.code AS article_code,
  a.designation AS article_nom,
  o.numero_of
FROM rapports_journaliers rj
LEFT JOIN ateliers at ON at.id = rj.atelier_id
LEFT JOIN articles a ON a.id = rj.article_id
LEFT JOIN ordres_fabrication o ON o.id = rj.of_id;

DROP VIEW IF EXISTS vue_qhse_dashboard CASCADE;
CREATE VIEW vue_qhse_dashboard AS
SELECT
  COUNT(*) FILTER (WHERE statut='ouvert') AS nc_ouvertes,
  COUNT(*) FILTER (WHERE statut='en_cours') AS nc_en_cours,
  COUNT(*) FILTER (WHERE statut='clos') AS nc_closes,
  COUNT(*) FILTER (WHERE gravite='critique' AND statut!='clos') AS nc_critiques,
  COUNT(*) FILTER (WHERE ipr_amdec > 100) AS ipr_eleve,
  ROUND(AVG(EXTRACT(DAY FROM (COALESCE(date_cloture::TIMESTAMP, NOW()) - date_detection::TIMESTAMP))),1) AS delai_moyen_jours
FROM non_conformites;

SELECT 'Migration v3 complète terminée ✓' AS statut;
