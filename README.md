# NAIdo — MES Atelier 3
### Green Industry · Système de Gestion de Production

---

## Démarrage rapide (serveur Ubuntu)

```bash
# 1. Cloner le projet
git clone https://github.com/Lepsykanalyste/NAIdo.git
cd NAIdo

# 2. Lancer tout en une commande
docker compose up -d --build

# 3. Vérifier que tout tourne
docker compose ps
```

L'application est accessible sur : **http://IP_SERVEUR:8090**

---

## Connexion par défaut
| Login | Mot de passe | Rôle |
|-------|-------------|------|
| admin | Admin2026!  | Chef atelier |

**Changer le mot de passe admin dès la première connexion.**

---

## Architecture
```
NAIdo/
├── backend/          ← API Node.js (port 3090)
├── frontend/         ← React PWA (port 8090)
├── database/         ← Schéma PostgreSQL (init.sql)
└── docker-compose.yml
```

## Modules
1. Authentification & rôles (login / badge QR Code)
2. Gestion des OF (import Excel Sage)
3. Saisie production & impression thermique ESC/POS
4. Suivi temps d'arrêt (TRS)
5. Contrôle qualité (photos + signature électronique + PDF)
6. Tableau de bord KPI temps réel

## Stack
- **Frontend** : React 18 + Vite + Tailwind CSS + PWA (offline)
- **Backend** : Node.js + Express + JWT
- **BDD** : PostgreSQL 16
- **Infra** : Docker + Nginx + Ubuntu 22/24 LTS

## Import Sage
Déposer le fichier Excel Sage dans l'interface admin → Import → Sage 100.
Format attendu : colonnes N° OF, Code client, Nom client, Réf article, Désignation, Cadence/h, Temps réglage, Quantité, Date livraison.

---
© 2026 Green Industry — NAI · Code propriété exclusive du client
