#!/usr/bin/env bash
# Daily happy-path probe — submits a Case A pothole, waits for the
# Scheduler to auto-assign a crew, drives crew complete with the
# matching resolved photo, and asserts the ResolutionAgent verdict
# is verified_resolved. Catches regressions across the whole agent
# chain: Gemini classification, Triage routing, Scheduler MILP +
# UUID persist, crew dispatch, and CLIP+CNN closure audit.
#
# The manual /supervisor/issue/.../reassign-crew workaround was
# removed once the Scheduler's UUID/ORM persist bug was fixed — so
# any future regression of that bug fails this script and trips the
# notify-on-failure GitHub Action.
#
# Description is suffixed with a per-run epoch + nonce so the
# Vertex-AI text-embedding dedup signal doesn't (correctly) flag
# repeat runs as duplicates of previous CI runs.
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

# Each run lands at a small random jitter (~1km radius) around a
# Bengaluru anchor so the dedup geo prefilter (50m radius) doesn't
# match prior CI runs. Combined with a substantially-different
# per-run description, this defeats both the geo and Vertex-AI
# text-embedding dedup signals so every run reaches Triage.
ANCHOR_LAT="${ANCHOR_LAT:-12.9716}"
ANCHOR_LNG="${ANCHOR_LNG:-77.6412}"
NONCE="$(date +%s)-$$"
# 4-decimal jitter ≈ ±0.005 deg ≈ ±550m — outside the 50m dedup radius.
# python3 -c inline since the py() helper is defined later in the file.
LAT=$(python3 -c "import random; random.seed('${NONCE}'); print(round(${ANCHOR_LAT}+random.uniform(-0.005,0.005),5))")
LNG=$(python3 -c "import random; random.seed('${NONCE}-lng'); print(round(${ANCHOR_LNG}+random.uniform(-0.005,0.005),5))")
# Per-run varied wording so Vertex AI text embedding doesn't cluster
# this run with a previous CI run.
WARDS=(Indiranagar Koramangala "HSR Layout" Whitefield Bellandur "BTM Layout" Jayanagar Malleshwaram Hebbal Marathahalli)
TIMES=(morning afternoon evening "after rain" "during peak hours" "near a school" "on the bus route" "outside a hospital")
PICK_WARD=${WARDS[$RANDOM % ${#WARDS[@]}]}
PICK_TIME=${TIMES[$RANDOM % ${#TIMES[@]}]}
DESCRIPTION="CI run $NONCE pothole reported $PICK_TIME in $PICK_WARD — auto-rickshaws braking abruptly, ambulance route, photo attached"

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
  -d "{\"lat\":$LAT,\"lng\":$LNG,\"description\":\"$DESCRIPTION\",\"before_photo_url\":\"$BEFORE\"}" \
  | py "import sys,json;print(json.load(sys.stdin)['id'])")
echo "issue: $ID (nonce=$NONCE)"

# Wait for the Scheduler to auto-assign a crew. Pipeline order is
# Vision → Dedup → Triage (routes to BBMP Roads) → Verification →
# Scheduler (sets assigned_crew_id via the ORM-style update). We poll
# the supervisor view because that's where the crew binding surfaces.
CREW=""
ROUTED=""
for i in $(seq 1 30); do
  sleep 5
  ROUTED=$(curl -sS "$API/issues/$ID" \
    | py "import sys,json;print(json.load(sys.stdin).get('routed_department'))")
  CREW=$(curl -sS "$API/supervisor/issue/$ID" -H "Authorization: Bearer $DEPT" \
    | py "import sys,json;d=json.load(sys.stdin);print((d.get('crew') or {}).get('id') or '')" 2>/dev/null || echo "")
  echo "[$i] routed=$ROUTED crew=${CREW:-none}"
  [ -n "$CREW" ] && break
done

if [ "$ROUTED" != "BBMP Roads" ]; then
  echo "HAPPY-PATH REGRESSION: Triage did not route to BBMP Roads (got: $ROUTED)"
  exit 1
fi
if [ -z "$CREW" ]; then
  echo "HAPPY-PATH REGRESSION: SchedulerAgent did not auto-assign a crew."
  echo "  This used to be papered over with a manual /reassign-crew call —"
  echo "  if you're seeing this, the SQLAlchemy UUID/ORM persist fix in"
  echo "  scheduler_agent.py likely regressed."
  exit 1
fi

# Pure crew flow — no /supervisor/.../reassign-crew workaround.
curl -sS -X POST "$API/crew/${CREW}/complete/${ID}?after_photo_url=${AFTER}" \
  -H "Authorization: Bearer $DEPT" >/dev/null

echo "crew complete fired — polling for ResolutionAgent verdict (CLIP + pothole CNN, up to 3 min)"

# Poll for a Resolution.completed event with a verdict instead of a
# single sleep — CLIP + pothole CNN can take 30-90s depending on cold
# start and the bounded Vertex AI dedup re-run.
VERDICT=""
for i in $(seq 1 18); do
  sleep 10
  VERDICT=$(curl -sS "$API/supervisor/issue/$ID" -H "Authorization: Bearer $DEPT" \
    | py "
import sys, json
d = json.load(sys.stdin)
# Look at the LAST Resolution event with a verdict (re-fire from crew
# complete creates a second one; we want the post-after-photo verdict).
res = [e for e in d.get('events', []) if e['agent']=='resolution' and e['status']=='completed']
for ev in reversed(res):
    ai = (ev.get('payload', {}) or {}).get('ai_meta', {}) or {}
    v = ai.get('verdict')
    if v:
        print(v); break
")
  if [ -n "$VERDICT" ]; then
    echo "  [Resolution poll $i] verdict=$VERDICT"
    break
  fi
  echo "  [Resolution poll $i] still pending..."
done

if [ "$VERDICT" != "verified_resolved" ]; then
  echo "HAPPY-PATH REGRESSION: expected verified_resolved, got '$VERDICT'"
  exit 1
fi
echo "HAPPY-PATH PASSED: verdict=verified_resolved (no manual reassign workaround)"
