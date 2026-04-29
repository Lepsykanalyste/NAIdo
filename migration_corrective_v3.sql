-- ============================================================
-- NAIdo — Migration corrective v3
-- Ajoute les colonnes manquantes aux tables existantes
-- ============================================================

-- Colonnes manquantes sur articles (table créée en v1 sans ces champs)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS famille_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS sous_famille_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS categorie_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS unite_mesure_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS unite_mesure_achat_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS unite_mesure_vente_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS longueur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS largeur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS hauteur_mm NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS dimensions_libelle VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_theorique_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_reel_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_tare_kg NUMERIC(10,4);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS poids_mandrin_kg NUMERIC(10,4) DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS couleur VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS matiere VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS epaisseur_mm NUMERIC(8,3);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cadence_theorique_kg_h NUMERIC(10,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temps_reglage_min INTEGER DEFAULT 30;
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
ALTER TABLE articles ADD COLUMN IF NOT EXISTS allergenes TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS points_ccp BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS description_ccp TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tracabilite_type VARCHAR(20) DEFAULT 'lot';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS type_article VARCHAR(20) DEFAULT 'produit_fini';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS normes_iso TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fiche_technique_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS plan_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS code_barre VARCHAR(100);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS designation_fr VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS designation_ar VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Colonnes manquantes sur utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS matricule VARCHAR(30);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS habilitations JSONB DEFAULT '[]';
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS formations JSONB DEFAULT '[]';
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;

-- Colonnes manquantes sur clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'client';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ville VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pays VARCHAR(100) DEFAULT 'Algérie';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_principal VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limite NUMERIC(15,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS delai_paiement_jours INTEGER DEFAULT 30;

-- Ajouter colonnes manquantes sur ordres_fabrication
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS atelier_id INTEGER;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS unite_id INTEGER;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS poids_theorique_total_kg NUMERIC(12,4);
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS poids_reel_total_kg NUMERIC(12,4) DEFAULT 0;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS temps_reel_min INTEGER DEFAULT 0;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS date_lancement DATE;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS date_livraison_reelle DATE;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS reference_sage VARCHAR(100);
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS date_import TIMESTAMPTZ;
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Recréer la vue stock global (compatible avec les nouvelles colonnes)
DROP VIEW IF EXISTS vue_stock_global;
CREATE VIEW vue_stock_global AS
SELECT
  a.id,
  a.code,
  a.designation,
  a.poids_theorique_kg,
  a.type_article,
  a.stock_mini,
  f.libelle AS famille,
  um.code AS unite,
  COALESCE(SUM(sa.qte_disponible), 0) AS stock_total_dispo,
  COALESCE(SUM(sa.qte_reservee), 0) AS stock_total_reserve,
  COALESCE(SUM(sa.valeur_stock), 0) AS valeur_totale,
  CASE WHEN COALESCE(SUM(sa.qte_disponible), 0) <= COALESCE(a.stock_mini, 0) THEN true ELSE false END AS alerte_stock_bas
FROM articles a
LEFT JOIN familles_articles f ON f.id = a.famille_id
LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
LEFT JOIN stock_articles sa ON sa.article_id = a.id
WHERE a.actif = true
GROUP BY a.id, a.code, a.designation, a.poids_theorique_kg, a.type_article, a.stock_mini, f.libelle, um.code;

-- Recréer vue mouvements (sans doublon numero_bon)
DROP VIEW IF EXISTS vue_mouvements;
CREATE VIEW vue_mouvements AS
SELECT
  ms.id, ms.numero_bon, ms.type_mouvement, ms.statut,
  ms.date_mouvement, ms.created_at, ms.notes,
  ms.atelier_source_id, ms.atelier_dest_id,
  ms.emplacement_source_id, ms.emplacement_dest_id,
  ms.cree_par, ms.valide_par, ms.receptionne_par,
  ms.date_validation, ms.date_reception,
  ms.pdf_path, ms.of_id,
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

-- Recréer vue QHSE (correction EXTRACT)
DROP VIEW IF EXISTS vue_qhse_dashboard;
CREATE VIEW vue_qhse_dashboard AS
SELECT
  COUNT(*) FILTER (WHERE statut='ouvert') AS nc_ouvertes,
  COUNT(*) FILTER (WHERE statut='en_cours') AS nc_en_cours,
  COUNT(*) FILTER (WHERE statut='clos') AS nc_closes,
  COUNT(*) FILTER (WHERE gravite='critique' AND statut!='clos') AS nc_critiques,
  COUNT(*) FILTER (WHERE ipr_amdec > 100) AS ipr_eleve,
  ROUND(AVG(EXTRACT(DAY FROM (COALESCE(date_cloture::TIMESTAMP, NOW()) - date_detection::TIMESTAMP))),1) AS delai_moyen_jours
FROM non_conformites;

-- Ajouter rôles manquants
INSERT INTO roles (nom, description) VALUES
  ('super_admin', 'Accès total au système'),
  ('directeur', 'Direction'),
  ('magasinier', 'Gestion stock'),
  ('achat', 'Service achats'),
  ('vente', 'Service ventes'),
  ('rh', 'Ressources humaines'),
  ('technicien', 'GMAO'),
  ('qhse', 'QHSE')
ON CONFLICT (nom) DO NOTHING;

-- Mettre admin en super_admin
UPDATE utilisateurs SET role_id = (SELECT id FROM roles WHERE nom='super_admin') WHERE login='admin';

SELECT 'Migration corrective v3 terminée avec succès' AS statut;
