#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Engagement - create seller, buyer, admin"
SELLER_EMAIL="$(new_email eng.seller)"
BUYER_EMAIL="$(new_email eng.buyer)"
ADMIN_EMAIL="$(new_email eng.admin)"

register_user "$SELLER_EMAIL" "Eng" "Seller" "false"
SELLER_ID="$(jq_get '.user.id')"
SELLER_TOKEN="$(jq_get '.accessToken')"

register_user "$BUYER_EMAIL" "Eng" "Buyer" "false"
BUYER_TOKEN="$(jq_get '.accessToken')"

register_user "$ADMIN_EMAIL" "Eng" "Admin" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null
login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Engagement - create listing and publish"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Engagement Listing ${FLOW_TS}\",\"description\":\"Annonce pour tester favoris/avis/signalement\",\"price\":{\"amount\":14500,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001501\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

api_call "PATCH" "/listings/${LISTING_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"

step "Engagement - favorites"
api_call "POST" "/favorites/${LISTING_ID}" "$BUYER_TOKEN" '{}'
assert_status_in "200 201"
assert_jq ".listingId == \"${LISTING_ID}\""

api_call "GET" "/favorites" "$BUYER_TOKEN"
assert_status_in "200"
assert_jq "map(select(.listingId == \"${LISTING_ID}\")) | length == 1"

api_call "DELETE" "/favorites/${LISTING_ID}" "$BUYER_TOKEN"
assert_status_in "200 204"

step "Engagement - alerts CRUD"
api_call "POST" "/alerts" "$BUYER_TOKEN" '{"term":"toyota","location":"Douala","sellerType":"all","radius":12}'
assert_status_in "200 201"
ALERT_ID="$(jq_get '.id')"

api_call "GET" "/alerts" "$BUYER_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${ALERT_ID}\")) | length == 1"

api_call "PATCH" "/alerts/${ALERT_ID}" "$BUYER_TOKEN" '{"term":"toyota yaris","isActive":false}'
assert_status_in "200"
assert_jq '.term == "toyota yaris" and .isActive == false'

api_call "DELETE" "/alerts/${ALERT_ID}" "$BUYER_TOKEN"
assert_status_in "200"
assert_jq '.success == true'

step "Engagement - conversation + reviews"
api_call "POST" "/messages/conversations" "$BUYER_TOKEN" "{\"listingId\":\"${LISTING_ID}\",\"content\":\"Bonjour, je suis interesse.\"}"
assert_status_in "200 201"
CONVERSATION_ID="$(jq_get '.id')"

api_call "POST" "/messages/conversations/${CONVERSATION_ID}/messages" "$SELLER_TOKEN" '{"content":"Disponible, vous pouvez l acheter."}'
assert_status_in "200 201"

api_call "POST" "/reviews/users" "$BUYER_TOKEN" "{\"sellerId\":\"${SELLER_ID}\",\"rating\":5,\"comment\":\"Tres bon vendeur, reactif et serieux.\",\"location\":\"Douala\"}"
assert_status_in "200 201"
assert_jq '.rating == 5'

api_call "POST" "/reviews" "$BUYER_TOKEN" "{\"listingId\":\"${LISTING_ID}\",\"rating\":4,\"comment\":\"Transaction correcte et vendeur fiable.\",\"location\":\"Douala\"}"
assert_status_in "200 201"
assert_jq '.rating == 4'

api_call "GET" "/reviews/sellers/${SELLER_ID}?limit=10"
assert_status_in "200"
assert_jq '.summary.totalReviews >= 2'

step "Engagement - short links"
api_call "POST" "/links/shorten" "" "{\"targetUrl\":\"http://localhost:5173/listing/${LISTING_ID}\"}"
assert_status_in "200 201"
SHORT_SLUG="$(jq_get '.slug')"
[[ -n "$SHORT_SLUG" && "$SHORT_SLUG" != "null" ]] || { echo "Short slug missing" >&2; exit 1; }

REDIRECT_STATUS="$(curl -sS -o /tmp/short-link-redirect.txt -w "%{http_code}" -I "${API_BASE_URL}/s/${SHORT_SLUG}")"
if [[ "$REDIRECT_STATUS" != "301" && "$REDIRECT_STATUS" != "302" ]]; then
  echo "Short link redirect failed with status ${REDIRECT_STATUS}" >&2
  cat /tmp/short-link-redirect.txt >&2
  exit 1
fi

step "Engagement - reports create and moderation"
api_call "POST" "/reports" "" "{\"listingId\":\"${LISTING_ID}\",\"reason\":\"Contenu suspect\",\"details\":\"Texte de test pour signalement automatise\",\"contactEmail\":\"${BUYER_EMAIL}\"}"
assert_status_in "200 201"
REPORT_ID="$(jq_get '.id')"

api_call "GET" "/reports?limit=10" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${REPORT_ID}\")) | length == 1"

api_call "PATCH" "/reports/${REPORT_ID}" "$ADMIN_TOKEN" '{"status":"resolved","resolutionNotes":"Traite pendant test automatise"}'
assert_status_in "200"
assert_jq '.status == "resolved"'

echo
echo "Engagement flow OK"
echo "seller=${SELLER_EMAIL}"
echo "buyer=${BUYER_EMAIL}"
echo "listingId=${LISTING_ID}"
