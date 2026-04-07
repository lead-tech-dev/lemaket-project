#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

SEARCH_TERM="coloc${FLOW_TS}${RANDOM}"

step "Search - create seller and admin"
SELLER_EMAIL="$(new_email search.seller)"
register_user "$SELLER_EMAIL" "Search" "Seller" "false"
SELLER_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET \"isPro\" = true WHERE id='${SELLER_ID}';" >/dev/null
SELLER_TOKEN="$(jq_get '.accessToken')"

ADMIN_EMAIL="$(new_email search.admin)"
register_user "$ADMIN_EMAIL" "Search" "Admin" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null
login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Search - create listings (title match, description match, non-match)"
api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Appartement ${SEARCH_TERM}\",\"description\":\"Annonce appartement test\",\"price\":{\"amount\":185000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001431\"}}"
assert_status_in "200 201"
MATCH_TITLE_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Appartement meublé\",\"description\":\"Super offre ${SEARCH_TERM} au centre-ville\",\"price\":{\"amount\":210000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bonapriso\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0611,\"lng\":9.7579},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001432\"}}"
assert_status_in "200 201"
MATCH_DESCRIPTION_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Annonce sans correspondance\",\"description\":\"Texte neutre\",\"price\":{\"amount\":99000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa Nord\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0711,\"lng\":9.7479},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001433\"}}"
assert_status_in "200 201"
NON_MATCH_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"SUV occasion\",\"description\":\"Automobile familiale en bon état\",\"price\":{\"amount\":2850000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bonanjo\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0420,\"lng\":9.7040},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001434\"}}"
assert_status_in "200 201"
SYNONYM_MATCH_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Téléphone Android\",\"description\":\"Smartphone neuf sous garantie\",\"price\":{\"amount\":125000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bali\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0480,\"lng\":9.6990},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001435\"}}"
assert_status_in "200 201"
ACCENT_MATCH_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Maison coloc avec balcon\",\"description\":\"Maison meublée pour colocation\",\"price\":{\"amount\":115000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bonamoussadi\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0800,\"lng\":9.7400},\"contact\":{\"email\":\"${SELLER_EMAIL}\",\"phone\":\"+237670001436\"}}"
assert_status_in "200 201"
NEGATIVE_MATCH_ID="$(jq_get '.id')"

step "Search - publish listings"
api_call "PATCH" "/listings/${MATCH_TITLE_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"
api_call "PATCH" "/listings/${MATCH_DESCRIPTION_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"
api_call "PATCH" "/listings/${NON_MATCH_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"
api_call "PATCH" "/listings/${SYNONYM_MATCH_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"
api_call "PATCH" "/listings/${ACCENT_MATCH_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"
api_call "PATCH" "/listings/${NEGATIVE_MATCH_ID}/status" "$ADMIN_TOKEN" '{"status":"published"}'
assert_status_in "200"

step "Search - query by search term and validate matches"
api_call "GET" "/listings?search=${SEARCH_TERM}&limit=100"
assert_status_in "200"
assert_jq '.data | type == "array"'
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${NON_MATCH_ID}\")) | length == 0"
assert_jq ".data | all(((.title // \"\") + \" \" + (.description // \"\")) | ascii_downcase | contains(\"${SEARCH_TERM}\" | ascii_downcase))"

step "Search - query synonym (voiture -> automobile)"
api_call "GET" "/listings?search=voiture&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${SYNONYM_MATCH_ID}\")) | length == 1"

step "Search - query accent/typo tolerance (telephone / telephne)"
api_call "GET" "/listings?search=telephone&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${ACCENT_MATCH_ID}\")) | length == 1"

api_call "GET" "/listings?search=telephne&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${ACCENT_MATCH_ID}\")) | length == 1"

step "Search - runtime synonym admin mapping (telephone <-> gsm)"
api_call "POST" "/search/synonyms" "$ADMIN_TOKEN" '{"term":"telephone","synonym":"gsm","isActive":true}'
assert_status_in "200 201"
DYNAMIC_SYNONYM_ID="$(jq_get '.id')"

api_call "GET" "/listings?search=gsm&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${ACCENT_MATCH_ID}\")) | length == 1"

api_call "DELETE" "/search/synonyms/${DYNAMIC_SYNONYM_ID}" "$ADMIN_TOKEN"
assert_status_in "200"

step "Search - admin relevance settings endpoint"
api_call "GET" "/admin/search/relevance" "$ADMIN_TOKEN"
assert_status_in "200"
assert_jq '.enableBusinessBoost != null'
assert_jq '.popularCityBoost != null'

api_call "POST" "/admin/search/relevance" "$ADMIN_TOKEN" '{"enableBusinessBoost":true,"popularCityBoost":31,"proSellerBoost":12,"categoryWeightsText":"immobilier:30, vehicules:25"}'
assert_status_in "200 201"
assert_jq '.popularCityBoost == 31'
assert_jq '.proSellerBoost == 12'

step "Search - query advanced syntax (phrase + exclusion)"
api_call "GET" "/listings?search=%22maison%20coloc%22%20-balcon&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${NEGATIVE_MATCH_ID}\")) | length == 0"

api_call "GET" "/listings?search=coloc%20-maison&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${NEGATIVE_MATCH_ID}\")) | length == 0"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_ID}\")) | length == 1"

step "Search - query autosuggestions endpoint"
api_call "GET" "/search/suggestions?q=coloc&limit=10"
assert_status_in "200"
assert_jq ". | type == \"array\" and length > 0"
assert_jq ". | map(.query) | any(test(\"coloc\"))"
assert_jq "([.[].query | ascii_downcase | gsub(\"[^a-z0-9]\"; \"\")] | length) == ([.[].query | ascii_downcase | gsub(\"[^a-z0-9]\"; \"\")] | unique | length)"

step "Search - autosuggestions normalize accents and drop noisy terms"
api_call "GET" "/search/suggestions?q=t%C3%A9l%C3%A9phone&limit=10"
assert_status_in "200"
assert_jq ". | map(.query) | any(. == \"telephone\")"

api_call "GET" "/search/suggestions?q=telephne&limit=10"
assert_status_in "200"
assert_jq ". | map(.query) | any(. == \"telephone\")"

api_call "GET" "/search/suggestions?q=12&limit=10"
assert_status_in "200"
assert_jq ". | type == \"array\" and length == 0"

echo
echo "Search flow OK"
echo "seller=${SELLER_EMAIL}"
echo "searchTerm=${SEARCH_TERM}"
echo "matchTitle=${MATCH_TITLE_ID}"
echo "matchDescription=${MATCH_DESCRIPTION_ID}"
