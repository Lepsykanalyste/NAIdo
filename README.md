# NAIdo — ERP/MES Industriel
### NAI · Logiciel créé par SOPHOPSY

> Système intégré de gestion de production, qualité et maintenance — conçu pour l'industrie de la sacherie plastique.

---

## 🚀 Démarrage rapide (serveur Ubuntu)

```bash
# 1. Cloner le projet
git clone https://github.com/Lepsykanalyste/NAIdo.git
cd NAIdo

# 2. Configurer les secrets (obligatoire)
cp .env.example .env
# Éditer .env avec vos propres valeurs

# 3. Lancer tout en une commande
docker compose up -d --build

# 4. Vérifier que tout tourne
docker compose ps
```

L'application est accessible sur : **http://IP_SERVEUR:8095**

---

## 🔐 Connexion par défaut

| Login | Mot de passe | Rôle |
|-------|-------------|------|
| admin | Admin2026!  | Super Admin |

> ⚠️ **Changer le mot de passe admin dès la première connexion.**

---

## 📦 Modules

### 🏭 Production & Fabrication
- Ordres de Fabrication (OF) — création, suivi, clôture
- Import Excel Sage 100 (OF, articles, clients)
- Planification machines & shifts
- Saisie production opérateur (bobines, poids, déchets)
- Déclarations de production & consommation MP
- Impression thermique ESC/POS (tickets bobine, récap shift avec QR code)
- Régleur machine — paramétrage avant démarrage

### 📊 Suivi & Performance
- TRS (Taux de Rendement Synthétique) temps réel
- Arrêts machine (pannes, réglages, nettoyage...)
- Rapports journaliers de production
- KPI & tableaux de bord par atelier
- Traçabilité lots matières → produits finis

### 📦 Stocks & Approvisionnement
- Stock Magasin MP (matières premières par lots)
- Stock interne AT3 (mouvements, résumé par famille)
- DBM — Demandes de Besoin en Matières
- Flux complet : DBM → Livraison Magasin → Réception AT3
- Bons de Cession inter-ateliers
- Ordres de Livraison clients

### 🔬 Qualité (QHSE)
- Contrôles qualité multi-postes (MP, extrusion, impression, découpe, emballage)
- Non-conformités (NC) — création, suivi, clôture
- Contrôle avant cession AT3
- Ronde Chef de Quart
- Signature électronique + photos + génération PDF
- Audits & écarts

### 🔧 GMAO — Maintenance
- Gestion des équipements & machines
- Ordres de Travail (OT) — préventif & curatif
- Tickets de maintenance (signalement opérateur/régleur)
- Suivi incidents & historique interventions
- Planning maintenance préventive

### 🛒 Vente & Achat
- Devis clients
- Bons de Commande (BC)
- Demandes de Fabrication (DF) depuis BC
- Ordres de Livraison
- Commandes achat fournisseurs

### 👥 Administration
- Gestion utilisateurs & rôles (15+ rôles métiers)
- Authentification JWT + badge QR code
- Permissions granulaires par module
- Assistant IA intégré (Ollama)
- Alertes temps réel
- Référentiels (articles, machines, ateliers, fournisseurs, clients...)

---

## 🏗️ Architecture

```
NAIdo/
├── frontend/           ← React 18 PWA (port 8095)
│   └── src/pages/      ← Interfaces métiers
├── backend/            ← API REST Node.js (port 3090)
│   └── src/routes/     ← 40+ routes métiers
├── backend_python/     ← IA & PDF (port 3091)
├── database/           ← Schéma PostgreSQL (init.sql)
├── docker-compose.yml
└── .env                ← Secrets (non versionné)
```

## 🛠️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + PWA (offline) |
| Backend | Node.js + Express + JWT |
| IA & PDF | Python 3.11 + FastAPI + WeasyPrint |
| Base de données | PostgreSQL 16 |
| Infrastructure | Docker + Nginx + Ubuntu 22/24 LTS |
| Sécurité | bcrypt + JWT (8h) + rate limiting |

## 👤 Rôles utilisateurs

`super_admin` · `directeur` · `chef_atelier` · `regleur` · `operateur` · `qualite` · `qhse` · `magasinier` · `magasinier_mp` · `magasinier_at3` · `commercial` · `achat` · `rh` · `technicien` · `technicien_gmao`

---

## 🔒 Sécurité

- Mots de passe hashés (bcrypt)
- Tokens JWT avec expiration 8h
- Rate limiting anti brute-force (10 tentatives/15min sur /login)
- Secrets dans `.env` — jamais dans le code
- RBAC (contrôle d'accès basé sur les rôles)

---

## 📥 Import Sage 100

Déposer le fichier Excel Sage dans : **Admin → Import → Sage 100**

Colonnes attendues : `N° OF` · `Code client` · `Nom client` · `Réf article` · `Désignation` · `Cadence/h` · `Temps réglage` · `Quantité` · `Date livraison`

---

© 2026 NAI · Logiciel créé par **SOPHOPSY**
