#!/usr/bin/env bash
# Configure GitHub Actions deploy secret and optionally trigger deploy workflows.
#
# Prerequisites:
#   - GitHub CLI: https://cli.github.com/
#   - gh auth login as repo admin (needs repo + workflow scopes)
#   - JSON key for deploy-app@homey-376215.iam.gserviceaccount.com
#
# Usage:
#   bash scripts/setup-github-actions.sh path/to/service-account-key.json
#   bash scripts/setup-github-actions.sh path/to/service-account-key.json --trigger
#   bash scripts/setup-github-actions.sh --trigger          # uses $deplpy env (Cloud Agent)
#   bash scripts/setup-github-actions.sh --check          # verify secret exists
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE=""
TRIGGER=false
CHECK=false
TEMP_KEY=""
REPO="${GITHUB_REPOSITORY:-GunwaldOlseth/reise}"

cleanup() {
  if [[ -n "$TEMP_KEY" && -f "$TEMP_KEY" ]]; then
    rm -f "$TEMP_KEY"
  fi
}
trap cleanup EXIT

for arg in "$@"; do
  case "$arg" in
    --trigger) TRIGGER=true ;;
    --check) CHECK=true ;;
    -h|--help)
      sed -n '2,15p' "$0"
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

if ! command -v gh >/dev/null; then
  echo "GitHub CLI (gh) is required. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run 'gh auth login' first (needs repo + workflow scopes)." >&2
  exit 1
fi

if [[ "$CHECK" == true ]]; then
  echo "==> Checking Actions secrets on $REPO"
  if gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx SA_REISE; then
    echo "==> SA_REISE is configured"
    exit 0
  fi
  echo "==> SA_REISE is NOT set on $REPO" >&2
  echo "    Run: bash scripts/setup-github-actions.sh [--trigger]" >&2
  exit 1
fi

if [[ -z "$KEY_FILE" ]]; then
  if [[ -n "${deplpy:-}" ]]; then
    TEMP_KEY="$(mktemp)"
    echo "$deplpy" >"$TEMP_KEY"
    KEY_FILE="$TEMP_KEY"
    echo "==> Using deploy key from \$deplpy environment variable"
  elif [[ -n "${GCP_SA_KEY_JSON:-}" ]]; then
    TEMP_KEY="$(mktemp)"
    echo "$GCP_SA_KEY_JSON" >"$TEMP_KEY"
    KEY_FILE="$TEMP_KEY"
    echo "==> Using deploy key from \$GCP_SA_KEY_JSON environment variable"
  else
    echo "Usage: $0 [service-account-key.json] [--trigger|--check]" >&2
    echo "       Or set \$deplpy / \$GCP_SA_KEY_JSON with the service account JSON." >&2
    exit 1
  fi
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Key file not found: $KEY_FILE" >&2
  exit 1
fi

if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d.get("type")=="service_account"' "$KEY_FILE" 2>/dev/null; then
  echo "Invalid service account JSON: $KEY_FILE" >&2
  exit 1
fi

echo "==> Setting SA_REISE secret on $REPO"
if ! gh secret set SA_REISE --repo "$REPO" <"$KEY_FILE"; then
  echo "" >&2
  echo "Failed to set secret. Common causes:" >&2
  echo "  - gh is logged in as a bot/integration without admin access" >&2
  echo "  - Run: gh auth login  (as repo owner/admin)" >&2
  echo "  - Or add manually: GitHub → Settings → Secrets → Actions → SA_REISE" >&2
  exit 1
fi
echo "==> SA_REISE configured"

if [[ "$TRIGGER" == true ]]; then
  echo "==> Triggering deploy workflows on master"
  gh workflow run deploy-backend.yml --repo "$REPO" --ref master
  gh workflow run deploy-frontend.yml --repo "$REPO" --ref master
  echo "==> Workflows started. Check: https://github.com/$REPO/actions"
else
  echo "==> Done. Run with --trigger to start deploy workflows, or push to master."
fi
