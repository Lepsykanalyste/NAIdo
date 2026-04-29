#!/bin/bash
# NAIdo Deploy Script — copie les fichiers modifiés et commit GitHub
set -e

cd ~/NAIdo

echo "=== Rebuild backend Python ==="
docker compose build --no-cache backend_python

echo "=== Relancer les containers ==="
docker compose up -d

echo "=== Commit GitHub ==="
git add -A
git commit -m "${1:-deploy: mise à jour NAIdo}" || echo "Rien à commiter"
git push

echo "=== Logs ==="
sleep 5
docker logs naido_backend_python --tail=5
docker logs naido_backend --tail=3

echo "=== DONE ==="
