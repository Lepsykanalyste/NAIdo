#!/bin/bash
# Sync sophopsy → GitHub → NAIdo (CODE UNIQUEMENT — jamais la DB)
set -e

NAIDO_IP="100.115.169.55"
NAIDO_USER="naido"

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

echo "$(date) — Transfert vers NAIdo..."
scp /tmp/naido_images.tar.gz ${NAIDO_USER}@${NAIDO_IP}:/tmp/naido_images.tar.gz

echo "$(date) — Déploiement sur NAIdo..."
ssh ${NAIDO_USER}@${NAIDO_IP} "
  cd ~/NAIdo &&
  git pull origin main &&
  docker load < /tmp/naido_images.tar.gz &&
  docker-compose up -d &&
  rm /tmp/naido_images.tar.gz &&
  echo '✅ NAIdo mis à jour — DB intacte'
"
echo "$(date) — DONE ✅"
