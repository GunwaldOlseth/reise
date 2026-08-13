#!/usr/bin/env bash
# Deploy Reise frontend + backend to Cloud Run (europe-north1 / homey-376215).
set -euo pipefail

PROJECT="${GCP_PROJECT:-homey-376215}"
REGION="${GCP_REGION:-europe-north1}"
BACKEND_SERVICE="${BACKEND_SERVICE:-reise-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-reise-frontend}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Project: $PROJECT  Region: $REGION"

gcloud config set project "$PROJECT"

echo "==> Deploying backend ($BACKEND_SERVICE) from source..."
gcloud run deploy "$BACKEND_SERVICE" \
  --source "$ROOT/backend/api" \
  --region "$REGION" \
  --allow-unauthenticated \
  --update-env-vars="FIREBASE_PROJECT_ID=${PROJECT}" \
  --quiet

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(status.url)')"
echo "==> Backend URL: $BACKEND_URL"

echo "==> Deploying frontend ($FRONTEND_SERVICE) from source..."
echo "==> Using frontend/.env.production for API + Firebase (public) config"
gcloud run deploy "$FRONTEND_SERVICE" \
  --source "$ROOT/frontend" \
  --region "$REGION" \
  --allow-unauthenticated \
  --quiet

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format='value(status.url)')"
echo "==> Frontend URL: $FRONTEND_URL"
echo "Backup-scheduler (08/14/19 Europe/Oslo): bash scripts/setup-backup-scheduler.sh"
echo "Done."
