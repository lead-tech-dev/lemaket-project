#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Users - create test accounts"
USER_EMAIL="$(new_email user)"
SELLER_EMAIL="$(new_email seller)"
register_user "$USER_EMAIL" "User" "Flow" "false"
USER_ID="$(jq_get '.user.id')"
USER_TOKEN="$(jq_get '.accessToken')"

register_user "$SELLER_EMAIL" "Seller" "Flow" "true"
SELLER_ID="$(jq_get '.user.id')"

step "Users - update profile"
api_call "PATCH" "/users/me" "$USER_TOKEN" '{"firstName":"Updated","lastName":"User","location":"Douala"}'
assert_status_in "200"
assert_jq '.firstName == "Updated"'

step "Users - update settings"
api_call "PATCH" "/users/me/settings" "$USER_TOKEN" '{"maskPreciseLocation":true,"preferredContactChannels":["email","in_app"]}'
assert_status_in "200"

step "Users - addresses CRUD"
api_call "POST" "/users/me/addresses" "$USER_TOKEN" '{"label":"Maison","recipientName":"Updated User","line1":"Rue 1","city":"Douala","postalCode":"00237","country":"CM","isDefaultShipping":true}'
assert_status_in "200 201"
ADDRESS_ID="$(jq_get '.id')"
[[ -n "$ADDRESS_ID" && "$ADDRESS_ID" != "null" ]] || { echo "Address not created" >&2; exit 1; }

api_call "GET" "/users/me/addresses" "$USER_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${ADDRESS_ID}\")) | length == 1"

api_call "PATCH" "/users/me/addresses/${ADDRESS_ID}" "$USER_TOKEN" '{"label":"Bureau","recipientName":"Updated User","line1":"Rue 2","city":"Douala","postalCode":"00237","country":"CM"}'
assert_status_in "200"
assert_jq '.label == "Bureau"'

api_call "DELETE" "/users/me/addresses/${ADDRESS_ID}" "$USER_TOKEN"
assert_status_in "200"
assert_jq '.success == true'

step "Users - follow/unfollow"
api_call "POST" "/users/${SELLER_ID}/follow" "$USER_TOKEN" '{}'
assert_status_in "200 201"
assert_jq '.following == true'

api_call "GET" "/users/me/follows" "$USER_TOKEN"
assert_status_in "200"
assert_jq ".sellerIds | index(\"${SELLER_ID}\") != null"

api_call "DELETE" "/users/${SELLER_ID}/follow" "$USER_TOKEN"
assert_status_in "200"
assert_jq '.following == false'

step "Users - public profile"
api_call "GET" "/users/public/${USER_ID}"
assert_status_in "200"
assert_jq ".id == \"${USER_ID}\""

api_call "GET" "/users/couriers"
assert_status_in "200"
assert_jq 'type == "array"'

echo
echo "Users flow OK"
echo "user=${USER_EMAIL}"
echo "seller=${SELLER_EMAIL}"
