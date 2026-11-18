const { Pool } = require('pg');
if (!process.env.DB_PASS || process.env.DB_PASS.startsWith('REPLACE_')) throw new Error('DB_PASS requis pour démarrer NAIdo');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'naido_db',
  user:     process.env.DB_USER || 'naido_user',
  password: process.env.DB_PASS,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => console.log('PostgreSQL connecté'));
pool.on('error', (err) => console.error('Erreur PostgreSQL:', err));

module.exports = pool;
