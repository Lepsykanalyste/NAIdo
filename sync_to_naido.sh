#!/bin/bash
# Sync GitHub → NAIdo via Tailscale
set -e

NAIDO_IP="100.115.169.55"
NAIDO_USER="naido"
NAIDO_DIR="~/NAIdo"

echo "$(date) — Push GitHub..."
cd ~/NAIdo
git add -A
git commit -m "${1:-deploy: mise à jour NAIdo $(date +%Y-%m-%d)}" || echo "Rien à commiter"
git push origin main

echo "$(date) — Sync NAIdo..."
ssh ${NAIDO_USER}@${NAIDO_IP} "
  cd ${NAIDO_DIR} &&
  git pull origin main &&
  docker-compose build --no-cache &&
  docker-compose up -d &&
  echo '✅ NAIdo mis à jour'
"
echo "$(date) — DONE ✅"
