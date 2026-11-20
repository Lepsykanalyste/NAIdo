-- Le déclencheur sync_stock_articles() utilise ON CONFLICT (article_id) :
-- il faut une unicité sur stock_articles(article_id).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_articles_article_id_key') THEN
    ALTER TABLE stock_articles ADD CONSTRAINT stock_articles_article_id_key UNIQUE (article_id);
  END IF;
END $$;
