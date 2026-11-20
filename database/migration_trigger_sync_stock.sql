-- stock_articles : une ligne par (article, emplacement). Le déclencheur ne doit pas exiger l'unicité sur article_id seul.
ALTER TABLE stock_articles DROP CONSTRAINT IF EXISTS stock_articles_article_id_key;
CREATE OR REPLACE FUNCTION public.sync_stock_articles()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO stock_articles (article_id, qte_disponible, derniere_entree)
  VALUES (COALESCE(NEW.article_id, OLD.article_id),
    (SELECT COALESCE(SUM(qte_disponible),0) FROM lots_stock
     WHERE article_id=COALESCE(NEW.article_id, OLD.article_id) AND statut='disponible'),
    NOW())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$

;
