#!/bin/sh
# Migrations e seed rodam a cada boot e são idempotentes: é o que faz
# `docker compose up` entregar a aplicação pronta, sem passo manual.
set -e

# Um volume nomeado é criado pelo Docker como root, e o Apache roda como
# www-data. Sem este ajuste o primeiro upload falha com "Permission denied" —
# na máquina de quem avalia, não na de quem desenvolveu.
echo "[entrypoint] preparando diretório de uploads"
mkdir -p /var/www/backend/storage/uploads
chown -R www-data:www-data /var/www/backend/storage

echo "[entrypoint] aplicando migrations"
php /var/www/backend/bin/migrate.php

echo "[entrypoint] aplicando seed"
php /var/www/backend/bin/seed.php

echo "[entrypoint] iniciando servidor"
exec "$@"
