#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"

probe() {
  local label="$1" route="$2" code
  code="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "$BASE_URL$route")"
  if [[ "$code" != '200' ]]; then
    echo "FAIL: $label $route -> HTTP $code (expected 200)" >&2
    exit 1
  fi
  echo "PASS: $label $route -> HTTP 200"
}

for _ in $(seq 1 45); do
  if curl --silent --fail --max-time 1 "$BASE_URL/health/live" >/dev/null; then break; fi
  sleep 1
done
probe liveness /health/live
probe readiness /health/ready
probe sample-order /orders/1
