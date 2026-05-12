#!/bin/bash
# Sync sophopsy → GitHub → NAIdo via Tailscale
set -e

NAIDO_IP="100.115.169.55"
NAIDO_USER="naido"
NAIDO_DIR="~/NAIdo"

echo "$(date) — Push GitHub..."
cd ~/NAIdo
git add -A
git commit -m "${1:-deploy: mise à jour NAIdo $(date +%Y-%m-%d)}" || echo "Rien à commiter"
git push origin main

echo "$(date) — Build images sur sophopsy..."
docker compose build

echo "$(date) — Export images..."
docker save naido-backend naido-backend_python naido-frontend | gzip > /tmp/naido_images.tar.gz
ls -lh /tmp/naido_images.tar.gz

echo "$(date) — Dump base de données sophopsy..."
docker exec naido_postgres pg_dump -U naido_user naido_db > /tmp/naido_db.sql
ls -lh /tmp/naido_db.sql

echo "$(date) — Transfert vers NAIdo via Tailscale..."
scp /tmp/naido_images.tar.gz ${NAIDO_USER}@${NAIDO_IP}:/tmp/naido_images.tar.gz
scp /tmp/naido_db.sql ${NAIDO_USER}@${NAIDO_IP}:/tmp/naido_db.sql

echo "$(date) — Déploiement sur NAIdo..."
ssh ${NAIDO_USER}@${NAIDO_IP} "
  cd ${NAIDO_DIR} &&
  git pull origin main &&

  echo '--- Chargement images Docker...' &&
  docker load < /tmp/naido_images.tar.gz &&

  echo '--- Sync base de données...' &&
  docker exec -i naido_postgres psql -U naido_user -d naido_db -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO naido_user;' &&
  docker exec -i naido_postgres psql -U naido_user -d naido_db < /tmp/naido_db.sql &&

  echo '--- Redémarrage containers...' &&
  docker-compose up -d &&

  rm /tmp/naido_images.tar.gz /tmp/naido_db.sql &&
  echo '✅ NAIdo mis à jour'
"

echo "$(date) — DONE ✅"
