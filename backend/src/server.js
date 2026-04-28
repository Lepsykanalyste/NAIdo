const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques (uploads photos qualité)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/machines',   require('./routes/machines'));
app.use('/api/shifts',     require('./routes/shifts'));
app.use('/api/of',         require('./routes/of'));
app.use('/api/sessions',   require('./routes/sessions'));
app.use('/api/tickets',    require('./routes/tickets'));
app.use('/api/arrets',     require('./routes/arrets'));
app.use('/api/qualite',    require('./routes/qualite'));
app.use('/api/kpi',        require('./routes/kpi'));
app.use('/api/import',     require('./routes/import'));
app.use('/api/users',      require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', app: 'NAIdo MES Atelier 3' });
});

// Gestion erreurs globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne'
  });
});

app.listen(PORT, () => {
  console.log(`NAIdo Backend démarré sur le port ${PORT}`);
});

module.exports = app;
