#!/usr/bin/env bash
# Daily red-team probe — submits 4 deliberately non-civic photos to the live
# nagarikai.xyz API and asserts they all land at status=rejected with no
# department routing. Exits non-zero if any single one leaks.
#
# Runs from GitHub Actions daily (.github/workflows/daily-e2e.yml) and is
# safe to run locally — no auth required besides the public demo creds.
#
# Usage:
#   bash e2e/ci/red-team.sh                    # against prod (default)
#   API=http://localhost:8000 bash e2e/ci/red-team.sh   # against local

set -euo pipefail

API="${API:-https://api.nagarikai.xyz}"
USER="${DEMO_USER:-H@cktHon}"
PASS="${DEMO_PASS:-Sw33ney@8688}"

py() { python3 -c "$1"; }

TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | py "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Stable Unsplash CDN URLs — none of these are civic issues. Adding new
# probe photos: prefer Unsplash (no rate limit) over Wikimedia.
declare -A CASES=(
  [cat]="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=640&q=80"
  [food]="https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=640&q=80"
  [indoor]="https://images.unsplash.com/photo-1554995207-c18c203602cb?w=640&q=80"
  [selfie]="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=640&q=80"
)

declare -A IDS
for name in "${!CASES[@]}"; do
  url="${CASES[$name]}"
  id=$(curl -sS -X POST "$API/issues" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"lat\":12.9352,\"lng\":77.6245,\"description\":\"Daily CI red-team: $name\",\"before_photo_url\":\"$url\"}" \
    | py "import sys,json;print(json.load(sys.stdin)['id'])")
  IDS[$name]=$id
  echo "submitted $name → $id"
done

echo "Waiting 30s for Vision agent to reject..."
sleep 30

fail=0
for name in "${!IDS[@]}"; do
  id="${IDS[$name]}"
  line=$(curl -sS "$API/issues/$id" \
    | py "import sys,json;d=json.load(sys.stdin);print(f\"{d.get('status')} {d.get('routed_department')}\")")
  status=$(echo "$line" | awk '{print $1}')
  routed=$(echo "$line" | awk '{print $2}')
  if [ "$status" = "rejected" ] && [ "$routed" = "None" ]; then
    echo "  ✅ $name → rejected · routed=None"
  else
    echo "  ❌ $name → status=$status routed=$routed  LEAK"
    fail=$((fail + 1))
  fi
done

if [ "$fail" -gt 0 ]; then
  echo "RED-TEAM REGRESSION: $fail of ${#IDS[@]} photos leaked through the guardrail"
  exit 1
fi
echo "RED-TEAM PASSED: ${#IDS[@]}/${#IDS[@]} non-civic photos correctly rejected"
