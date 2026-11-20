-- NAIdo - Stock des matieres premieres : plus de declencheur entre lots_stock et stock_articles.
-- Chaque route met a jour les deux tables elle-meme (le declencheur d'origine recalculait un total absolu en conflit avec ces ecritures ;
-- sa correction partielle ne mettait plus a jour le stock apres le premier lot). La fonction est conservee, neutre.
CREATE OR REPLACE FUNCTION public.sync_stock_articles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$$;
SELECT 'stock sans declencheur : OK' AS statut;
