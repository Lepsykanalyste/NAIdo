-- NAIdo - Lot 3 : achats. Libelles de frais (liste fermee), demandes et commandes rattachees a un OF ou a un libelle,
-- validation par la direction de tous les bons de commande fournisseurs. Idempotent.
CREATE TABLE IF NOT EXISTS libelles_frais (
  id          SERIAL PRIMARY KEY,
  libelle     VARCHAR(100) NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS libelles_frais_libelle_uq ON libelles_frais (lower(btrim(libelle)));
INSERT INTO libelles_frais (libelle)
SELECT v.l FROM (VALUES ('Fonctionnement'), ('Administration'), ('Informatique'), ('Entretien bâtiment'), ('Fournitures de bureau'), ('Transport'))
  AS v(l)
WHERE NOT EXISTS (SELECT 1 FROM libelles_frais f WHERE lower(btrim(f.libelle)) = lower(v.l));

ALTER TABLE demandes_achat ADD COLUMN IF NOT EXISTS of_id UUID REFERENCES ordres_fabrication(id);
ALTER TABLE demandes_achat ADD COLUMN IF NOT EXISTS libelle_frais_id INTEGER REFERENCES libelles_frais(id);
-- les demandes deja existantes ne sont pas remises en cause (NOT VALID) ; les nouvelles doivent avoir un OF ou un libelle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_achat_of_ou_libelle') THEN
    ALTER TABLE demandes_achat ADD CONSTRAINT demandes_achat_of_ou_libelle
      CHECK (of_id IS NOT NULL OR libelle_frais_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS of_id UUID REFERENCES ordres_fabrication(id);
ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS libelle_frais_id INTEGER REFERENCES libelles_frais(id);
ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS validation VARCHAR(30);
ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS validee_par UUID;
ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS validee_at TIMESTAMPTZ;
ALTER TABLE commandes_achat ADD COLUMN IF NOT EXISTS motif_refus TEXT;

SELECT 'lot 3 achats : OK' AS statut;
