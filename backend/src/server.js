const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('REPLACE_')) {
  throw new Error('JWT_SECRET doit être défini (32 caractères minimum)');
}

// Import cron jobs
require('./jobs/alertes.cron');
require('./jobs/rapports.cron');

const app = express();
app.set('trust proxy', 1);   // nginx est le seul intermediaire : req.ip = vraie adresse du visiteur
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || false, credentials: true }));
// Rate limit global : large (toute l'usine sort par la meme adresse publique) ; il ne sert qu'a stopper un deluge
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30000, standardHeaders: true, legacyHeaders: false }));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Limites de connexion (anti brute-force), apres lecture du corps pour distinguer les comptes :
//  - 10 echecs / 15 min par COMPTE et par adresse : un compte vise ne bloque pas les autres utilisateurs ;
//  - 60 echecs / 15 min par adresse : pulverisation de mots de passe sur plusieurs comptes.
// La connexion par badge a son propre plafond par adresse. Seuls les echecs comptent.
const MSG_LOGIN = { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' };
const loginParCompte = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, message: MSG_LOGIN, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String((req.body && (req.body.login || req.body.badge_qr)) || '').toLowerCase().slice(0, 80)}`,
});
const loginParAdresse = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, message: MSG_LOGIN, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });
// Badge : essayer des badges DIFFERENTS n'est pas arrete par la limite par compte, donc plafond plus bas par adresse (20 echecs / 15 min)
const badgeParAdresse = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: MSG_LOGIN, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });
app.use('/api/auth/login', loginParAdresse, loginParCompte);
app.use('/api/auth/login-badge', badgeParAdresse, loginParCompte);
app.use('/api', require('./middleware/rbac'));   // controle d'acces par role (config/permissions.json)
// Fichiers téléversés : réservés aux utilisateurs connectés (plus d'accès public par URL)
app.use('/uploads', require('./middleware/auth').auth, express.static(path.join(__dirname, '../uploads')));

// ── ROUTES ────────────────────────────────────────────────────
// Référentiels
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/ateliers',       require('./routes/ateliers'));
app.use('/api/fichiers-article', require('./routes/fichiers_article'));
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
app.use('/api/achat', require('./routes/achat_v2'));
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
app.use('/api/notifications',     require('./routes/notifications'));
app.use('/api/assistant',         require('./routes/assistant'));
app.use('/api/preferences',       require('./routes/preferences_menu'));
app.use('/api/mail', require('./routes/mail'));
app.use('/api/profil', require('./routes/profil'));
app.use('/api/lots-prod',          require('./routes/lots_prod'));
app.use('/api/direction', require('./routes/direction'));
app.use('/api/couts-of', require('./routes/cout_of'));
app.use('/api/poste', require('./routes/poste'));
app.use('/api/droits', require('./routes/droits_ecrans'));
app.use('/api', require('./routes/compat_routes'));
app.use('/api/qualite',        require('./routes/qualite'));
// Traçabilité
app.use('/api/tracabilite',    require('./routes/tracabilite'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', app: 'NAIdo ERP/MES — Green Industry' });
});

app.use('/api/at3', require('./routes/at3_flux'));
app.use('/api/dbm', require('./routes/dbm_livraisons'));
app.use('/api/dbm', require('./routes/dbm'));
app.use('/api/rondes',          require('./routes/rondes'));
app.use('/api/non-conformites', require('./routes/non_conformites'));
app.use('/api/cessions',        require('./routes/cessions'));
app.use('/api/regleur', require('./routes/regleur_historique'));

app.use((err, req, res, next) => {
  const statut = err.status || 500;
  if (statut >= 500) console.error(err.stack);
  res.status(statut).json({ error: statut < 500 ? (err.message || 'Requête invalide') : 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`NAIdo v3 démarré sur le port ${PORT}`));
module.exports = app;
