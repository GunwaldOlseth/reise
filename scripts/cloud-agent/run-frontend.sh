#!/usr/bin/env bash
# Long-running: React/Vite dev server on :5174 (proxies /api to the Go backend).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/frontend"

export VITE_API_URL="http://127.0.0.1:8082/api"

exec npm run dev -- --host
