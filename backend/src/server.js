const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',                require('./routes/auth'));
app.use('/api/users',               require('./routes/users'));
app.use('/api/machines',            require('./routes/machines'));
app.use('/api/shifts',              require('./routes/shifts'));
app.use('/api/of',                  require('./routes/of'));
app.use('/api/sessions',            require('./routes/sessions'));
app.use('/api/tickets',             require('./routes/tickets'));
app.use('/api/arrets',              require('./routes/arrets'));
app.use('/api/stock',          require('./routes/stock'));
app.use('/api/qualite',             require('./routes/qualite'));
app.use('/api/kpi',                 require('./routes/kpi'));
app.use('/api/import',              require('./routes/import'));
app.use('/api/alertes',             require('./routes/alertes'));
app.use('/api/planning',            require('./routes/planning'));
app.use('/api/rapports',            require('./routes/rapports'));
app.use('/api/tracabilite',         require('./routes/tracabilite'));
app.use('/api/ateliers',            require('./routes/ateliers'));
app.use('/api/articles',            require('./routes/articles'));
app.use('/api/referentiels',        require('./routes/referentiels'));
app.use('/api/emplacements',        require('./routes/emplacements'));
app.use('/api/mouvements',          require('./routes/mouvements'));
app.use('/api/rapports-journaliers',require('./routes/rapports_journaliers'));
app.use('/api/nc',                  require('./routes/non_conformites'));
app.use('/api/ia',                  require('./routes/ia_ollama'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', app: 'NAIdo ERP/MES' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`NAIdo v3 port ${PORT}`));
module.exports = app;
