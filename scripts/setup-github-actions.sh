#!/usr/bin/env bash
# Configure GitHub Actions deploy secret and optionally trigger deploy workflows.
#
# Prerequisites:
#   - GitHub CLI: https://cli.github.com/
#   - gh auth login (with repo + workflow scopes)
#   - JSON key for deploy-app@homey-376215.iam.gserviceaccount.com
#
# Usage:
#   bash scripts/setup-github-actions.sh path/to/service-account-key.json
#   bash scripts/setup-github-actions.sh path/to/service-account-key.json --trigger
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE=""
TRIGGER=false

for arg in "$@"; do
  case "$arg" in
    --trigger) TRIGGER=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$KEY_FILE" ]]; then
        KEY_FILE="$arg"
      else
        echo "Unknown argument: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$KEY_FILE" ]]; then
  echo "Usage: $0 <service-account-key.json> [--trigger]" >&2
  exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Key file not found: $KEY_FILE" >&2
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo "GitHub CLI (gh) is required. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run 'gh auth login' first (needs repo + workflow scopes)." >&2
  exit 1
fi

if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d.get("type")=="service_account"' "$KEY_FILE" 2>/dev/null; then
  echo "Invalid service account JSON: $KEY_FILE" >&2
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "==> Setting GCP_SA_KEY secret on $REPO"
gh secret set GCP_SA_KEY <"$KEY_FILE"
echo "==> GCP_SA_KEY configured"

if [[ "$TRIGGER" == true ]]; then
  echo "==> Triggering deploy workflows on master"
  gh workflow run deploy-backend.yml --ref master
  gh workflow run deploy-frontend.yml --ref master
  echo "==> Workflows started. Check: https://github.com/$REPO/actions"
else
  echo "==> Done. Run with --trigger to start deploy workflows, or push to master."
fi
