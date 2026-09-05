#!/bin/sh
# Migrations e seed rodam a cada boot e são idempotentes: é o que faz
# `docker compose up` entregar a aplicação pronta, sem passo manual.
set -e

echo "[entrypoint] aplicando migrations"
php /var/www/backend/bin/migrate.php

echo "[entrypoint] aplicando seed"
php /var/www/backend/bin/seed.php

echo "[entrypoint] iniciando servidor"
exec "$@"
