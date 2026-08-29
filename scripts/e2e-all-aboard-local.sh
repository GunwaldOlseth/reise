#!/usr/bin/env bash
# PUT then GET a journey with allAboardTime against the local Go API.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8082/api}"

health=$(curl -sS -o /tmp/reise-health.json -w "%{http_code}" "$BASE/health")
echo "GET $BASE/health -> $health"
if [[ "$health" != "200" ]]; then
  echo "Backend is not up. Start: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-reise PORT=8082 go run .  (in backend/api)"
  cat /tmp/reise-health.json 2>/dev/null || true
  exit 1
fi

trip_code=$(curl -sS -o /tmp/reise-trip.json -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"name":"All aboard e2e","startDate":"2026-09-01","endDate":"2026-09-08","features":{"cruise":true,"packages":false}}' \
  "$BASE/trips")
echo "POST $BASE/trips -> $trip_code"
python3 - <<'PY'
import json,sys
t=json.load(open("/tmp/reise-trip.json"))
if not t.get("id"):
    print(t, file=sys.stderr)
    sys.exit("create trip failed")
open("/tmp/reise-trip-id.txt","w").write(t["id"])
print("tripId", t["id"])
PY
TRIP=$(cat /tmp/reise-trip-id.txt)

put_body=$(cat <<EOF
{
  "tripId": "$TRIP",
  "stops": [{
    "id": "stop_cruise",
    "city": "Bergen",
    "country": "Norge",
    "arriveDate": "2026-09-01",
    "kind": "cruise",
    "sortOrder": 0,
    "pack": {
      "nights": 2,
      "title": "Testskip",
      "basePlace": "Bergen",
      "days": [
        {"id": "d0", "offset": "0", "atSea": false, "city": "Bergen", "arriveTime": "", "leaveTime": "17:00", "allAboardTime": "16:30"},
        {"id": "d1", "offset": 1, "atSea": false, "city": "Flam", "arriveTime": "08:00", "leaveTime": "16:00", "allAboardTime": "15:45"}
      ]
    }
  }],
  "legs": []
}
EOF
)

put_code=$(curl -sS -o /tmp/reise-put-journey.json -w "%{http_code}" \
  -X PUT -H "Content-Type: application/json" -d "$put_body" \
  "$BASE/trips/$TRIP/journey")
echo "PUT $BASE/trips/$TRIP/journey -> $put_code"
if [[ "$put_code" != "200" ]]; then
  cat /tmp/reise-put-journey.json
  exit 1
fi

get_code=$(curl -sS -o /tmp/reise-get-journey.json -w "%{http_code}" \
  "$BASE/trips/$TRIP/journey")
echo "GET $BASE/trips/$TRIP/journey -> $get_code"

python3 - <<'PY'
import json,sys
j=json.load(open("/tmp/reise-get-journey.json"))
days=(j.get("stops") or [{}])[0].get("pack",{}).get("days") or []
aboard=[(d.get("offset"), d.get("allAboardTime")) for d in days]
print("GET days allAboardTime:", aboard)
if not any(t=="16:30" for _,t in aboard):
    print(json.dumps(j, indent=2)[:2000])
    sys.exit("allAboardTime 16:30 missing after GET")
if not any(t=="15:45" for _,t in aboard):
    sys.exit("allAboardTime 15:45 missing after GET")
print("ok round-trip allAboardTime")
PY
