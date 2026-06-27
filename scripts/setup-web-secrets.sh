#!/usr/bin/env bash
# Idempotent one-time setup for nagarikai-web build secrets.
#
# Creates the `mapbox-token` secret in Secret Manager from the value in
# apps/web/.env.local, then grants Cloud Build's service account permission
# to read it. Safe to re-run — the secret gets a new version if it exists,
# and the IAM binding is a no-op if already granted.
#
# Usage (from repo root):
#   bash scripts/setup-web-secrets.sh
#
# Requirements:
#   - You're authenticated as a member of the nagarikai-demo project
#   - apps/web/.env.local contains a line: NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-nagarikai-demo}"
SECRET_NAME="mapbox-token"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/apps/web/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

# Extract the value without echoing it.
TOKEN=$(grep -E '^NEXT_PUBLIC_MAPBOX_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: NEXT_PUBLIC_MAPBOX_TOKEN not set in $ENV_FILE." >&2
  exit 1
fi
echo "Found Mapbox token (length=${#TOKEN}, starts with ${TOKEN:0:5}...)."

# 1. Create the secret if missing, then add a new version.
if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating secret $SECRET_NAME..."
  gcloud secrets create "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --replication-policy=automatic
fi
echo "Adding new version to $SECRET_NAME..."
printf '%s' "$TOKEN" | gcloud secrets versions add "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --data-file=-

# 2. Grant the Cloud Build service account access to the secret.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "Granting secretAccessor on $SECRET_NAME to $CB_SA..."
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None >/dev/null

echo
echo "Done. Now deploy with:"
echo "  cd apps/web && gcloud builds submit --config=cloudbuild.yaml --region=asia-south1"
