@echo off
scp sophopsy-ia@100.85.252.109:~/naido_images.tar.gz C:tempnaido.tar.gz
scp C:tempnaido.tar.gz naido@192.100.100.6:~/
ssh naido@192.100.100.6 docker load < ~/naido_images.tar.gz && docker-compose up -d
