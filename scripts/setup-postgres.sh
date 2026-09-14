#!/bin/bash
# Garfix infra setup — PostgreSQL 17 (per worklog recipe: debs → infra/pg)
set -euo pipefail
cd /home/z/my-project

PGBIN=/home/z/my-project/infra/pg/usr/lib/postgresql/17/bin
PGDATA=/home/z/my-project/db/postgres-data
export LD_LIBRARY_PATH=/home/z/my-project/infra/pg/usr/lib/x86_64-linux-gnu

echo "── [1/5] Downloading PostgreSQL 17 debs ──"
mkdir -p /tmp/pgdebs && cd /tmp/pgdebs
apt-get download postgresql-17 postgresql-client-17 libpq5 2>&1 | tail -3
ls -la /tmp/pgdebs/

echo "── [2/5] Extracting debs to infra/pg ──"
mkdir -p /home/z/my-project/infra/pg
for deb in /tmp/pgdebs/*.deb; do
  dpkg-deb -x "$deb" /home/z/my-project/infra/pg
done
ls /home/z/my-project/infra/pg/usr/lib/postgresql/17/bin | head -5

echo "── [3/5] initdb → db/postgres-data ──"
mkdir -p /home/z/my-project/db
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  cd /home/z/my-project
  "$PGBIN/initdb" -U garfix --auth=trust -E UTF8 -D "$PGDATA" 2>&1 | tail -3
else
  echo "PGDATA already initialized — skipping initdb"
fi

echo "── [4/5] postgresql.conf tweaks (sockets in /tmp) ──"
if ! grep -q "unix_socket_directories = '/tmp'" "$PGDATA/postgresql.conf"; then
  cat >> "$PGDATA/postgresql.conf" <<'EOF'

# sandbox setup (recipe from worklog)
unix_socket_directories = '/tmp'
listen_addresses = '127.0.0.1'
port = 5432
EOF
fi
grep -E "unix_socket_directories|listen_addresses" "$PGDATA/postgresql.conf" | tail -2

echo "── [5/5] Start postgres + create role/db ──"
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5432 -h 127.0.0.1" -l "$PGDATA/pg.log" start
  sleep 2
fi
"$PGBIN/pg_isready" -h 127.0.0.1 -p 5432

# role: superuser 'garfix' with password (DATABASE_URL uses garfix:garfix2024)
PSQL="$PGBIN/psql -h 127.0.0.1 -p 5432 -U garfix -d postgres -tAc"
$PSQL "SELECT 1 FROM pg_roles WHERE rolname='garfix'" | rg -q 1 || $PSQL "CREATE ROLE garfix LOGIN SUPERUSER PASSWORD 'garfix2024'" >/dev/null
$PSQL "SELECT 1 FROM pg_database WHERE datname='garfix'" | rg -q 1 || $PSQL "CREATE DATABASE garfix OWNER garfix" >/dev/null
$PSQL "ALTER ROLE garfix WITH LOGIN SUPERUSER PASSWORD 'garfix2024'" >/dev/null
echo "role+db ready"

echo "── DONE: PostgreSQL 17 is up on 127.0.0.1:5432 (garfix/garfix2024) ──"
