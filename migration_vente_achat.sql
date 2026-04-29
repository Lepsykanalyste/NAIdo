-- ============================================================
-- NAIdo — Migration Vente / Achat / Clients / Fournisseurs
-- Inspiré de Leinad (lieandtenant)
-- ============================================================

-- CLIENTS (inspiré de general.Customer de Leinad)
CREATE TABLE IF NOT EXISTS clients_complet (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(10) DEFAULT 'B2B' CHECK (type IN ('B2B','B2C','B2G')),
  raison_sociale VARCHAR(255) NOT NULL,
  contact_nom VARCHAR(200),
  telephone VARCHAR(50),
  telephone2 VARCHAR(50),
  email VARCHAR(100),
  adresse TEXT,
  ville VARCHAR(100),
  pays VARCHAR(100) DEFAULT 'Algérie',
  nif VARCHAR(50),
  rc VARCHAR(50),
  ai VARCHAR(50),
  nis VARCHAR(50),
  condition_paiement VARCHAR(20) DEFAULT '30_jours'
    CHECK (condition_paiement IN ('immediat','30_jours','60_jours','90_jours','custom')),
  delai_paiement_jours INTEGER DEFAULT 30,
  credit_limite NUMERIC(15,2) DEFAULT 0,
  solde_actuel NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FOURNISSEURS (inspiré de accounting.Supplier de Leinad)
CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  raison_sociale VARCHAR(255) NOT NULL,
  contact_nom VARCHAR(200),
  telephone VARCHAR(50),
  email VARCHAR(100),
  adresse TEXT,
  ville VARCHAR(100),
  pays VARCHAR(100) DEFAULT 'Algérie',
  nif VARCHAR(50),
  condition_paiement VARCHAR(20) DEFAULT '30_jours',
  delai_paiement_jours INTEGER DEFAULT 30,
  credit_limite NUMERIC(15,2) DEFAULT 0,
  solde_actuel NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENTES (inspiré de sales.Sale de Leinad)
CREATE SEQUENCE IF NOT EXISTS vente_seq START 1000;
CREATE TABLE IF NOT EXISTS ventes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_vente VARCHAR(50) UNIQUE NOT NULL,
  type_vente VARCHAR(10) DEFAULT 'B2B' CHECK (type_vente IN ('B2B','B2C','B2G')),
  statut VARCHAR(20) DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','confirme','livre','facture','paye','annule')),
  date_vente TIMESTAMPTZ DEFAULT NOW(),
  date_livraison_prevue DATE,
  client_id UUID REFERENCES clients_complet(id),
  -- Montants (HT / TVA / TTC)
  montant_ht NUMERIC(15,2) DEFAULT 0,
  taux_tva NUMERIC(5,2) DEFAULT 19,
  montant_tva NUMERIC(15,2) DEFAULT 0,
  montant_ttc NUMERIC(15,2) DEFAULT 0,
  montant_remise NUMERIC(15,2) DEFAULT 0,
  -- Paiement
  mode_paiement VARCHAR(30) DEFAULT 'virement'
    CHECK (mode_paiement IN ('especes','cheque','virement','traite','mixte')),
  montant_paye NUMERIC(15,2) DEFAULT 0,
  solde_restant NUMERIC(15,2) DEFAULT 0,
  -- Référence
  reference_client VARCHAR(100),
  notes TEXT,
  -- Acteurs
  cree_par UUID REFERENCES utilisateurs(id),
  valide_par UUID REFERENCES utilisateurs(id),
  date_validation TIMESTAMPTZ,
  pdf_path VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION gen_numero_vente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_vente := 'VTE-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('vente_seq')::TEXT,5,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_vente ON ventes;
CREATE TRIGGER trg_numero_vente BEFORE INSERT ON ventes FOR EACH ROW EXECUTE FUNCTION gen_numero_vente();

-- LIGNES VENTE
CREATE TABLE IF NOT EXISTS lignes_vente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vente_id UUID REFERENCES ventes(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id),
  designation VARCHAR(255) NOT NULL,
  quantite NUMERIC(12,3) NOT NULL,
  unite_id INTEGER REFERENCES unites_mesure(id),
  prix_unitaire_ht NUMERIC(12,4) NOT NULL,
  taux_remise NUMERIC(5,2) DEFAULT 0,
  taux_tva NUMERIC(5,2) DEFAULT 19,
  montant_ht NUMERIC(15,2) DEFAULT 0,
  montant_tva NUMERIC(15,2) DEFAULT 0,
  montant_ttc NUMERIC(15,2) DEFAULT 0,
  lot_id UUID REFERENCES lots_stock(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMANDES ACHAT (inspiré de PurchaseOrder de Leinad)
CREATE SEQUENCE IF NOT EXISTS achat_seq START 1000;
CREATE TABLE IF NOT EXISTS commandes_achat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_commande VARCHAR(50) UNIQUE NOT NULL,
  statut VARCHAR(20) DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','envoye','confirme','receptionne_partiel','receptionne','annule')),
  fournisseur_id UUID REFERENCES fournisseurs(id),
  date_commande DATE DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  -- Montants
  montant_ht NUMERIC(15,2) DEFAULT 0,
  taux_tva NUMERIC(5,2) DEFAULT 19,
  montant_tva NUMERIC(15,2) DEFAULT 0,
  montant_ttc NUMERIC(15,2) DEFAULT 0,
  -- Réception
  date_reception DATE,
  montant_recu NUMERIC(15,2) DEFAULT 0,
  -- Infos
  reference_fournisseur VARCHAR(100),
  notes TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION gen_numero_achat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_commande := 'CMD-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('achat_seq')::TEXT,5,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_numero_achat ON commandes_achat;
CREATE TRIGGER trg_numero_achat BEFORE INSERT ON commandes_achat FOR EACH ROW EXECUTE FUNCTION gen_numero_achat();

-- LIGNES COMMANDE ACHAT
CREATE TABLE IF NOT EXISTS lignes_achat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID REFERENCES commandes_achat(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id),
  designation VARCHAR(255) NOT NULL,
  quantite_commandee NUMERIC(12,3) NOT NULL,
  quantite_recue NUMERIC(12,3) DEFAULT 0,
  unite_id INTEGER REFERENCES unites_mesure(id),
  prix_unitaire_ht NUMERIC(12,4) NOT NULL,
  taux_tva NUMERIC(5,2) DEFAULT 19,
  montant_ht NUMERIC(15,2) DEFAULT 0,
  montant_ttc NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAIEMENTS CLIENTS
CREATE TABLE IF NOT EXISTS paiements_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients_complet(id),
  vente_id UUID REFERENCES ventes(id),
  montant NUMERIC(15,2) NOT NULL,
  mode_paiement VARCHAR(30) DEFAULT 'virement',
  date_paiement DATE DEFAULT CURRENT_DATE,
  reference VARCHAR(100),
  notes TEXT,
  cree_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX
CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(client_id, statut);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_achats_fourn ON commandes_achat(fournisseur_id, statut);

SELECT 'Migration Vente/Achat terminée ✓' AS statut;
