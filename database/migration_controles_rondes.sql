-- NAIdo - Controle avant cession (ENR.ALP1-024) et ronde du chef de quart
-- Tables utilisees par backend/src/routes/cessions.js et rondes.js (idempotent : peut etre rejoue sans risque)

CREATE TABLE IF NOT EXISTS controles_cession (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id         uuid REFERENCES ordres_fabrication(id) ON DELETE CASCADE,
  controleur_id uuid REFERENCES utilisateurs(id),
  resultats     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {point: 'OK'|'NOK', point_obs: 'texte'}
  observations  text,
  autorise      boolean NOT NULL DEFAULT false,       -- vrai si TOUS les points requis sont OK
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_controles_cession_of   ON controles_cession (of_id);
CREATE INDEX IF NOT EXISTS idx_controles_cession_date ON controles_cession (created_at DESC);

CREATE TABLE IF NOT EXISTS rondes_chef_quart (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id       uuid REFERENCES ordres_fabrication(id) ON DELETE CASCADE,
  machine_id  integer REFERENCES machines(id),
  chef_id     uuid REFERENCES utilisateurs(id),
  heure_debut varchar(10),                             -- 'HH:MM' tel que saisi
  heure_fin   varchar(10),
  resultats   jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rondes_chef_quart_of   ON rondes_chef_quart (of_id);
CREATE INDEX IF NOT EXISTS idx_rondes_chef_quart_date ON rondes_chef_quart (created_at DESC);

SELECT 'controles et rondes : OK' AS statut;
