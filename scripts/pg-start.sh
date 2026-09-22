#!/bin/bash
# r26: تشغيل PostgreSQL 17 محلياً بلا root (مستخرج من deb) + إنشاء مستخدم/قاعدة garfix
set -e
export PGBIN=/home/z/pg/usr/lib/postgresql/17/bin
export PGDATA=/home/z/pgdata
export PATH="$PGBIN:$PATH"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[1/4] initdb..."
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" -U garfix -A trust --encoding=UTF8 --locale=C
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[2/4] starting postgres on 127.0.0.1:5432..."
  pg_ctl -D "$PGDATA" -l /home/z/pg.log -o "-p 5432 -c listen_addresses=127.0.0.1 -k /tmp" start
else
  echo "[2/4] already running"
fi

echo "[3/4] ensure db + password..."
psql -h 127.0.0.1 -p 5432 -U garfix -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='garfix'" | grep -q 1 || createdb -h 127.0.0.1 -p 5432 -U garfix garfix
psql -h 127.0.0.1 -p 5432 -U garfix -d postgres -c "ALTER USER garfix PASSWORD 'garfix2024';" >/dev/null

echo "[4/4] verify connection with password..."
PGPASSWORD=garfix2024 psql -h 127.0.0.1 -p 5432 -U garfix -d garfix -tc "SELECT version();" | head -1
echo "OK"
