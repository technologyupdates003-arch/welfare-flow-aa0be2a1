#!/usr/bin/env bash
# Spins up a throwaway MariaDB + Laravel dev server in /tmp and runs tests/e2e.sh.
# Only used for sandbox verification; not part of the cPanel deployment.
set -e
SRC=${SRC:-/dev-server/laravel-backend}
WORK=/tmp/lb
DB=/tmp/mdb
PHP="nix run nixpkgs#php83 --"
COMPOSER="nix run nixpkgs#php83Packages.composer --"

echo "== database =="
mkdir -p $DB/data $DB/run
nix build nixpkgs#mariadb -o $DB/pkg >/dev/null 2>&1
if ! $DB/pkg/bin/mariadb --socket=$DB/run/my.sock -u root -e 'select 1' >/dev/null 2>&1; then
  $DB/pkg/bin/mariadb-install-db --datadir=$DB/data --auth-root-authentication-method=normal >/dev/null 2>&1 || true
  setsid $DB/pkg/bin/mariadbd --user=root --datadir=$DB/data --socket=$DB/run/my.sock --port=3307 --bind-address=127.0.0.1 >$DB/server.log 2>&1 < /dev/null &
  for i in $(seq 1 60); do $DB/pkg/bin/mariadb --socket=$DB/run/my.sock -u root -e 'select 1' >/dev/null 2>&1 && break; sleep 1; done
fi
$DB/pkg/bin/mariadb --socket=$DB/run/my.sock -u root -e "
DROP DATABASE IF EXISTS neibasco_welfare_data;
CREATE DATABASE neibasco_welfare_data CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'wf'@'127.0.0.1' IDENTIFIED BY 'wfpass';
GRANT ALL ON neibasco_welfare_data.* TO 'wf'@'127.0.0.1'; FLUSH PRIVILEGES;"

echo "== app =="
rm -rf $WORK && cp -r $SRC $WORK && cd $WORK
cp deploy/env.production .env
sed -i "s/^DB_HOST=.*/DB_HOST=127.0.0.1/;s/^DB_PORT=.*/DB_PORT=3307/;s/^DB_USERNAME=.*/DB_USERNAME=wf/;s/^DB_PASSWORD=.*/DB_PASSWORD=wfpass/;s/^APP_DEBUG=.*/APP_DEBUG=true/;s#^APP_URL=.*#APP_URL=http://127.0.0.1:8899#;s/^CORS_ORIGINS=.*/CORS_ORIGINS=*/;s#^STORAGE_PUBLIC_URL=.*#STORAGE_PUBLIC_URL=http://127.0.0.1:8899/storage/v1/object#" .env
$COMPOSER install --no-interaction --no-progress -q
NOENV="env -u DB_HOST -u DB_PORT -u DB_DATABASE -u DB_USERNAME -u DB_PASSWORD -u DB_CONNECTION -u DB_URL -u DATABASE_URL"
$NOENV $PHP artisan key:generate --force >/dev/null
$NOENV $PHP artisan migrate --force
$NOENV $PHP artisan db:seed --force

echo "== serve =="
nix build nixpkgs#php83 -o /tmp/phpenv >/dev/null 2>&1
cat > /tmp/serve.sh <<EOF
cd $WORK
exec $NOENV /tmp/phpenv/bin/php artisan serve --host=127.0.0.1 --port=8899
EOF
pkill -f 'artisan serve' 2>/dev/null || true
setsid bash /tmp/serve.sh >/tmp/lb-serve.log 2>&1 < /dev/null &
for i in $(seq 1 40); do curl -sf -m 3 -o /dev/null http://127.0.0.1:8899/health && break; sleep 1; done

echo "== tests =="
bash $SRC/tests/e2e.sh http://127.0.0.1:8899
