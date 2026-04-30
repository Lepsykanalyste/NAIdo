-- Ajouter colonne role dans utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'operateur';

-- Mettre admin en directeur
UPDATE utilisateurs SET role='directeur' WHERE login='admin';

-- Créer sophopsy super_admin
INSERT INTO utilisateurs (login, password_hash, nom, prenom, email, role, actif)
SELECT 'sophopsy',
    crypt('Sophopsy2026!', gen_salt('bf', 10)),
    'SOPHOPSY', 'Admin', 'admin@sophopsy.com', 'super_admin', true
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE login='sophopsy');

SELECT login, role, actif FROM utilisateurs ORDER BY role;
