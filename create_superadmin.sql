
-- Créer/mettre à jour le compte Super Admin Sophopsy
-- Ce compte est distinct des admins NAI
DO $$
DECLARE
    v_hash TEXT;
BEGIN
    -- Hash bcrypt de 'Sophopsy2026!@#'
    -- On utilise l'extension pgcrypto si disponible
    BEGIN
        v_hash := crypt('Sophopsy2026!@#', gen_salt('bf', 12));
    EXCEPTION WHEN OTHERS THEN
        v_hash := '$2b$12$placeholder_will_be_set_via_api';
    END;
    
    INSERT INTO utilisateurs (login, password_hash, nom, prenom, email, role, actif)
    VALUES ('sophopsy', v_hash, 'SOPHOPSY', 'Admin', 'admin@sophopsy.com', 'super_admin', true)
    ON CONFLICT (login) DO UPDATE SET 
        role = 'super_admin',
        password_hash = CASE WHEN utilisateurs.login = 'sophopsy' 
                             THEN v_hash 
                             ELSE utilisateurs.password_hash END;
    
    -- S'assurer que admin NAI est directeur (pas super_admin)
    UPDATE utilisateurs SET role = 'directeur' 
    WHERE login = 'admin' AND role = 'super_admin';
    
    RAISE NOTICE 'Super Admin Sophopsy créé/mis à jour';
END $$;

SELECT login, nom, prenom, role, actif FROM utilisateurs WHERE role IN ('super_admin','directeur') ORDER BY role;
