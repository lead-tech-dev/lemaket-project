#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

SAMPLES="${SEARCH_PERF_SAMPLES:-30}"
P95_BUDGET_MS="${SEARCH_P95_BUDGET_MS:-1500}"

if ! [[ "$SAMPLES" =~ ^[0-9]+$ ]] || [[ "$SAMPLES" -lt 5 ]]; then
  echo "SEARCH_PERF_SAMPLES must be an integer >= 5." >&2
  exit 1
fi

if ! [[ "$P95_BUDGET_MS" =~ ^[0-9]+$ ]] || [[ "$P95_BUDGET_MS" -lt 50 ]]; then
  echo "SEARCH_P95_BUDGET_MS must be an integer >= 50." >&2
  exit 1
fi

step "Search performance - warmup"
for warmup_query in "coloc" "douala" "telephone"; do
  api_call "GET" "/listings?search=${warmup_query}&limit=20&page=1"
  assert_status_in "200"
done

declare -a REQUEST_PATHS=(
  "/listings?search=coloc&limit=20&page=1"
  "/listings?search=telephone&limit=20&page=1"
  "/listings?search=telephne&limit=20&page=1"
  "/listings?search=voiture&limit=20&page=1"
  "/listings?search=appartement&city=Douala&sellerType=pro&limit=20&page=1"
  "/listings?search=%22maison%20coloc%22%20-balcon&limit=20&page=1"
)

step "Search performance - collect ${SAMPLES} samples"
durations_ms=()
for ((i=0; i<SAMPLES; i++)); do
  path="${REQUEST_PATHS[$((i % ${#REQUEST_PATHS[@]}))]}"
  started_ns="$(date +%s%N)"
  api_call "GET" "${path}"
  ended_ns="$(date +%s%N)"
  assert_status_in "200"
  assert_jq '.data | type == "array"'
  assert_jq '(.total // 0) >= 0'

  elapsed_ms="$(( (ended_ns - started_ns) / 1000000 ))"
  durations_ms+=("${elapsed_ms}")
done

sorted_durations="$(printf "%s\n" "${durations_ms[@]}" | sort -n)"
sample_count="${#durations_ms[@]}"
p95_position="$(( (sample_count * 95 + 99) / 100 ))"
p95_ms="$(sed -n "${p95_position}p" <<<"${sorted_durations}")"
avg_ms="$(printf "%s\n" "${durations_ms[@]}" | awk '{sum+=$1} END {if (NR==0) print 0; else printf "%.0f", sum/NR}')"
max_ms="$(tail -n 1 <<<"${sorted_durations}")"

echo "search_perf_samples=${sample_count}"
echo "search_perf_p95_ms=${p95_ms}"
echo "search_perf_avg_ms=${avg_ms}"
echo "search_perf_max_ms=${max_ms}"
echo "search_perf_budget_ms=${P95_BUDGET_MS}"

if [[ "${p95_ms}" -gt "${P95_BUDGET_MS}" ]]; then
  echo "Search p95 exceeded budget: ${p95_ms}ms > ${P95_BUDGET_MS}ms" >&2
  exit 1
fi

echo
echo "Search performance flow OK"
