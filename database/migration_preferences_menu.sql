-- NAIdo - Personnalisation du menu par utilisateur (ordre des écrans et groupes créés par la personne). Additif.
CREATE TABLE IF NOT EXISTS preferences_menu (
    user_id text PRIMARY KEY,
    layout jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

SELECT 'preferences_menu : OK' AS statut;
