#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
DB_CONTAINER="${DB_CONTAINER:-sandaga-project-db-1}"
DB_NAME="${DB_NAME:-sandaga}"
DB_USER="${DB_USER:-postgres}"
TEST_PASSWORD="${TEST_PASSWORD:-Test12345!}"
FLOW_TS="${FLOW_TS:-$(date +%s)}"
LISTING_CATEGORY_ID="${LISTING_CATEGORY_ID:-c498bd03-32a7-4381-95f2-cdd2ce03373d}"

API_LAST_STATUS=""
API_LAST_BODY=""

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_basics() {
  require_cmd curl
  require_cmd jq
  require_cmd docker
}

step() {
  echo
  echo "== $* =="
}

api_health_check() {
  curl -fsS "${API_BASE_URL}/health" >/dev/null
}

api_call() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"
  local tmp status
  tmp="$(mktemp)"

  local -a args
  args=(-sS -o "$tmp" -w "%{http_code}" -X "$method" "${API_BASE_URL}${path}" -H "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer ${token}")
  fi

  if [[ -n "$body" ]]; then
    status="$(curl "${args[@]}" -d "$body")"
  else
    status="$(curl "${args[@]}")"
  fi

  API_LAST_STATUS="$status"
  API_LAST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

assert_status_in() {
  local allowed="$1"
  if ! grep -Eq "(^| )${API_LAST_STATUS}( |$)" <<<"$allowed"; then
    echo "Unexpected HTTP status: ${API_LAST_STATUS}. Allowed: ${allowed}" >&2
    echo "$API_LAST_BODY" >&2
    exit 1
  fi
}

assert_jq() {
  local expr="$1"
  if ! jq -e "$expr" >/dev/null 2>&1 <<<"$API_LAST_BODY"; then
    echo "JSON assertion failed: $expr" >&2
    echo "$API_LAST_BODY" | jq . >&2 || echo "$API_LAST_BODY" >&2
    exit 1
  fi
}

jq_get() {
  local expr="$1"
  jq -r "$expr" <<<"$API_LAST_BODY"
}

db_sql() {
  local sql="$1"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "$sql"
}

db_one() {
  local sql="$1"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$sql"
}

new_email() {
  local prefix="$1"
  echo "${prefix}.${FLOW_TS}.$RANDOM@example.com"
}

register_user() {
  local email="$1"
  local first_name="$2"
  local last_name="$3"
  local is_pro="${4:-false}"
  api_call "POST" "/auth/register" "" "{\"email\":\"${email}\",\"password\":\"${TEST_PASSWORD}\",\"firstName\":\"${first_name}\",\"lastName\":\"${last_name}\",\"isPro\":${is_pro}}"
  assert_status_in "200 201"
}

login_user() {
  local email="$1"
  local password="${2:-$TEST_PASSWORD}"
  api_call "POST" "/auth/login" "" "{\"email\":\"${email}\",\"password\":\"${password}\"}"
}
