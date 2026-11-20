-- NAIdo - correctifs issus de la relecture du projet : colonnes attendues par le code mais absentes de la base
-- (elles existaient sur l'ancien disque, ajoutees a la main, et n'avaient jamais ete versionnees). Idempotent, non destructif.

-- Fiche de non-conformite rapide (ecran Non-Conformites)
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS numero_lot   VARCHAR(100);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS quantite     VARCHAR(100);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS designation  VARCHAR(255);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS client_nom   VARCHAR(200);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS motif        VARCHAR(255);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS decision     VARCHAR(50);
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS actions      TEXT;
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS declarant_id UUID;
ALTER TABLE non_conformites ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ;
CREATE SEQUENCE IF NOT EXISTS seq_nc_rapide;

-- Plans de maintenance (GMAO) : le code utilise titre, la base a designation (obligatoire)
ALTER TABLE plans_maintenance ADD COLUMN IF NOT EXISTS titre VARCHAR(200);
UPDATE plans_maintenance SET titre = designation WHERE titre IS NULL;

-- Audits (QHSE) : le code utilise titre et type_audit
ALTER TABLE audits ADD COLUMN IF NOT EXISTS titre      VARCHAR(255);
ALTER TABLE audits ADD COLUMN IF NOT EXISTS type_audit VARCHAR(30);
UPDATE audits SET titre = COALESCE(titre, numero_audit), type_audit = COALESCE(type_audit, type) WHERE titre IS NULL OR type_audit IS NULL;
CREATE SEQUENCE IF NOT EXISTS seq_numero_audit;

-- Journal de stock : le code des mouvements (entree, sortie, transfert) ecrit ces deux colonnes
ALTER TABLE journal_stock ADD COLUMN IF NOT EXISTS emplacement_destination_id INTEGER;
ALTER TABLE journal_stock ADD COLUMN IF NOT EXISTS reference_doc VARCHAR(100);
-- ...et le type de mouvement (entree_manuelle, sortie_manuelle...) depasse les 10 caracteres de la colonne actuelle
ALTER TABLE journal_stock ALTER COLUMN type TYPE VARCHAR(30);

SELECT 'correctifs audit : OK' AS statut;
