-- Corriger la valeur stock existante (500 kg * 850 = 425 000)
UPDATE stock_articles 
SET valeur_stock = qte_disponible * (valeur_stock / NULLIF(qte_disponible, 0))
WHERE valeur_stock > 0 AND valeur_stock < qte_disponible;

-- Correction directe si valeur = 850 et qte = 500
UPDATE stock_articles 
SET valeur_stock = 425000
WHERE valeur_stock = 850 AND qte_disponible = 500;

-- Créer table journal_stock
CREATE TABLE IF NOT EXISTS journal_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID,
    emplacement_id INTEGER,
    type VARCHAR(10) NOT NULL,
    qte NUMERIC(12,3) NOT NULL,
    prix_unitaire NUMERIC(12,4) DEFAULT 0,
    numero_lot VARCHAR(100),
    notes TEXT,
    cree_par UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Fix valeur stock OK' AS statut;
