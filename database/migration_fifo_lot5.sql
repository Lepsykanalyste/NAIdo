-- NAIdo - Lot 5 : FIFO. Exceptions d'ordre de sortie, approuvees par la direction. Idempotent.
CREATE TABLE IF NOT EXISTS exceptions_fifo (
  id              SERIAL PRIMARY KEY,
  article_id      UUID NOT NULL REFERENCES articles(id),
  lot_plus_ancien VARCHAR(100),
  lot_demande     VARCHAR(100) NOT NULL,
  qte             NUMERIC(14,3) NOT NULL CHECK (qte > 0),
  motif           TEXT NOT NULL,
  statut          VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','approuvee','refusee')),
  demande_par     UUID,
  demande_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approuve_par    UUID,
  approuve_at     TIMESTAMPTZ,
  motif_refus     TEXT,
  utilisee        BOOLEAN NOT NULL DEFAULT false
);
SELECT 'lot 5 FIFO : OK' AS statut;
