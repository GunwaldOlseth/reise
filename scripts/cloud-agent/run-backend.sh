#!/usr/bin/env bash
# Long-running: Reise Go API on :8082, backed by the local Firestore emulator.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/usr/local/go/bin:$PATH"

echo "[backend] Waiting for Firestore emulator on 127.0.0.1:8080..."
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
    echo "[backend] Firestore emulator is up."
    break
  fi
  sleep 1
done

cd "$ROOT/backend/api"

# No GCP service account needed: the Firestore Go client talks to the emulator.
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export FIREBASE_PROJECT_ID="demo-reise"
export PORT="8082"

exec go run .
