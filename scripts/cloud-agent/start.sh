#!/usr/bin/env bash
# Per-boot startup for the Reise dev environment.
# Idempotent: starts the Firestore emulator, Go API, and Vite dev server in the
# background (skipping any already listening), waits for readiness, then returns.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGDIR="${HOME}/.reise-dev/logs"
mkdir -p "$LOGDIR"

# Returns 0 if something is already answering on the given URL.
serving() { curl -fsS -o /dev/null "$1" 2>/dev/null; }

wait_for() {
  local url="$1" name="$2" tries="${3:-90}"
  for _ in $(seq 1 "$tries"); do
    if serving "$url"; then echo "[start] $name is up."; return 0; fi
    sleep 1
  done
  echo "[start] WARNING: $name did not become ready ($url)"; return 1
}

launch() {
  local name="$1" script="$2"
  echo "[start] Launching $name..."
  nohup bash "$ROOT/scripts/cloud-agent/$script" >"$LOGDIR/$name.log" 2>&1 &
  echo "[start] $name pid $! (logs: $LOGDIR/$name.log)"
}

# 1. Firestore emulator (127.0.0.1:8080)
if serving "http://127.0.0.1:8080/"; then
  echo "[start] Firestore emulator already running."
else
  launch "firestore-emulator" "run-emulator.sh"
fi
wait_for "http://127.0.0.1:8080/" "Firestore emulator" || true

# 2. Go API (:8082)
if serving "http://127.0.0.1:8082/api/health"; then
  echo "[start] Backend already running."
else
  launch "backend" "run-backend.sh"
fi
wait_for "http://127.0.0.1:8082/api/health" "Backend API" || true

# 3. Vite dev server (:5174)
if serving "http://127.0.0.1:5174/"; then
  echo "[start] Frontend already running."
else
  launch "frontend" "run-frontend.sh"
fi
wait_for "http://127.0.0.1:5174/" "Frontend dev server" || true

echo "[start] Reise dev environment is ready."
echo "[start]   Firestore emulator : http://127.0.0.1:8080"
echo "[start]   Go API             : http://127.0.0.1:8082/api"
echo "[start]   Frontend (Vite)    : http://127.0.0.1:5174"
