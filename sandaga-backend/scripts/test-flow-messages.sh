#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Messages - create seller and buyer"
SELLER_EMAIL="$(new_email msg.seller)"
BUYER_EMAIL="$(new_email msg.buyer)"

register_user "$SELLER_EMAIL" "Msg" "Seller" "false"
SELLER_TOKEN="$(jq_get '.accessToken')"

register_user "$BUYER_EMAIL" "Msg" "Buyer" "false"
BUYER_TOKEN="$(jq_get '.accessToken')"

step "Messages - create listing for conversation context"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Messages Flow ${FLOW_TS}\",\"description\":\"Description de test pour messages flow\",\"price\":{\"amount\":9000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001101\"}}"
assert_status_in "200 201"
LISTING_ID="$(jq_get '.id')"

step "Messages - buyer starts conversation"
api_call "POST" "/messages/conversations" "$BUYER_TOKEN" "{\"listingId\":\"${LISTING_ID}\",\"content\":\"Bonjour, est-ce disponible ?\"}"
assert_status_in "200 201"
CONVERSATION_ID="$(jq_get '.id')"
[[ -n "$CONVERSATION_ID" && "$CONVERSATION_ID" != "null" ]] || { echo "Conversation id missing" >&2; exit 1; }

step "Messages - send and fetch messages"
api_call "POST" "/messages/conversations/${CONVERSATION_ID}/messages" "$SELLER_TOKEN" '{"content":"Oui, c est disponible."}'
assert_status_in "200 201"

api_call "GET" "/messages/conversations/${CONVERSATION_ID}/messages" "$BUYER_TOKEN"
assert_status_in "200"
assert_jq '.data | length >= 2'

step "Messages - mark as read"
api_call "POST" "/messages/conversations/${CONVERSATION_ID}/read" "$BUYER_TOKEN" '{}'
assert_status_in "200 201"

step "Messages - quick replies CRUD"
api_call "POST" "/messages/quick-replies" "$SELLER_TOKEN" '{"label":"Disponibilite","content":"Le produit est disponible.","isGlobal":false}'
assert_status_in "200 201"
REPLY_ID="$(jq_get '.id')"

api_call "PATCH" "/messages/quick-replies/${REPLY_ID}" "$SELLER_TOKEN" '{"label":"Disponibilite MAJ","content":"Oui, toujours disponible."}'
assert_status_in "200"
assert_jq '.label == "Disponibilite MAJ"'

api_call "GET" "/messages/quick-replies" "$SELLER_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${REPLY_ID}\")) | length == 1"

api_call "DELETE" "/messages/quick-replies/${REPLY_ID}" "$SELLER_TOKEN"
assert_status_in "200 204"

step "Messages - notifications smoke"
api_call "GET" "/notifications" "$SELLER_TOKEN"
assert_status_in "200"
assert_jq 'has("items")'

NOTIF_ID="$(jq -r '.items[0].id // empty' <<<"$API_LAST_BODY")"
if [[ -n "$NOTIF_ID" ]]; then
  api_call "PATCH" "/notifications/${NOTIF_ID}/read" "$SELLER_TOKEN" '{}'
  assert_status_in "200"
  api_call "PATCH" "/notifications/read-all" "$SELLER_TOKEN" '{}'
  assert_status_in "200"
fi

echo
echo "Messages flow OK"
echo "seller=${SELLER_EMAIL}"
echo "buyer=${BUYER_EMAIL}"
echo "conversationId=${CONVERSATION_ID}"
