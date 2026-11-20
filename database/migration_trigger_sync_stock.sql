-- NAIdo - remplace la premiere version de ce fichier (ON CONFLICT DO NOTHING creait des lignes de stock en double)
-- stock_articles : une ligne par (article, emplacement), plus d'unicite sur article_id seul.
ALTER TABLE stock_articles DROP CONSTRAINT IF EXISTS stock_articles_article_id_key;
-- Le declencheur ne fait plus rien : les routes mettent a jour lots_stock et stock_articles elles-memes (voir migration_stock_sans_declencheur.sql).
CREATE OR REPLACE FUNCTION public.sync_stock_articles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$$;
