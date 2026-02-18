#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Dashboard - create seller, buyer, pro"
SELLER_EMAIL="$(new_email dash.seller)"
BUYER_EMAIL="$(new_email dash.buyer)"
PRO_EMAIL="$(new_email dash.pro)"

register_user "$SELLER_EMAIL" "Dash" "Seller" "false"
SELLER_TOKEN="$(jq_get '.accessToken')"

register_user "$BUYER_EMAIL" "Dash" "Buyer" "false"
BUYER_TOKEN="$(jq_get '.accessToken')"

register_user "$PRO_EMAIL" "Dash" "Pro" "true"
PRO_TOKEN="$(jq_get '.accessToken')"

step "Dashboard - create listing and conversation"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Dashboard Listing ${FLOW_TS}\",\"description\":\"Annonce pour dashboard flow\",\"price\":{\"amount\":11000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001601\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

api_call "POST" "/messages/conversations" "$BUYER_TOKEN" "{\"listingId\":\"${LISTING_ID}\",\"content\":\"Salut, dispo ?\"}"
assert_status_in "200 201"

step "Dashboard - overview endpoints"
api_call "GET" "/dashboard/overview" "$SELLER_TOKEN"
assert_status_in "200"
assert_jq '.stats | length >= 4'
assert_jq 'has("notificationSummary") and has("onboardingChecklist")'

api_call "GET" "/dashboard/overview" "$BUYER_TOKEN"
assert_status_in "200"
assert_jq '.stats | length >= 4'

step "Dashboard - pro payment options"
api_call "GET" "/payments/options" "$PRO_TOKEN"
assert_status_in "200"
assert_jq 'type == "array"'

echo
echo "Dashboard flow OK"
echo "seller=${SELLER_EMAIL}"
echo "buyer=${BUYER_EMAIL}"
