-- Un numéro de lot n'est unique que par article (lots_stock_numero_lot_article_id_key).
-- L'ancienne unicité sur numero_lot seul empêchait deux articles de partager un numéro de lot.
ALTER TABLE lots_stock DROP CONSTRAINT IF EXISTS lots_stock_numero_lot_unique;
