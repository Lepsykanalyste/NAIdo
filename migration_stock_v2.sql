-- ============================================================
-- NAIdo Stock v2 — Structure par atelier/emplacement
-- ============================================================

-- S'assurer que stock_articles a la bonne structure
ALTER TABLE stock_articles ADD COLUMN IF NOT EXISTS derniere_sortie TIMESTAMPTZ;
ALTER TABLE stock_articles ADD COLUMN IF NOT EXISTS qte_reservee NUMERIC(12,3) DEFAULT 0;
ALTER TABLE stock_articles ADD COLUMN IF NOT EXISTS valeur_stock NUMERIC(15,2) DEFAULT 0;

-- Contrainte unique article + emplacement
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name='stock_articles' AND constraint_name='stock_articles_article_emplacement_unique'
  ) THEN
    ALTER TABLE stock_articles ADD CONSTRAINT stock_articles_article_emplacement_unique 
    UNIQUE (article_id, emplacement_id);
  END IF;
END $$;

-- Table journal_stock pour tracer toutes les opérations
CREATE TABLE IF NOT EXISTS journal_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id),
    emplacement_id INTEGER REFERENCES emplacements_stock(id),
    emplacement_destination_id INTEGER REFERENCES emplacements_stock(id),
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'entree_achat',      -- Réception commande achat
        'sortie_production',  -- Sortie MP vers production
        'entree_production',  -- Entrée PF depuis production
        'sortie_vente',       -- Livraison client
        'transfert',          -- Bon de cession inter-ateliers
        'entree_manuelle',    -- Ajustement manuel +
        'sortie_manuelle',    -- Ajustement manuel -
        'rebut',              -- Mise au rebut
        'retour'              -- Retour production
    )),
    qte NUMERIC(12,3) NOT NULL,
    prix_unitaire NUMERIC(12,4) DEFAULT 0,
    numero_lot VARCHAR(100),
    reference_doc VARCHAR(100),  -- N° OF, N° Bon cession, N° vente...
    notes TEXT,
    cree_par UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_article ON journal_stock(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_empl ON journal_stock(emplacement_id);
CREATE INDEX IF NOT EXISTS idx_journal_type ON journal_stock(type);

-- Vue stock par atelier (très utile)
CREATE OR REPLACE VIEW vue_stock_par_atelier AS
SELECT
    at.code AS atelier_code,
    at.libelle AS atelier_libelle,
    e.code AS emplacement_code,
    e.libelle AS emplacement_libelle,
    e.type AS emplacement_type,
    a.code AS article_code,
    a.designation,
    a.type_article,
    um.code AS unite,
    COALESCE(sa.qte_disponible, 0) AS qte_disponible,
    COALESCE(sa.qte_reservee, 0) AS qte_reservee,
    COALESCE(sa.valeur_stock, 0) AS valeur_stock,
    CASE WHEN COALESCE(sa.qte_disponible,0) <= COALESCE(a.stock_mini,0) AND COALESCE(a.stock_mini,0) > 0
         THEN true ELSE false END AS alerte_stock_bas,
    sa.derniere_entree,
    sa.derniere_sortie
FROM stock_articles sa
JOIN articles a ON a.id = sa.article_id
JOIN emplacements_stock e ON e.id = sa.emplacement_id
LEFT JOIN ateliers at ON at.id = e.atelier_id
LEFT JOIN unites_mesure um ON um.id = a.unite_mesure_id
WHERE a.actif = true AND e.actif = true
ORDER BY at.code, e.code, a.type_article, a.code;

SELECT 'Migration Stock v2 OK' AS statut;
