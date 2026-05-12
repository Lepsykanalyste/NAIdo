#!/bin/bash
# Sync rapide sophopsy → NAIdo (code + DB, sans rebuild images)
cd ~/NAIdo

# Vérifier si NAIdo est joignable
ssh -o ConnectTimeout=5 naido@100.115.169.55 "echo ok" 2>/dev/null || exit 0

# Push GitHub
git add -A
git commit -m "auto-sync $(date +%H:%M)" 2>/dev/null || true
git push origin main 2>/dev/null || true

# Sync code sur NAIdo
ssh naido@100.115.169.55 "cd ~/NAIdo && git pull origin main 2>/dev/null" || exit 0

# Sync DB sophopsy → NAIdo
docker exec naido_postgres pg_dump -U naido_user naido_db > /tmp/naido_db_sync.sql
scp -q /tmp/naido_db_sync.sql naido@100.115.169.55:/tmp/naido_db_sync.sql
ssh naido@100.115.169.55 "
  docker exec -i naido_postgres psql -U naido_user -d naido_db -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO naido_user;' 2>/dev/null &&
  docker exec -i naido_postgres psql -U naido_user -d naido_db < /tmp/naido_db_sync.sql 2>/dev/null &&
  rm /tmp/naido_db_sync.sql
" 2>/dev/null

echo "$(date '+%H:%M:%S') sync OK"
