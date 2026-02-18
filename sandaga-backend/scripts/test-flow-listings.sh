#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Listings - create seller"
SELLER_EMAIL="$(new_email listing.seller)"
register_user "$SELLER_EMAIL" "Listing" "Seller" "false"
SELLER_TOKEN="$(jq_get '.accessToken')"

step "Listings - create listing"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Listing Flow ${FLOW_TS}\",\"description\":\"Description de test pour listing flow\",\"price\":{\"amount\":12000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001001\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"
[[ -n "$LISTING_ID" && "$LISTING_ID" != "null" ]] || { echo "Listing id missing" >&2; exit 1; }

step "Listings - my listings"
api_call "GET" "/listings/me" "$SELLER_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${LISTING_ID}\")) | length == 1"

step "Listings - detail + similar + views"
api_call "GET" "/listings/${LISTING_ID}"
assert_status_in "200"
assert_jq ".id == \"${LISTING_ID}\""

api_call "GET" "/listings/${LISTING_ID}/similar"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "POST" "/listings/${LISTING_ID}/views" "" '{}'
assert_status_in "200 201"

step "Listings - update and support endpoints"
api_call "PATCH" "/listings/${LISTING_ID}" "$SELLER_TOKEN" '{"title":"Listing Flow Updated","description":"Description de test pour listing flow mise a jour"}'
assert_status_in "200"
assert_jq '.title == "Listing Flow Updated"'

api_call "GET" "/listings/form-schema/${LISTING_CATEGORY_ID}"
assert_status_in "200"

api_call "GET" "/listings/featured"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/listings/latest"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/listings/price-suggestion?categoryId=${LISTING_CATEGORY_ID}"
assert_status_in "200"

step "Listings - delete listing"
api_call "DELETE" "/listings/${LISTING_ID}" "$SELLER_TOKEN"
assert_status_in "200"

echo
echo "Listings flow OK"
echo "seller=${SELLER_EMAIL}"
echo "listingId=${LISTING_ID}"
