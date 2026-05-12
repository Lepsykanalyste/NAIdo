#!/bin/bash
# Sync automatique — Code vers NAIdo + DB NAIdo vers sophopsy
cd ~/NAIdo
LOG="/tmp/naido_sync.log"

# Vérifier si NAIdo est joignable
ssh -o ConnectTimeout=5 naido@100.115.169.55 "echo ok" 2>/dev/null || { echo "$(date '+%H:%M:%S') NAIdo inaccessible" >> $LOG; exit 0; }

# 1. Push code GitHub
git add -A
git commit -m "auto-sync code $(date +%H:%M)" 2>/dev/null || true
git push origin main 2>/dev/null || true

# 2. Pull code sur NAIdo + restart si changement
ssh naido@100.115.169.55 "
  cd ~/NAIdo
  AVANT=\$(git rev-parse HEAD)
  git pull origin main 2>/dev/null
  APRES=\$(git rev-parse HEAD)
  if [ \"\$AVANT\" != \"\$APRES\" ]; then
    echo 'CODE_CHANGE'
    docker-compose up -d 2>/dev/null
  fi
" 2>/dev/null

# 3. Sync DB NAIdo → sophopsy
ssh naido@100.115.169.55 "docker exec naido_postgres pg_dump -U naido_user naido_db" > /tmp/naido_prod.sql 2>/dev/null

if [ -s /tmp/naido_prod.sql ]; then
  docker exec -i naido_postgres psql -U naido_user -d naido_db -c \
    'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO naido_user;' 2>/dev/null
  docker exec -i naido_postgres psql -U naido_user -d naido_db < /tmp/naido_prod.sql 2>/dev/null
  echo "$(date '+%H:%M:%S') ✅ sync OK — DB NAIdo → sophopsy" >> $LOG
else
  echo "$(date '+%H:%M:%S') ⚠️ dump vide" >> $LOG
fi
