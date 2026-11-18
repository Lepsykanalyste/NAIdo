// Exécuter uniquement après migration SQL : NAIDO_ADMIN_PASSWORD='...' node scripts/create_admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
(async () => {
  const password = process.env.NAIDO_ADMIN_PASSWORD;
  if (!password || password.length < 14) throw new Error('NAIDO_ADMIN_PASSWORD : 14 caractères minimum requis');
  const { rows: [role] } = await db.query("SELECT id, nom FROM roles WHERE nom IN ('super_admin','chef_atelier') ORDER BY CASE WHEN nom='super_admin' THEN 0 ELSE 1 END LIMIT 1");
  if (!role) throw new Error('Aucun rôle administrateur disponible');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(`
    INSERT INTO utilisateurs(nom, prenom, login, password_hash, role_id)
    VALUES('Admin','NAIdo','admin',$1,$2)
    ON CONFLICT (login) DO NOTHING RETURNING id
  `, [hash, role.id]);
  if (!rows.length) throw new Error('Le compte admin existe déjà : aucune modification effectuée');
  console.log('Administrateur créé. Changez le mot de passe selon la politique interne.');
})().catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => db.end());
