#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

SUFFIX="${FLOW_TS}${RANDOM}"
QA_CITY_SLUG="qa-telephone-${SUFFIX}"
QA_CITY_NAME="Téléphone"
QA_CITY_NORMALIZED="telephone"
QA_NEIGHBORHOOD_SLUG="qa-coloc-${SUFFIX}"
QA_NEIGHBORHOOD_NAME="Coloc QA ${SUFFIX}"
QA_NEIGHBORHOOD_NORMALIZED="coloc qa ${SUFFIX}"

cleanup() {
  db_sql "DELETE FROM geo_neighborhoods WHERE slug='${QA_NEIGHBORHOOD_SLUG}';" >/dev/null 2>&1 || true
  db_sql "DELETE FROM geo_cities WHERE slug='${QA_CITY_SLUG}';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

step "Geo search - prepare deterministic fixtures"
DOUALA_ID="$(db_one "SELECT id FROM geo_cities WHERE normalized_name='douala' AND is_active=true ORDER BY is_popular DESC, name ASC LIMIT 1;")"
if [[ -z "${DOUALA_ID}" ]]; then
  echo "Douala city not found in geo_cities" >&2
  exit 1
fi

QA_CITY_ID="$(db_one "INSERT INTO geo_cities (name, slug, normalized_name, region, country_code, lat, lng, place_type, is_active, is_popular) VALUES ('${QA_CITY_NAME}', '${QA_CITY_SLUG}', '${QA_CITY_NORMALIZED}', 'Test', 'CM', 4.10, 9.70, 'city', true, false) RETURNING id;" | tr -d '\r' | head -n 1)"
[[ -n "${QA_CITY_ID}" ]] || { echo "Failed to insert QA city" >&2; exit 1; }

QA_NEIGHBORHOOD_ID="$(db_one "INSERT INTO geo_neighborhoods (name, slug, normalized_name, city_id, lat, lng, is_active) VALUES ('${QA_NEIGHBORHOOD_NAME}', '${QA_NEIGHBORHOOD_SLUG}', '${QA_NEIGHBORHOOD_NORMALIZED}', '${DOUALA_ID}', 4.055, 9.745, true) RETURNING id;" | tr -d '\r' | head -n 1)"
[[ -n "${QA_NEIGHBORHOOD_ID}" ]] || { echo "Failed to insert QA neighborhood" >&2; exit 1; }

step "Geo search - autocomplete neighborhood with city context"
api_call "GET" "/geo/autocomplete?q=coloc&limit=20"
assert_status_in "200"
assert_jq ". | map(select(.kind == \"neighborhood\" and .neighborhoodId == \"${QA_NEIGHBORHOOD_ID}\")) | length >= 1"
assert_jq ". | map(select(.kind == \"neighborhood\" and .neighborhoodId == \"${QA_NEIGHBORHOOD_ID}\" and (.label | test(\", Douala$\")))) | length >= 1"

step "Geo search - typo/accent tolerant city matching"
api_call "GET" "/geo/cities?q=telephne&limit=20"
assert_status_in "200"
assert_jq ". | map(select(.slug == \"${QA_CITY_SLUG}\")) | length >= 1"

api_call "GET" "/geo/autocomplete?q=telephne&limit=20"
assert_status_in "200"
assert_jq ". | map(select(.kind == \"city\" and .cityId == \"${QA_CITY_ID}\")) | length >= 1"

echo
echo "Geo search flow OK"
echo "qaCitySlug=${QA_CITY_SLUG}"
echo "qaNeighborhoodSlug=${QA_NEIGHBORHOOD_SLUG}"
