const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import cron jobs
require('./jobs/alertes.cron');
require('./jobs/rapports.cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── ROUTES ────────────────────────────────────────────────────
// Référentiels
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/ateliers',       require('./routes/ateliers'));
app.use('/api/articles',       require('./routes/articles'));
app.use('/api/composition',     require('./routes/composition'));

app.use('/api/referentiels',   require('./routes/referentiels'));
app.use('/api/emplacements',   require('./routes/emplacements'));
// Production
app.use('/api/machines',       require('./routes/machines'));
app.use('/api/shifts',         require('./routes/shifts'));
app.use('/api/of',             require('./routes/of'));
app.use('/api/sessions',       require('./routes/sessions'));
app.use('/api/tickets',        require('./routes/tickets'));
app.use('/api/arrets',         require('./routes/arrets'));
// Stock & Mouvements
app.use('/api/stock',          require('./routes/stock'));
app.use('/api/vente',          require('./routes/vente'));
app.use('/api/achat',          require('./routes/achat'));
app.use('/api/mouvements',     require('./routes/mouvements'));
app.use('/api/lots',           require('./routes/lots'));
// Rapports
app.use('/api/rapports-journaliers', require('./routes/rapports_journaliers'));
app.use('/api/rapports',       require('./routes/rapports'));
app.use('/api/kpi',            require('./routes/kpi'));
// QHSE
app.use('/api/nc',             require('./routes/non_conformites'));
app.use('/api/incidents',      require('./routes/incidents'));
app.use('/api/audits',         require('./routes/audits'));
app.use('/api/processus',      require('./routes/processus'));
// GMAO
app.use('/api/equipements',    require('./routes/equipements'));
app.use('/api/ot',             require('./routes/ordres_travail'));
app.use('/api/maintenance',    require('./routes/maintenance'));
// IA Ollama
app.use('/api/ia',             require('./routes/ia_ollama'));
// Alertes
app.use('/api/alertes',        require('./routes/alertes'));
// Planning
app.use('/api/planning',       require('./routes/planning'));
// Import
app.use('/api/import',         require('./routes/import'));
// Qualité
app.use('/api/devis', require('./routes/devis'));
app.use('/api/bc', require('./routes/bons_commande'));
app.use('/api/ol', require('./routes/ordres_livraison'));
app.use('/api/ticket-prod',      require('./routes/ticket_prod'));
app.use('/api/df',                require('./routes/demandes_fab'));
app.use('/api/lots-prod',          require('./routes/lots_prod'));
app.use('/api/qualite',        require('./routes/qualite'));
// Traçabilité
app.use('/api/tracabilite',    require('./routes/tracabilite'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', app: 'NAIdo ERP/MES — Green Industry' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.use('/api/at3', require('./routes/at3_flux'));
app.use('/api/dbm', require('./routes/dbm'));
app.listen(PORT, () => console.log(`NAIdo v3 démarré sur le port ${PORT}`));
module.exports = app;

app.use('/api/rondes',          require('./routes/rondes'));
app.use('/api/non-conformites', require('./routes/non_conformites'));
app.use('/api/cessions',        require('./routes/cessions'));
app.use('/api/regleur', require('./routes/regleur_historique'));
// Routes additionnelles
