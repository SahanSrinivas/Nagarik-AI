#!/usr/bin/env bash
# Daily happy-path probe — submits a Case A pothole, drives crew complete
# with the matching resolved photo, and asserts the ResolutionAgent verdict
# is verified_resolved. Catches regressions in Gemini classification,
# Triage routing, crew dispatch, and CLIP+CNN audit in a single run.
#
# Usage:
#   bash e2e/ci/happy-path.sh

set -euo pipefail

API="${API:-https://api.nagarikai.xyz}"
USER="${DEMO_USER:-H@cktHon}"
PASS="${DEMO_PASS:-Sw33ney@8688}"
DEPT_USER="${DEPT_USER:-bbmp_roads_supervisor}"
DEPT_PASS="${DEPT_PASS:-supervisor2026}"
BEFORE="${BEFORE:-https://nagarikai.xyz/test-photos/case_a_reported.jpg}"
AFTER="${AFTER:-https://nagarikai.xyz/test-photos/case_a_resolved.jpg}"

py() { python3 -c "$1"; }

TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | py "import sys,json;print(json.load(sys.stdin)['access_token'])")

DEPT=$(curl -sS -X POST "$API/auth/dept-login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$DEPT_USER\",\"password\":\"$DEPT_PASS\"}" \
  | py "import sys,json;print(json.load(sys.stdin)['access_token'])")

ID=$(curl -sS -X POST "$API/issues" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"lat\":12.9352,\"lng\":77.6245,\"description\":\"Daily CI happy path\",\"before_photo_url\":\"$BEFORE\"}" \
  | py "import sys,json;print(json.load(sys.stdin)['id'])")
echo "issue: $ID"

# Wait for Triage (Vision → Dedup → Triage), up to 120s
for i in $(seq 1 24); do
  sleep 5
  R=$(curl -sS "$API/issues/$ID" \
    | py "import sys,json;print(json.load(sys.stdin).get('routed_department'))")
  echo "[$i] routed=$R"
  [ "$R" = "BBMP Roads" ] && break
done
if [ "$R" != "BBMP Roads" ]; then
  echo "HAPPY-PATH REGRESSION: Triage did not route to BBMP Roads (got: $R)"
  exit 1
fi

# Force-assign first crew (Scheduler doesn't persist assigned_crew_id yet)
CREW=$(curl -sS "$API/supervisor/crews" -H "Authorization: Bearer $DEPT" \
  | py "import sys,json;print(json.load(sys.stdin)['crews'][0]['id'])")
curl -sS -X POST "$API/supervisor/issue/$ID/reassign-crew?crew_id=$CREW" \
  -H "Authorization: Bearer $DEPT" >/dev/null
curl -sS -X POST "$API/crew/${CREW}/complete/${ID}?after_photo_url=${AFTER}" \
  -H "Authorization: Bearer $DEPT" >/dev/null

echo "crew complete fired — waiting 75s for ResolutionAgent (CLIP + pothole CNN)"
sleep 75

VERDICT=$(curl -sS "$API/supervisor/issue/$ID" -H "Authorization: Bearer $DEPT" \
  | py "
import sys, json
d = json.load(sys.stdin)
res = [e for e in d.get('events', []) if e['agent']=='resolution' and e['status']=='completed']
for ev in res:
    ai = (ev.get('payload', {}) or {}).get('ai_meta', {}) or {}
    v = ai.get('verdict')
    if v:
        print(v); break
")
echo "Resolution verdict: $VERDICT"

if [ "$VERDICT" != "verified_resolved" ]; then
  echo "HAPPY-PATH REGRESSION: expected verified_resolved, got '$VERDICT'"
  exit 1
fi
echo "HAPPY-PATH PASSED: verdict=verified_resolved"
