#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Admin advanced - create admin"
ADMIN_EMAIL="$(new_email admin.advanced)"
register_user "$ADMIN_EMAIL" "Advanced" "Admin" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null

login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Admin advanced - create seller listing for promotion"
SELLER_EMAIL="$(new_email admin.advanced.seller)"
register_user "$SELLER_EMAIL" "Advanced" "Seller" "false"
SELLER_TOKEN="$(jq_get '.accessToken')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Promotion Listing ${FLOW_TS}\",\"description\":\"Annonce pour tester promotions admin\",\"price\":{\"amount\":18900,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001701\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

step "Admin advanced - promotions CRUD"
api_call "POST" "/admin/promotions" "$ADMIN_TOKEN" "{\"name\":\"Promo QA ${FLOW_TS}\",\"type\":\"boost\",\"status\":\"draft\",\"startDate\":\"2030-01-01T00:00:00.000Z\",\"endDate\":\"2030-12-31T00:00:00.000Z\",\"budget\":25000,\"description\":\"Campagne de test automatisee\",\"listingId\":\"${LISTING_ID}\"}"
assert_status_in "200 201"
PROMO_ID="$(jq_get '.id')"

api_call "GET" "/admin/promotions" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${PROMO_ID}\")) | length == 1"

api_call "GET" "/admin/promotions/${PROMO_ID}" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq ".id == \"${PROMO_ID}\""

api_call "PATCH" "/admin/promotions/${PROMO_ID}" "$ADMIN_TOKEN" '{"name":"Promo QA Updated","budget":30000}'
assert_status_in "200"
assert_jq '.name == "Promo QA Updated"'

api_call "PATCH" "/admin/promotions/${PROMO_ID}/status" "$ADMIN_TOKEN" '{"status":"scheduled"}'
assert_status_in "200"
assert_jq '.status == "scheduled"'

api_call "DELETE" "/admin/promotions/${PROMO_ID}" "$ADMIN_TOKEN"
assert_status_in "200 204"

step "Admin advanced - form steps/fields CRUD"
SUBCATEGORY_ID="$(curl -sS "${API_BASE_URL}/categories" | jq -r 'map(select(.parentId != null))[0].id')"
[[ -n "$SUBCATEGORY_ID" && "$SUBCATEGORY_ID" != "null" ]] || {
  echo "No subcategory found for form step tests" >&2
  exit 1
}

api_call "POST" "/admin/forms/steps/category/${SUBCATEGORY_ID}" "$ADMIN_TOKEN" "{\"name\":\"qa_step_${FLOW_TS}\",\"label\":\"Etape QA ${FLOW_TS}\",\"order\":99,\"flow\":\"sell\"}"
assert_status_in "200 201"
STEP_ID="$(jq_get '.id')"

api_call "GET" "/admin/forms/steps/category/${SUBCATEGORY_ID}" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${STEP_ID}\")) | length >= 1"

api_call "PATCH" "/admin/forms/steps/${STEP_ID}" "$ADMIN_TOKEN" '{"label":"Etape QA mise a jour","order":100}'
assert_status_in "200"
assert_jq '.label == "Etape QA mise a jour"'

api_call "POST" "/admin/forms/fields/step/${STEP_ID}" "$ADMIN_TOKEN" '{"name":"qa_field","label":"Champ QA","type":"input","unit":"km","rules":{"mandatory":true}}'
assert_status_in "200 201"
FIELD_ID="$(jq_get '.id')"

api_call "GET" "/admin/forms/fields/step/${STEP_ID}" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${FIELD_ID}\")) | length >= 1"

api_call "PATCH" "/admin/forms/fields/${FIELD_ID}" "$ADMIN_TOKEN" '{"label":"Champ QA MAJ","disabled":true}'
assert_status_in "200"
assert_jq '.label == "Champ QA MAJ" and .disabled == true'

api_call "DELETE" "/admin/forms/fields/${FIELD_ID}" "$ADMIN_TOKEN"
assert_status_in "200 204"

api_call "DELETE" "/admin/forms/steps/${STEP_ID}" "$ADMIN_TOKEN"
assert_status_in "200 204"

step "Admin advanced - notification logs and settings"
api_call "GET" "/admin/message-notification-logs" "$ADMIN_TOKEN"
assert_status_in "200"

api_call "POST" "/admin/settings/security.sessionDurationMinutes" "$ADMIN_TOKEN" '{"value":90}'
assert_status_in "200 201"

api_call "POST" "/admin/settings" "$ADMIN_TOKEN" '{"updates":[{"key":"notifications.dailyDigestEnabled","value":true},{"key":"legal.termsVersion","value":"v1.0.1-qa"}]}'
assert_status_in "200 201"

echo
echo "Admin advanced flow OK"
echo "admin=${ADMIN_EMAIL}"
