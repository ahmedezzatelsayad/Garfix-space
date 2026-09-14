#!/bin/bash
# Garfix infra setup — Valkey 8.1.1 from source (per worklog recipe)
set -euo pipefail
cd /home/z/my-project

VALKEY_DIR=/home/z/my-project/infra/valkey/valkey-8.1.1
BIN=$VALKEY_DIR/src/valkey-server

if [ -x "$BIN" ]; then
  echo "valkey-server already built — skip compile"
else
  echo "── [1/4] Downloading Valkey 8.1.1 tarball ──"
  mkdir -p /home/z/my-project/infra/valkey
  cd /home/z/my-project/infra/valkey
  if [ ! -f valkey-8.1.1.tar.gz ]; then
    curl -fsSL -o valkey-8.1.1.tar.gz https://github.com/valkey-io/valkey/archive/refs/tags/8.1.1.tar.gz
  fi
  tar -xzf valkey-8.1.1.tar.gz
  ls -d valkey-8.1.1

  echo "── [2/4] Building deps ──"
  cd "$VALKEY_DIR"
  make -C deps hiredis linenoise hdr_histogram fpconv lua fast_float_c_interface -j"$(nproc)" 2>&1 | tail -2

  echo "── [3/4] Building valkey-server (MALLOC=libc) ──"
  make -C src valkey-server MALLOC=libc -j"$(nproc)" 2>&1 | tail -2
  ls -la "$BIN"
fi

echo "── [4/4] Writing valkey.conf ──"
mkdir -p /home/z/my-project/db/valkey-data
cat > /home/z/my-project/infra/valkey/valkey.conf <<'EOF'
# Garfix Valkey config (r14: noeviction — mandatory for BullMQ queue safety)
bind 127.0.0.1
port 6379
daemonize no
dir /home/z/my-project/db/valkey-data
maxmemory 256mb
maxmemory-policy noeviction
appendonly yes
save 900 1
save 300 10
save 60 10000
EOF
echo "conf written"

echo "── Starting valkey-server ──"
nohup "$BIN" /home/z/my-project/infra/valkey/valkey.conf > /home/z/my-project/infra/valkey-daemon.log 2>&1 &
sleep 2
if rg -q "Ready to accept connections" /home/z/my-project/infra/valkey-daemon.log; then
  echo "── DONE: Valkey 8.1.1 is up on 127.0.0.1:6379 ──"
else
  echo "── WARNING: valkey may still be starting, check log ──"
  tail -5 /home/z/my-project/infra/valkey-daemon.log
fi
