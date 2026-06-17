#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

SEARCH_TERM="colocfilters${FLOW_TS}${RANDOM}"
CITY_PRIMARY="SearchVilleA${FLOW_TS}"
CITY_SECONDARY="SearchVilleB${FLOW_TS}"

step "Search filters - create users"
PRO_SELLER_EMAIL="$(new_email search.filters.pro)"
register_user "$PRO_SELLER_EMAIL" "Search" "ProSeller" "false"
PRO_SELLER_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET \"isPro\" = true WHERE id='${PRO_SELLER_ID}';" >/dev/null
PRO_SELLER_TOKEN="$(jq_get '.accessToken')"

INDIVIDUAL_SELLER_EMAIL="$(new_email search.filters.individual)"
register_user "$INDIVIDUAL_SELLER_EMAIL" "Search" "IndividualSeller" "false"
INDIVIDUAL_SELLER_TOKEN="$(jq_get '.accessToken')"

ADMIN_EMAIL="$(new_email search.filters.admin)"
register_user "$ADMIN_EMAIL" "Search" "FilterAdmin" "false"
ADMIN_ID="$(jq_get '.user.id')"
db_sql "UPDATE users SET role='admin' WHERE id='${ADMIN_ID}';" >/dev/null
login_user "$ADMIN_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
ADMIN_TOKEN="$(jq_get '.accessToken')"

step "Search filters - create listings dataset"
api_call "POST" "/listings" "$PRO_SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Appartement ${SEARCH_TERM}\",\"description\":\"Titre + offre premium\",\"price\":{\"amount\":15000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa\",\"city\":\"${CITY_PRIMARY}\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"${PRO_SELLER_EMAIL}\",\"phone\":\"+237670002101\"}}"
assert_status_in "200 201"
MATCH_TITLE_PRO_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$PRO_SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Appartement standing\",\"description\":\"Annonce spéciale ${SEARCH_TERM} en description\",\"price\":{\"amount\":30000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bonapriso\",\"city\":\"${CITY_PRIMARY}\",\"zipcode\":\"00237\",\"lat\":4.0611,\"lng\":9.7579},\"contact\":{\"email\":\"${PRO_SELLER_EMAIL}\",\"phone\":\"+237670002102\"}}"
assert_status_in "200 201"
MATCH_DESCRIPTION_PRO_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$INDIVIDUAL_SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"buy\",\"title\":\"Recherche ${SEARCH_TERM} à Yaoundé\",\"description\":\"Demande acheteur\",\"price\":{\"amount\":90000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Mvog-Ada\",\"city\":\"${CITY_SECONDARY}\",\"zipcode\":\"10000\",\"lat\":3.8570,\"lng\":11.5021},\"contact\":{\"email\":\"${INDIVIDUAL_SELLER_EMAIL}\",\"phone\":\"+237670002103\"}}"
assert_status_in "200 201"
MATCH_TITLE_INDIVIDUAL_ID="$(jq_get '.id')"

api_call "POST" "/listings" "$INDIVIDUAL_SELLER_TOKEN" "{\"categoryId\":\"${LISTING_CATEGORY_ID}\",\"adType\":\"sell\",\"title\":\"Annonce neutre\",\"description\":\"Aucun lien avec le terme ciblé\",\"price\":{\"amount\":12000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Bastos\",\"city\":\"${CITY_SECONDARY}\",\"zipcode\":\"10000\",\"lat\":3.8890,\"lng\":11.5140},\"contact\":{\"email\":\"${INDIVIDUAL_SELLER_EMAIL}\",\"phone\":\"+237670002104\"}}"
assert_status_in "200 201"
NON_MATCH_ID="$(jq_get '.id')"

step "Search filters - publish dataset"
for listing_id in "${MATCH_TITLE_PRO_ID}" "${MATCH_DESCRIPTION_PRO_ID}" "${MATCH_TITLE_INDIVIDUAL_ID}" "${NON_MATCH_ID}"; do
  api_call "PATCH" "/listings/${listing_id}/status" "$ADMIN_TOKEN" '{"status":"published"}'
  assert_status_in "200"
done

step "Search filters - baseline full-text"
api_call "GET" "/listings?search=${SEARCH_TERM}&limit=100"
assert_status_in "200"
assert_jq ".meta.appliedFilters.search == \"${SEARCH_TERM}\""
assert_jq '.meta.appliedFilters.sort == "recent"'
assert_jq '.meta.appliedFilters.page == 1'
assert_jq '.meta.appliedFilters.limit == 100'
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_INDIVIDUAL_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${NON_MATCH_ID}\")) | length == 0"

step "Search filters - applied filters warnings when input is normalized"
ENCODED_SEARCH_WITH_SPACES="$(jq -rn --arg v "  ${SEARCH_TERM}   " '$v|@uri')"
ENCODED_CITY_WITH_SPACES="$(jq -rn --arg v "  ${CITY_PRIMARY}   " '$v|@uri')"
api_call "GET" "/listings?search=${ENCODED_SEARCH_WITH_SPACES}&city=${ENCODED_CITY_WITH_SPACES}&limit=5"
assert_status_in "200"
assert_jq ".meta.appliedFilters.search == \"${SEARCH_TERM}\""
assert_jq ".meta.appliedFilters.city == \"${CITY_PRIMARY}\""
assert_jq '.meta.warnings | type == "array" and length >= 1'

step "Search filters - titleOnly only matches title"
api_call "GET" "/listings?search=${SEARCH_TERM}&titleOnly=true&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_INDIVIDUAL_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_PRO_ID}\")) | length == 0"

step "Search filters - sellerType + adType + city"
api_call "GET" "/listings?search=${SEARCH_TERM}&sellerType=pro&adType=SELL&city=${CITY_PRIMARY}&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_INDIVIDUAL_ID}\")) | length == 0"

step "Search filters - price range"
api_call "GET" "/listings?search=${SEARCH_TERM}&minPrice=10000&maxPrice=40000&limit=100"
assert_status_in "200"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_INDIVIDUAL_ID}\")) | length == 0"

step "Search filters - deterministic price sort"
api_call "GET" "/listings?city=${CITY_PRIMARY}&sellerType=pro&sort=priceAsc&limit=100"
assert_status_in "200"
assert_jq '.data | length >= 2'
assert_jq ".data | map(select(.id == \"${MATCH_TITLE_PRO_ID}\")) | length == 1"
assert_jq ".data | map(select(.id == \"${MATCH_DESCRIPTION_PRO_ID}\")) | length == 1"
assert_jq '((.data[0].price | tonumber) <= (.data[1].price | tonumber))'

step "Search filters - pagination stability and non-overlap"
api_call "GET" "/listings?search=${SEARCH_TERM}&limit=2&page=1&sort=recent"
assert_status_in "200"
PAGE_ONE_IDS="$(jq -r '.data[]?.id' <<<"$API_LAST_BODY")"
api_call "GET" "/listings?search=${SEARCH_TERM}&limit=2&page=2&sort=recent"
assert_status_in "200"
PAGE_TWO_IDS="$(jq -r '.data[]?.id' <<<"$API_LAST_BODY")"

if [[ -n "${PAGE_ONE_IDS}" && -n "${PAGE_TWO_IDS}" ]]; then
  OVERLAP_COUNT="$(comm -12 <(printf "%s\n" "${PAGE_ONE_IDS}" | sort) <(printf "%s\n" "${PAGE_TWO_IDS}" | sort) | wc -l | tr -d ' ')"
  if [[ "${OVERLAP_COUNT}" != "0" ]]; then
    echo "Pagination overlap detected between page 1 and page 2 (${OVERLAP_COUNT} duplicated ids)." >&2
    exit 1
  fi
fi

api_call "GET" "/listings?search=${SEARCH_TERM}&limit=2&page=1&sort=recent"
assert_status_in "200"
PAGE_ONE_IDS_SECOND_CALL="$(jq -r '.data[]?.id' <<<"$API_LAST_BODY")"
if [[ "${PAGE_ONE_IDS}" != "${PAGE_ONE_IDS_SECOND_CALL}" ]]; then
  echo "Pagination instability detected: repeated page 1 did not return the same ordering." >&2
  exit 1
fi

echo
echo "Search filters flow OK"
echo "searchTerm=${SEARCH_TERM}"
echo "matchTitlePro=${MATCH_TITLE_PRO_ID}"
echo "matchDescriptionPro=${MATCH_DESCRIPTION_PRO_ID}"
echo "matchTitleIndividual=${MATCH_TITLE_INDIVIDUAL_ID}"
