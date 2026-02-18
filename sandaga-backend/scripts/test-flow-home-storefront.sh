#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Home/Storefront - create pro seller"
PRO_EMAIL="$(new_email home.store)"
register_user "$PRO_EMAIL" "Home" "Storefront" "true"
PRO_TOKEN="$(jq_get '.accessToken')"
STORE_SLUG="qa-store-${FLOW_TS}-${RANDOM}"

api_call "PATCH" "/users/me" "$PRO_TOKEN" "{\"companyName\":\"QA Store ${FLOW_TS}\",\"businessDescription\":\"Storefront de test automatise\",\"businessWebsite\":\"https://example.com\",\"storefrontSlug\":\"${STORE_SLUG}\",\"storefrontTagline\":\"Vendeur de confiance\",\"location\":\"Douala\"}"
assert_status_in "200"
assert_jq ".storefrontSlug == \"${STORE_SLUG}\""

step "Home/Storefront - create listing and publish"
api_call "POST" "/listings" "$PRO_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Storefront Listing ${FLOW_TS}\",\"description\":\"Annonce storefront test\",\"price\":{\"amount\":20000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${PRO_EMAIL}\",\"phone\":\"+237670001401\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

ADMIN_EMAIL="$(new_email home.admin)"
register_user "$ADMIN_EMAIL" "Home" "Admin" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null
login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

api_call "PATCH" "/listings/${LISTING_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"

step "Home/Storefront - home endpoints"
api_call "GET" "/home"
assert_status_in "200"
assert_jq 'type == "object"'

api_call "GET" "/home/hero"
assert_status_in "200"
assert_jq 'type == "object"'

api_call "GET" "/home/categories"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/services"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/listings"
assert_status_in "200"
assert_jq 'type == "object"'

api_call "GET" "/home/listings/featured?limit=4"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/listings/latest?limit=4"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/seller-split"
assert_status_in "200"
assert_jq 'has("proListings") and has("individualListings")'

api_call "GET" "/home/testimonials"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/trending-searches"
assert_status_in "200"
assert_jq 'type == "array"'

api_call "GET" "/home/storefronts?limit=8"
assert_status_in "200"
assert_jq 'type == "array"'

step "Home/Storefront - storefront endpoints"
api_call "GET" "/storefronts/${STORE_SLUG}"
assert_status_in "200"
assert_jq ".slug == \"${STORE_SLUG}\" and .isPro == true"

api_call "GET" "/storefronts/${STORE_SLUG}/listings?limit=12&sort=recent"
assert_status_in "200"
assert_jq '.data | type == "array"'
assert_jq ".data | map(select(.id == \"${LISTING_ID}\")) | length >= 1"

echo
echo "Home/Storefront flow OK"
echo "pro=${PRO_EMAIL}"
echo "slug=${STORE_SLUG}"
