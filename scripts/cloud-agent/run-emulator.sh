#!/usr/bin/env bash
# Long-running: credential-free Cloud Firestore emulator on 127.0.0.1:8080.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Run from a dedicated dir so firebase-debug/firestore-debug logs stay out of the repo.
RUNDIR="${HOME}/.reise-dev"
mkdir -p "$RUNDIR"
cd "$RUNDIR"

exec firebase emulators:start \
  --only firestore \
  --config "$ROOT/.cursor/firebase.emulator.json" \
  --project demo-reise
