-- ============================================================
-- NAIdo v3.2 — Sécurité, Permissions, Paramètres Système
-- ============================================================

-- Table permissions par rôle (paramétrable)
CREATE TABLE IF NOT EXISTS permissions_roles (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    peut_voir BOOLEAN DEFAULT true,
    peut_creer BOOLEAN DEFAULT false,
    peut_modifier BOOLEAN DEFAULT false,
    peut_supprimer BOOLEAN DEFAULT false,
    voir_finance BOOLEAN DEFAULT false,  -- Voir les valeurs monétaires
    UNIQUE(role, module)
);

-- Paramètres système
CREATE TABLE IF NOT EXISTS parametres_systeme (
    cle VARCHAR(100) PRIMARY KEY,
    valeur TEXT,
    type_valeur VARCHAR(20) DEFAULT 'string',  -- string, boolean, number, json
    description TEXT,
    modifiable_par VARCHAR(50) DEFAULT 'super_admin',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs d'activité
CREATE TABLE IF NOT EXISTS logs_activite (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID REFERENCES utilisateurs(id),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    ressource_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON logs_activite(utilisateur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_module ON logs_activite(module, created_at DESC);

-- Insérer les paramètres par défaut
INSERT INTO parametres_systeme (cle, valeur, type_valeur, description, modifiable_par) VALUES
    ('ia_enabled', 'true', 'boolean', 'Activer l''assistant IA', 'super_admin'),
    ('ia_modele', 'claude-sonnet-4-20250514', 'string', 'Modèle IA utilisé', 'super_admin'),
    ('ia_contexte_entreprise', 'NAI — Usine de fabrication de sacs plastiques, Côte d''Ivoire', 'string', 'Contexte entreprise pour l''IA', 'super_admin'),
    ('tarif_kwh_cie', '105', 'number', 'Tarif kWh CIE en FCFA', 'directeur'),
    ('taux_rebut_alerte', '5', 'number', 'Seuil alerte taux rebut (%)', 'chef_atelier'),
    ('stock_alerte_jours', '7', 'number', 'Jours avant alerte rupture stock', 'responsable_stock'),
    ('maintenance_alerte_jours', '7', 'number', 'Jours avant alerte maintenance', 'technicien_gmao'),
    ('habilitation_alerte_jours', '30', 'number', 'Jours avant alerte expiration habilitation', 'responsable_qhse'),
    ('devise', 'FCFA', 'string', 'Devise affichée', 'super_admin'),
    ('nom_entreprise', 'NAI', 'string', 'Nom entreprise', 'super_admin'),
    ('nom_atelier_principal', 'Atelier 3', 'string', 'Nom atelier principal', 'super_admin'),
    ('rapport_auto_enabled', 'true', 'boolean', 'Rapports automatiques hebdo', 'directeur'),
    ('nb_extrudeuses', '9', 'number', 'Nombre d''extrudeuses AT3', 'super_admin'),
    ('nb_soudeuses', '5', 'number', 'Nombre de soudeuses AT3', 'super_admin'),
    ('finance_visible_roles', '["super_admin","directeur","comptable"]', 'json', 'Rôles pouvant voir les données financières', 'super_admin')
ON CONFLICT (cle) DO NOTHING;

-- Permissions par défaut pour chaque rôle
INSERT INTO permissions_roles (role, module, peut_voir, peut_creer, peut_modifier, peut_supprimer, voir_finance) VALUES
-- SUPER ADMIN
('super_admin','*',true,true,true,true,true),
-- DIRECTEUR
('directeur','dashboard',true,false,false,false,true),
('directeur','production',true,true,true,false,false),
('directeur','planning',true,true,true,false,false),
('directeur','stock',true,true,true,false,true),
('directeur','articles',true,true,true,false,true),
('directeur','vente',true,true,true,false,true),
('directeur','achat',true,true,true,false,true),
('directeur','qhse',true,true,true,false,false),
('directeur','rh',true,true,true,false,true),
('directeur','gmao',true,true,true,false,true),
('directeur','kpi',true,false,false,false,true),
('directeur','ia',true,true,false,false,false),
('directeur','utilisateurs',true,true,true,false,false),
-- CHEF ATELIER
('chef_atelier','dashboard',true,false,false,false,false),
('chef_atelier','production',true,true,true,false,false),
('chef_atelier','planning',true,true,true,false,false),
('chef_atelier','stock',true,true,true,false,false),
('chef_atelier','bons_cession',true,true,true,false,false),
('chef_atelier','qhse',true,true,false,false,false),
('chef_atelier','gmao',true,true,true,false,false),
('chef_atelier','kpi',true,false,false,false,false),
('chef_atelier','ia',true,true,false,false,false),
-- RESPONSABLE QHSE
('responsable_qhse','dashboard',true,false,false,false,false),
('responsable_qhse','qhse',true,true,true,true,false),
('responsable_qhse','gmao',true,false,false,false,false),
('responsable_qhse','production',true,false,false,false,false),
('responsable_qhse','kpi',true,false,false,false,false),
('responsable_qhse','ia',true,true,false,false,false),
-- RESPONSABLE RH
('responsable_rh','dashboard',true,false,false,false,false),
('responsable_rh','rh',true,true,true,true,true),
('responsable_rh','utilisateurs',true,true,true,false,false),
-- TECHNICIEN REGLEUR
('technicien_regleur','dashboard',true,false,false,false,false),
('technicien_regleur','production',true,true,true,false,false),
('technicien_regleur','gmao',true,true,true,false,false),
('technicien_regleur','stock',true,false,false,false,false),
-- CONTROLEUR QUALITE
('controleur_qualite','dashboard',true,false,false,false,false),
('controleur_qualite','production',true,true,true,false,false),
('controleur_qualite','qhse',true,true,true,false,false),
('controleur_qualite','stock',true,false,false,false,false),
-- OPERATEUR
('operateur','dashboard',true,false,false,false,false),
('operateur','production',true,true,true,false,false),
-- TECHNICIEN GMAO
('technicien_gmao','dashboard',true,false,false,false,false),
('technicien_gmao','gmao',true,true,true,false,false),
('technicien_gmao','production',true,false,false,false,false),
-- COMPTABLE
('comptable','dashboard',true,false,false,false,true),
('comptable','vente',true,true,true,false,true),
('comptable','achat',true,true,true,false,true),
('comptable','stock',true,false,false,false,true),
('comptable','kpi',true,false,false,false,true),
-- COMMERCIAL
('commercial','dashboard',true,false,false,false,false),
('commercial','vente',true,true,true,false,false),
('commercial','clients',true,true,true,false,false),
('commercial','articles',true,false,false,false,false),
-- RESPONSABLE STOCK
('responsable_stock','dashboard',true,false,false,false,false),
('responsable_stock','stock',true,true,true,false,false),
('responsable_stock','articles',true,true,true,false,false),
('responsable_stock','bons_cession',true,true,true,false,false),
('responsable_stock','achat',true,false,false,false,false),
-- EMBALLEUR
('emballeur','dashboard',true,false,false,false,false),
('emballeur','production',true,true,false,false,false)
ON CONFLICT (role, module) DO NOTHING;

SELECT 'Migration v3.2 Sécurité OK ✓' AS statut;

-- Paramètres IA Groq/Mistral
INSERT INTO parametres_systeme (cle, valeur, type_valeur, description, modifiable_par) VALUES
    ('groq_api_key', '', 'string', 'Clé API Groq (gratuit sur console.groq.com)', 'super_admin'),
    ('mistral_api_key', '', 'string', 'Clé API Mistral (gratuit sur console.mistral.ai)', 'super_admin'),
    ('ia_provider_priorite', 'groq', 'string', 'Provider IA prioritaire (groq ou mistral)', 'super_admin'),
    ('ia_groq_model', 'llama-3.3-70b-versatile', 'string', 'Modèle Groq utilisé', 'super_admin'),
    ('ia_mistral_model', 'mistral-large-latest', 'string', 'Modèle Mistral utilisé', 'super_admin')
ON CONFLICT (cle) DO NOTHING;

SELECT 'Paramètres IA OK' AS statut;

-- Colonnes pour la GED documentaire enrichie
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS contenu_texte TEXT;          -- Texte extrait
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS resume_ia TEXT;              -- Résumé généré par IA
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS mots_cles_auto TEXT[];       -- Mots-clés extraits
ALTER TABLE documents_qhse ADD COLUMN IF NOT EXISTS nb_mots INTEGER;

-- Index full-text pour recherche dans le contenu
CREATE INDEX IF NOT EXISTS idx_doc_fulltext ON documents_qhse
    USING gin(to_tsvector('french', coalesce(contenu_texte,'') || ' ' || coalesce(titre,'') || ' ' || coalesce(mots_cles,'')));

CREATE INDEX IF NOT EXISTS idx_doc_titre ON documents_qhse(titre);
CREATE INDEX IF NOT EXISTS idx_doc_code ON documents_qhse(code);

SELECT 'GED colonnes OK' AS statut;
