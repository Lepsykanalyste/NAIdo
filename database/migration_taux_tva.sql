-- NAIdo - Taux de TVA des articles (18 % par défaut). Les prix d'achat et de vente sont saisis HT. Additif.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS taux_tva numeric(5,2) DEFAULT 18;
UPDATE articles SET taux_tva = 18 WHERE taux_tva IS NULL;

SELECT 'taux_tva : OK' AS statut;
