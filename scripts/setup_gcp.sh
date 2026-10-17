#!/usr/bin/env bash
# One-time Google Cloud setup for FaceVeto. Safe to re-run: existing resources are skipped.
# Firestore (default) must already exist in the region (create it in the console first).
set -euo pipefail

PROJECT=${PROJECT:-faceveto-2026}
REGION=${REGION:-asia-southeast1}
BUCKET=gs://$PROJECT-faceveto-media
SA=faceveto-api@$PROJECT.iam.gserviceaccount.com
cd "$(dirname "$0")/.."

gcloud config set project "$PROJECT"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com storage.googleapis.com aiplatform.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com logging.googleapis.com \
  firebase.googleapis.com identitytoolkit.googleapis.com pubsub.googleapis.com

# Rules plus composite and vector indexes (face_templates.embedding, 512-d, flat)
firebase deploy --only firestore:indexes,firestore:rules --project "$PROJECT"

# Media bucket (private, uniform access, quarantine auto-delete after 30 days)
if ! gcloud storage buckets describe "$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "$BUCKET" --location="$REGION" --uniform-bucket-level-access \
    --public-access-prevention
fi
gcloud storage buckets update "$BUCKET" --lifecycle-file=scripts/lifecycle.json

# Runtime service account
if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create faceveto-api --display-name="FaceVeto API"
fi
for ROLE in roles/datastore.user roles/aiplatform.user roles/logging.logWriter roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" \
    --condition=None --quiet >/dev/null
done
# Needed for create_custom_token (demo login) on Cloud Run: the SA signs blobs as itself.
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" \
  --role=roles/iam.serviceAccountTokenCreator --quiet >/dev/null
gcloud storage buckets add-iam-policy-binding "$BUCKET" --member="serviceAccount:$SA" \
  --role=roles/storage.objectAdmin --quiet >/dev/null

echo "Setup done for $PROJECT"
