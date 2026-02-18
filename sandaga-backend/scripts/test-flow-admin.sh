#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Admin - create admin account and promote role"
ADMIN_EMAIL="$(new_email admin)"
register_user "$ADMIN_EMAIL" "Admin" "Flow" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null

login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Admin - core endpoints"
api_call "GET" "/admin/metrics" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/activities" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/logs" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/settings" "$ADMIN_TOKEN"
assert_status_in "200"

step "Admin - verifications/wallet/transactions"
api_call "GET" "/admin/company-verifications" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/courier-verifications" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/platform-wallet" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/platform-wallet/transactions?limit=5" "$ADMIN_TOKEN"
assert_status_in "200"
api_call "GET" "/admin/zikopay/transactions?limit=5" "$ADMIN_TOKEN"
assert_status_in "200"

step "Admin - csv exports"
STATUS_PLATFORM_EXPORT="$(curl -sS -o /tmp/platform-wallet-transactions.csv -w "%{http_code}" -H "Authorization: Bearer ${ADMIN_TOKEN}" "${API_BASE_URL}/admin/platform-wallet/transactions/export")"
[[ "$STATUS_PLATFORM_EXPORT" == "200" ]] || { echo "Platform wallet export failed"; cat /tmp/platform-wallet-transactions.csv; exit 1; }
STATUS_ZIKO_EXPORT="$(curl -sS -o /tmp/zikopay-transactions.csv -w "%{http_code}" -H "Authorization: Bearer ${ADMIN_TOKEN}" "${API_BASE_URL}/admin/zikopay/transactions/export")"
[[ "$STATUS_ZIKO_EXPORT" == "200" ]] || { echo "Zikopay export failed"; cat /tmp/zikopay-transactions.csv; exit 1; }

step "Admin - moderation listing status"
SELLER_EMAIL="$(new_email admin.seller)"
register_user "$SELLER_EMAIL" "Seller" "Moderation" "false"
SELLER_TOKEN="$(jq_get '.accessToken')"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Moderation ${FLOW_TS}\",\"description\":\"Listing de test moderation admin\",\"price\":{\"amount\":15000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001201\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

api_call "PATCH" "/admin/moderation/listings/status" "$ADMIN_TOKEN" "{\"listingIds\":[\"${LISTING_ID}\"],\"status\":\"published\",\"note\":\"qa smoke\"}"
assert_status_in "200"

step "Admin - categories CRUD"
CATEGORY_SLUG="qa-cat-${FLOW_TS}"
api_call "POST" "/categories" "$ADMIN_TOKEN" "{\"name\":\"QA Cat ${FLOW_TS}\",\"slug\":\"${CATEGORY_SLUG}\",\"description\":\"Cat test\",\"isActive\":true}"
assert_status_in "200 201"
CATEGORY_ID="$(jq_get '.id')"

api_call "PATCH" "/categories/${CATEGORY_ID}" "$ADMIN_TOKEN" '{"description":"Cat test updated","isActive":false}'
assert_status_in "200"
assert_jq '.isActive == false'

api_call "DELETE" "/categories/${CATEGORY_ID}" "$ADMIN_TOKEN"
assert_status_in "200 204"

step "Admin - audit/export jobs"
api_call "GET" "/admin/audit/users?limit=10" "$ADMIN_TOKEN"
assert_status_in "200"

api_call "POST" "/admin/export/users" "$ADMIN_TOKEN" '{"format":"csv"}'
assert_status_in "200 201"
JOB_ID="$(jq_get '.id')"
api_call "GET" "/admin/export/jobs/${JOB_ID}" "$ADMIN_TOKEN"
assert_status_in "200"

echo
echo "Admin flow OK"
echo "admin=${ADMIN_EMAIL}"
echo "listingModerated=${LISTING_ID}"
