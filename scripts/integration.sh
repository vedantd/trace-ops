#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"

wait_status() {
  local expected="$1" path="$2" attempts="${3:-50}" actual=""
  for ((i=1; i<=attempts; i++)); do
    actual="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$BASE_URL$path" 2>/dev/null || true)"
    if [[ "$actual" == "$expected" ]]; then
      printf 'PASS %-26s HTTP %s\n' "$path" "$actual"
      return 0
    fi
    sleep 1
  done
  echo "FAIL: $path returned ${actual:-none}, expected $expected" >&2
  return 1
}

recover() {
  make reset >/dev/null || true
}
trap recover EXIT

echo '== Baseline =='
wait_status 200 /health/live
wait_status 200 /health/ready
wait_status 200 /orders/1

echo '== Database outage =='
make fault-db-down
wait_status 200 /health/live
wait_status 503 /health/ready
wait_status 503 /orders/1
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
echo "PASS slow query elapsed ${elapsed}s"
recover
wait_status 200 /orders/1

echo '== Application exception =='
make fault-exception
wait_status 200 /health/ready
wait_status 500 /orders/1
recover
wait_status 200 /orders/1

echo 'PASS all three incident scenarios and recovery'
