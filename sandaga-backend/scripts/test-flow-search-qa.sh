#!/usr/bin/env bash

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_flow-lib.sh"

require_basics
api_health_check

step "Search QA - baseline flow"
bash "${SCRIPT_DIR}/test-flow-search.sh"

step "Search QA - filters and pagination robustness"
bash "${SCRIPT_DIR}/test-flow-search-filters.sh"

step "Search QA - create admin for secured monitoring endpoints"
MONITOR_ADMIN_EMAIL="$(new_email search.monitor.admin)"
register_user "$MONITOR_ADMIN_EMAIL" "Search" "MonitorAdmin" "false"
MONITOR_ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${MONITOR_ADMIN_ID}';" >/dev/null
login_user "$MONITOR_ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
MONITOR_ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Search QA - repeated queries stability"
search_queries=(
  "coloc"
  "voiture"
  "\"maison coloc\" -balcon"
  "telephne"
)

for query in "${search_queries[@]}"; do
  encoded_query="$(jq -rn --arg q "${query}" '$q|@uri')"
  for _ in {1..8}; do
    api_call "GET" "/listings?search=${encoded_query}&limit=20&page=1"
    assert_status_in "200"
    assert_jq '.data | type == "array"'
    assert_jq '(.total // 0) >= 0'
  done
done

step "Search QA - search latency budget (p95)"
bash "${SCRIPT_DIR}/test-flow-search-performance.sh"

step "Search QA - pagination consistency"
api_call "GET" "/listings?search=coloc&limit=2&page=1"
assert_status_in "200"
assert_jq '.data | type == "array"'
PAGE_ONE_IDS="$(jq -r '.data[]?.id' <<<"$API_LAST_BODY" | tr '\n' ' ')"
TOTAL_RESULTS="$(jq -r '.total // 0' <<<"$API_LAST_BODY")"

if [[ "${TOTAL_RESULTS}" -gt 2 ]]; then
  api_call "GET" "/listings?search=coloc&limit=2&page=2"
  assert_status_in "200"
  assert_jq '.data | type == "array"'
  PAGE_TWO_IDS="$(jq -r '.data[]?.id' <<<"$API_LAST_BODY" | tr '\n' ' ')"
  if [[ -n "${PAGE_ONE_IDS}" && -n "${PAGE_TWO_IDS}" && "${PAGE_ONE_IDS}" == "${PAGE_TWO_IDS}" ]]; then
    echo "Pagination inconsistency detected: page 1 and page 2 returned identical IDs." >&2
    exit 1
  fi
fi

step "Search QA - monitoring status endpoint"
api_call "GET" "/monitoring/search/status"
assert_status_in "401 403"

api_call "GET" "/monitoring/search/status" "$MONITOR_ADMIN_TOKEN"
assert_status_in "200 201"
assert_jq '.status | IN("ok","degraded","critical")'
assert_jq '.snapshot.windowSeconds >= 60'
assert_jq '.snapshot.listings.withSearch.total >= 1'
assert_jq '.snapshot.suggestions.total >= 1'

step "Search QA - monitoring alert dispatch endpoint"
api_call "POST" "/monitoring/search/alerts/dispatch?force=true" "" "{}"
assert_status_in "401 403"

api_call "POST" "/monitoring/search/alerts/dispatch?force=true" "$MONITOR_ADMIN_TOKEN" "{}"
assert_status_in "200 201"
assert_jq '.status | IN("ok","degraded","critical")'
assert_jq '.dispatched | type == "boolean"'
assert_jq '.message | type == "string"'

step "Search QA - metrics exposure"
METRICS_BODY="$(curl -fsS "${API_BASE_URL}/metrics")"
if ! grep -q 'sandaga_search_suggestions_cache_hits_total' <<<"${METRICS_BODY}"; then
  echo "Missing metric sandaga_search_suggestions_cache_hits_total" >&2
  exit 1
fi
if ! grep -q 'sandaga_search_suggestions_cache_misses_total' <<<"${METRICS_BODY}"; then
  echo "Missing metric sandaga_search_suggestions_cache_misses_total" >&2
  exit 1
fi
if ! grep -q 'sandaga_search_listings_queries_total' <<<"${METRICS_BODY}"; then
  echo "Missing metric sandaga_search_listings_queries_total" >&2
  exit 1
fi

echo
echo "Search QA flow OK"
