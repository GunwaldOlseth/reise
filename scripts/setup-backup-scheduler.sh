#!/usr/bin/env bash
# Create GCS bucket + Cloud Scheduler jobs (08:00, 14:00, 19:00 Europe/Oslo).
set -euo pipefail

PROJECT="${GCP_PROJECT:-homey-376215}"
REGION="${GCP_REGION:-europe-north1}"
SCHEDULER_LOCATION="${SCHEDULER_LOCATION:-europe-west1}"
BACKEND_SERVICE="${BACKEND_SERVICE:-reise-backend}"
BUCKET="${BACKUP_BUCKET:-${PROJECT}-reise-backups}"
TZ_NAME="${BACKUP_TZ:-Europe/Oslo}"

gcloud config set project "$PROJECT"

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(status.url)')"
if [[ -z "$BACKEND_URL" ]]; then
  echo "Backend URL not found. Deploy reise-backend first."
  exit 1
fi

echo "==> Bucket: gs://$BUCKET"
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
fi

SA="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')"
if [[ -z "$SA" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
  SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin" \
  --quiet

SECRET="${BACKUP_CRON_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  SECRET="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='yaml(spec.template.spec.containers[0].env)' | awk '/name: BACKUP_CRON_SECRET/{getline; if ($1=="value:") print $2}')"
fi
if [[ -z "$SECRET" ]]; then
  SECRET="$(openssl rand -hex 24)"
  echo "==> Generated BACKUP_CRON_SECRET (set on Cloud Run)"
fi

ADMIN_PW="${ADMIN_PASSWORD:-}"
if [[ -z "$ADMIN_PW" ]]; then
  ADMIN_PW="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='yaml(spec.template.spec.containers[0].env)' | awk '/name: ADMIN_PASSWORD/{getline; if ($1=="value:") print $2}')"
fi
if [[ -z "$ADMIN_PW" ]]; then
  ADMIN_PW="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  echo "==> Generated ADMIN_PASSWORD: $ADMIN_PW"
  echo "    Lagre dette — brukes under Innstillinger → Admin."
fi

echo "==> Updating Cloud Run env..."
gcloud run services update "$BACKEND_SERVICE" \
  --region "$REGION" \
  --update-env-vars="FIREBASE_PROJECT_ID=${PROJECT},BACKUP_BUCKET=${BUCKET},BACKUP_CRON_SECRET=${SECRET},ADMIN_PASSWORD=${ADMIN_PW}" \
  --quiet

create_job() {
  local name="$1"
  local schedule="$2"
  local path="$3"
  if gcloud scheduler jobs describe "$name" --location="$SCHEDULER_LOCATION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$name" \
      --location="$SCHEDULER_LOCATION" \
      --schedule="$schedule" \
      --time-zone="$TZ_NAME" \
      --uri="${BACKEND_URL}${path}" \
      --http-method=POST \
      --headers="X-Backup-Secret=${SECRET}" \
      --quiet
  else
    gcloud scheduler jobs create http "$name" \
      --location="$SCHEDULER_LOCATION" \
      --schedule="$schedule" \
      --time-zone="$TZ_NAME" \
      --uri="${BACKEND_URL}${path}" \
      --http-method=POST \
      --headers="X-Backup-Secret=${SECRET}" \
      --quiet
  fi
}

echo "==> Scheduler jobs (Europe/Oslo)..."
create_job reise-backup-08 "0 8 * * *" "/api/internal/backup"
create_job reise-backup-14 "0 14 * * *" "/api/internal/backup"
create_job reise-backup-19 "0 19 * * *" "/api/internal/backup"
create_job reise-weather-08 "10 8 * * *" "/api/internal/weather-refresh"
create_job reise-weather-19 "10 19 * * *" "/api/internal/weather-refresh"

echo "Done. Backups: gs://$BUCKET/backups/"
echo "Admin login: Innstillinger → Admin · sikkerhetskopi"
