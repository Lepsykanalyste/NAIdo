#!/bin/bash
echo "$(date) — Build en cours..."
cd ~/NAIdo
docker compose up -d --build
echo "$(date) — Sauvegarde des images..."
docker save naido-frontend naido-backend naido-backend_python | gzip > ~/naido_images_latest.tar.gz
echo "$(date) — Images prêtes : ~/naido_images_latest.tar.gz"
echo "Transférez via Windows :"
echo "  scp sophopsy-ia@100.85.252.109:~/naido_images_latest.tar.gz C:\Users\HP\Downloads\"
echo "  scp C:\Users\HP\Downloads\naido_images_latest.tar.gz naido@192.100.100.6:~/"
echo "Sur naido :"
echo "  docker load < ~/naido_images_latest.tar.gz && docker-compose up -d"
