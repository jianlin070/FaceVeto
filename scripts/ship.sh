#!/usr/bin/env bash
# Test, deploy only what changed since the live version, then verify the live site.
# Prints a short summary; full logs go to a temp folder shown at the end.
#   scripts/ship.sh          deploy what changed (API, web, or both)
#   scripts/ship.sh --all    deploy both
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=faceveto-2026
REGION=asia-southeast1
URL=https://faceveto.web.app
LOGS=$(mktemp -d "${TMPDIR:-/tmp}/faceveto-ship.XXXXXX")
HEAD_SHA=$(git rev-parse --short HEAD)
ALL=${1:-}

step() { printf '%-28s' "$1"; }
ok() { echo "ok${1:+  ($1)}"; }
fail() { echo "FAILED, see $LOGS/$1.log"; tail -n 15 "$LOGS/$1.log"; exit 1; }
run() { local name=$1; shift; "$@" >"$LOGS/$name.log" 2>&1 || fail "$name"; }

# Deploy only committed code, so the live site always matches a commit on GitHub.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes: commit (and push) first."; exit 1
fi
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || echo "Note: HEAD $HEAD_SHA is not the same as origin/main."

# What is live now: the API carries a commit label, the web app serves version.txt.
live_api=$(gcloud run services describe faceveto-api --region $REGION --project $PROJECT \
  --format='value(metadata.labels.commit)' 2>/dev/null || true)
live_web=$(curl -fsS --max-time 10 "$URL/version.txt" 2>/dev/null | tr -d '[:space:]' || true)

changed() { # changed <live sha> <paths...>: true if those paths differ from the live commit
  local sha=$1; shift
  [ -n "$ALL" ] || [ -z "$sha" ] || ! git cat-file -e "$sha^{commit}" 2>/dev/null || ! git diff --quiet "$sha" HEAD -- "$@"
}
deploy_api=no; deploy_web=no
changed "$live_api" api/ && deploy_api=yes
changed "$live_web" web/ firebase.json && deploy_web=yes
echo "Deploying $HEAD_SHA   api: $deploy_api (live ${live_api:-unknown})   web: $deploy_web (live ${live_web:-unknown})"
if [ $deploy_api = no ] && [ $deploy_web = no ]; then echo "Nothing to deploy."; exit 0; fi

if [ $deploy_api = yes ]; then
  step "API tests"; run test make test; ok "$(grep -Eo '[0-9]+ passed' "$LOGS/test.log")"
fi
if [ $deploy_web = yes ]; then
  step "Web type check + build"; run build make build-web; ok
fi
if [ $deploy_api = yes ]; then
  step "Deploy API (Cloud Run)"; run deploy-api make deploy-api
  ok "$(sed 's/\x1b\[[0-9;]*m//g' "$LOGS/deploy-api.log" | grep -Eo 'revision \[[^]]*\]' | tr -d '[]' | head -1)"
fi
if [ $deploy_web = yes ]; then
  step "Deploy web (Hosting)"; run deploy-web firebase deploy --only hosting --project $PROJECT; ok
fi

step "Live health check"
curl -fsS --retry 5 --retry-delay 5 --retry-all-errors "$URL/api/healthz" >"$LOGS/health.log" 2>&1 || fail health
grep -q '"ok":true' "$LOGS/health.log" || fail health; ok
if [ $deploy_web = yes ]; then
  step "Live web version"
  [ "$(curl -fsS "$URL/version.txt" | tr -d '[:space:]')" = "$HEAD_SHA" ] && ok "$HEAD_SHA" || { echo "mismatch"; exit 1; }
fi
if [ $deploy_api = yes ]; then
  step "End-to-end checks"
  if ! api/.venv/bin/python scripts/e2e_demo.py >"$LOGS/e2e.log" 2>&1; then
    # Retry once only if it died before any check ran (a network blip), so no test data is left half made.
    grep -qE '^(PASS|FAIL) ' "$LOGS/e2e.log" && fail e2e
    run e2e api/.venv/bin/python scripts/e2e_demo.py
  fi
  ok "$(grep -E 'checks passed' "$LOGS/e2e.log")"
fi
echo "Done. Live: $URL   Logs: $LOGS"
