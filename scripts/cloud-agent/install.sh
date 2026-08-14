#!/usr/bin/env bash
# Idempotent dependency refresh for the Reise Cloud Agent environment.
# Safe to run repeatedly; installs nothing that must survive as a process.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GO_WANT="1.25.2"

echo "[install] Repo root: $ROOT"

# 1. Ensure Go matches go.mod (backend requires go 1.25.x; some base images ship older).
need_go=1
if command -v go >/dev/null 2>&1 && go version | grep -q 'go1\.25\.'; then
  need_go=0
fi
if [ "$need_go" -eq 1 ]; then
  echo "[install] Installing Go ${GO_WANT}..."
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/go.tgz" "https://go.dev/dl/go${GO_WANT}.linux-amd64.tar.gz"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "$tmp/go.tgz"
  rm -rf "$tmp"
fi
export PATH="/usr/local/go/bin:$PATH"
go version

# 2. Firebase CLI (provides the credential-free Firestore emulator).
if ! command -v firebase >/dev/null 2>&1; then
  echo "[install] Installing firebase-tools..."
  sudo env "PATH=$PATH" npm install -g firebase-tools
fi
firebase --version

# 3. Backend Go module cache.
echo "[install] Downloading Go modules..."
( cd "$ROOT/backend/api" && go mod download )

# 4. Frontend node modules.
echo "[install] Installing frontend dependencies..."
( cd "$ROOT/frontend" && npm ci )

# 5. Pre-fetch the Firestore emulator jar so the first boot is fast.
echo "[install] Ensuring Firestore emulator jar is present..."
firebase setup:emulators:firestore

echo "[install] Done."
