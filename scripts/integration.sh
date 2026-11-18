#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"

wait_status() {
  local expected="$1" path="$2" attempts="${3:-50}" actual=""
  for ((i=1; i<=attempts; i++)); do
    actual="$(curl -sS --max-time 7 -o /dev/null -w '%{http_code}' "$BASE_URL$path" 2>/dev/null || true)"
    if [[ "$actual" == "$expected" ]]; then
      printf 'PASS %-26s HTTP %s\n' "$path" "$actual"
      return 0
    fi
    sleep 1
  done
  echo "FAIL: $path returned ${actual:-none}, expected $expected" >&2
  return 1
}

capture() {
  python3 scripts/export_evidence.py "$1" --base-url "$BASE_URL"
}

recover() {
  make reset >/dev/null || true
}
trap recover EXIT

echo '== Baseline =='
wait_status 200 /health/live
wait_status 200 /health/ready
wait_status 200 /orders/1
wait_status 200 /orders/1/verify
wait_status 200 /metrics
curl -fsS "$BASE_URL/metrics" | grep -q 'traceops_db_pool_connections'
# Validate correlation on a regular GET request.
header_id="$(curl -sS -D - -o /dev/null -H 'X-Request-ID: cp15-verification' "$BASE_URL/orders/1" | tr -d '\r' | grep -i '^x-request-id:' || true)"
[[ "$header_id" == *"cp15-verification"* ]] || { echo 'Missing request correlation ID' >&2; exit 1; }

echo '== Database outage =='
make fault-db-down
wait_status 200 /health/live
wait_status 503 /health/ready
wait_status 503 /orders/1
capture cp1-db-unavailable
recover
wait_status 200 /health/ready
wait_status 200 /orders/1

echo '== Slow query =='
make fault-slow
wait_status 200 /health/ready
response="$(curl -sS --max-time 12 --output /dev/null --write-out '%{http_code} %{time_total}' "$BASE_URL/orders/1")"
read -r status elapsed <<< "$response"
test "$status" = '200' || { echo "Wrong status during slow query: $status" >&2; exit 1; }
awk -v t="$elapsed" 'BEGIN { if (t < 2.3) exit 1 }' || { echo "Query completed too quickly: $elapsed" >&2; exit 1; }
capture cp1-slow-query
recover
wait_status 200 /orders/1

echo '== Application exception =='
make fault-exception
wait_status 200 /health/ready
wait_status 500 /orders/1
capture cp1-app-exception
recover
wait_status 200 /orders/1

echo '== Upstream dependency timeout =='
make fault-upstream
wait_status 200 /health/ready
wait_status 504 /orders/1
capture cp15-upstream-timeout
recover
wait_status 200 /orders/1

echo '== Database connection-pool exhaustion =='
make fault-pool
wait_status 200 /health/ready
temp_results="$(mktemp)"
trap 'rm -f "$temp_results"; recover' EXIT
pids=()
for i in $(seq 1 8); do
  (curl -sS --max-time 12 -o /dev/null -w '%{http_code}\n' "$BASE_URL/orders/1" >> "$temp_results") &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
errors="$(grep -c '^503$' "$temp_results" || true)"
successes="$(grep -c '^200$' "$temp_results" || true)"
echo "Pool pressure responses: success=$successes unavailable=$errors"
if (( errors < 2 || successes < 1 )); then
  echo "Expected a mixture of successful and pool-acquisition-failed requests" >&2
  cat "$temp_results" >&2
  exit 1
fi
capture cp15-db-pool-exhaustion
recover
wait_status 200 /orders/1

echo '== Provider transient degradation, retry masks user-facing failure =='
make fault-provider-flaky
wait_status 200 /health/ready
python3 scripts/traffic.py --requests 12 --concurrency 3 --expect-status 200
curl -fsS "$BASE_URL/metrics" | grep -q 'traceops_dependency_retries_total{dependency="mock-provider"}'
capture cp175-provider-flaky
recover
wait_status 200 /orders/1/verify

echo '== Provider sustained outage, bounded retry fails =='
make fault-provider-outage
wait_status 200 /health/ready
python3 scripts/traffic.py --requests 8 --concurrency 2 --expect-status 502
capture cp175-provider-outage
recover
wait_status 200 /orders/1/verify

echo 'PASS all seven incident scenarios, dependency metrics and recovery'
