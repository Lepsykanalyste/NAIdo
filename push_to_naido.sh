#!/bin/bash
echo "$(date) — Build frontend..."
cd ~/NAIdo
docker compose up -d --build frontend

echo "$(date) — Extraction du dist..."
docker cp naido_frontend:/usr/share/nginx/html/. /tmp/naido_dist/

echo "$(date) — Prêt à transférer"
echo "Sur Windows :"
echo "  scp -r sophopsy-ia@100.85.252.109:/tmp/naido_dist C:\Users\HP\Downloads\"
echo "  scp -r C:\Users\HP\Downloads\naido_dist\* naido@192.100.100.6:~/NAIdo/frontend/dist/"
echo "Sur naido :"
echo "  docker cp ~/NAIdo/frontend/dist/. naido_frontend:/usr/share/nginx/html/"
