-- NAIdo - Compte e-mail par utilisateur (envoi des bons d'achat depuis sa propre adresse).
-- Le mot de passe est chiffre par l'application (cle MAIL_CHIFFREMENT_KEY) : il n'est jamais stocke en clair.
-- Additif : une seule table nouvelle, aucune modification des tables existantes.

CREATE TABLE IF NOT EXISTS comptes_mail (
  user_id          uuid PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  smtp_host        varchar(255) NOT NULL,
  smtp_port        integer NOT NULL DEFAULT 587,
  smtp_user        varchar(255) NOT NULL,
  smtp_pass_chiffre text NOT NULL,
  adresse_expediteur varchar(255) NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

SELECT 'comptes_mail : OK' AS statut;
