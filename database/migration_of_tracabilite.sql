-- NAIdo - Traçabilité portée par l'ordre de fabrication (et non plus par la fiche article). Additif.
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS tracabilite_type varchar(20) DEFAULT 'lot';
ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS format_lot varchar(100);

SELECT 'ordres_fabrication.tracabilite_type : OK' AS statut;
