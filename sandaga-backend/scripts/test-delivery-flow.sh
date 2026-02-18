#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
DB_CONTAINER="${DB_CONTAINER:-sandaga-project-db-1}"
DB_NAME="${DB_NAME:-sandaga}"
DB_USER="${DB_USER:-postgres}"
TEST_PASSWORD="${TEST_PASSWORD:-Test12345!}"
LISTING_CATEGORY_ID="${LISTING_CATEGORY_ID:-c498bd03-32a7-4381-95f2-cdd2ce03373d}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd docker

if ! curl -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
  echo "API not reachable at $API_BASE_URL. Start backend first." >&2
  exit 1
fi

post_json() {
  local url="$1"
  local body="$2"
  shift 2
  curl -fsS -X POST "$url" -H "Content-Type: application/json" "$@" -d "$body"
}

patch_json() {
  local url="$1"
  local body="$2"
  shift 2
  curl -fsS -X PATCH "$url" -H "Content-Type: application/json" "$@" -d "$body"
}

sql_one() {
  local sql="$1"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$sql"
}

echo "== Delivery Flow Test (escrow wallet) =="
TS="$(date +%s)"
SELLER_EMAIL="seller.${TS}@example.com"
BUYER_EMAIL="buyer.${TS}@example.com"
COURIER_EMAIL="courier.${TS}@example.com"

echo "1) Register users"
SELLER_RES="$(post_json "$API_BASE_URL/auth/register" "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Seller\",\"lastName\":\"Flow\",\"phoneNumber\":\"+237670000201\"}")"
BUYER_RES="$(post_json "$API_BASE_URL/auth/register" "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Buyer\",\"lastName\":\"Flow\",\"phoneNumber\":\"+237670000202\"}")"
COURIER_RES="$(post_json "$API_BASE_URL/auth/register" "{\"email\":\"$COURIER_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"Courier\",\"lastName\":\"Flow\",\"phoneNumber\":\"+237670000203\"}")"

SELLER_TOKEN="$(echo "$SELLER_RES" | jq -r '.accessToken')"
BUYER_TOKEN="$(echo "$BUYER_RES" | jq -r '.accessToken')"
COURIER_TOKEN="$(echo "$COURIER_RES" | jq -r '.accessToken')"
SELLER_ID="$(echo "$SELLER_RES" | jq -r '.user.id')"
BUYER_ID="$(echo "$BUYER_RES" | jq -r '.user.id')"
COURIER_ID="$(echo "$COURIER_RES" | jq -r '.user.id')"

if [[ "$SELLER_TOKEN" == "null" || "$BUYER_TOKEN" == "null" || "$COURIER_TOKEN" == "null" ]]; then
  echo "Registration/login failed." >&2
  echo "$SELLER_RES" | jq .
  echo "$BUYER_RES" | jq .
  echo "$COURIER_RES" | jq .
  exit 1
fi

echo "2) Enable courier + seed buyer wallet"
patch_json "$API_BASE_URL/users/me" "{\"location\":\"Douala, Cameroun\"}" \
  -H "Authorization: Bearer $COURIER_TOKEN" >/dev/null
patch_json "$API_BASE_URL/users/me/settings" \
  "{\"isCourier\":true,\"courierLocation\":{\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"courierRadiusKm\":30}" \
  -H "Authorization: Bearer $COURIER_TOKEN" >/dev/null

sql_one "UPDATE users SET \"courierVerificationStatus\"='approved', \"courierVerificationReviewedAt\"=NOW() WHERE id='$COURIER_ID';" >/dev/null
sql_one "UPDATE users SET wallet_balance='200000.00', wallet_currency='XAF' WHERE id='$BUYER_ID';" >/dev/null

echo "3) Create listing"
LISTING_RES="$(post_json "$API_BASE_URL/listings" \
  "{\"categoryId\":\"$LISTING_CATEGORY_ID\",\"adType\":\"sell\",\"title\":\"Flow test $TS\",\"description\":\"Annonce de test pour flow escrow livraison\",\"price\":{\"amount\":10000,\"currency\":\"XAF\"},\"location\":{\"address\":\"Akwa Douala\",\"city\":\"Douala\",\"zipcode\":\"00237\",\"lat\":4.0511,\"lng\":9.7679},\"contact\":{\"email\":\"$SELLER_EMAIL\",\"phone\":\"+237670000201\"},\"attributes\":{\"handover_modes\":[\"delivery\",\"pickup\"]}}" \
  -H "Authorization: Bearer $SELLER_TOKEN")"
LISTING_ID="$(echo "$LISTING_RES" | jq -r '.id')"
if [[ "$LISTING_ID" == "null" ]]; then
  echo "Listing creation failed." >&2
  echo "$LISTING_RES" | jq .
  exit 1
fi

echo "4) Buyer init escrow"
INIT_RES="$(post_json "$API_BASE_URL/deliveries/escrow/init" \
  "{\"listingId\":\"$LISTING_ID\",\"handoverMode\":\"delivery\",\"dropoffAddress\":\"Bonaberi Douala\",\"dropoffNotes\":\"Test flow\",\"price\":1500,\"currency\":\"XAF\",\"paymentMethod\":\"wallet\",\"preferredCourierId\":\"$COURIER_ID\"}" \
  -H "Authorization: Bearer $BUYER_TOKEN")"
ORDER_ID="$(echo "$INIT_RES" | jq -r '.orderId')"
PAYMENT_ID="$(echo "$INIT_RES" | jq -r '.paymentId')"
if [[ "$ORDER_ID" == "null" ]]; then
  echo "Escrow init failed." >&2
  echo "$INIT_RES" | jq .
  exit 1
fi

DELIVERY_ID="$(curl -fsS "$API_BASE_URL/deliveries/mine" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  | jq -r "map(select(.listingId==\"$LISTING_ID\")) | sort_by(.created_at) | last | .id")"

if [[ -z "${DELIVERY_ID:-}" || "$DELIVERY_ID" == "null" ]]; then
  echo "Could not resolve delivery ID." >&2
  exit 1
fi

echo "5) Courier accept"
post_json "$API_BASE_URL/deliveries/$DELIVERY_ID/accept" "{}" \
  -H "Authorization: Bearer $COURIER_TOKEN" >/dev/null

echo "6) Pickup confirm by code"
PICKUP_CODE="$(curl -fsS "$API_BASE_URL/deliveries/$DELIVERY_ID/pickup/code" \
  -H "Authorization: Bearer $SELLER_TOKEN" | jq -r '.code')"
post_json "$API_BASE_URL/deliveries/$DELIVERY_ID/pickup/confirm" "{\"code\":\"$PICKUP_CODE\"}" \
  -H "Authorization: Bearer $COURIER_TOKEN" >/dev/null

echo "7) Delivery confirm by code"
DELIVERY_CODE="$(sql_one "SELECT delivery_code FROM deliveries WHERE id='$DELIVERY_ID' LIMIT 1;")"
post_json "$API_BASE_URL/deliveries/$DELIVERY_ID/delivery/confirm" "{\"code\":\"$DELIVERY_CODE\"}" \
  -H "Authorization: Bearer $COURIER_TOKEN" >/dev/null

echo "8) Buyer release escrow"
post_json "$API_BASE_URL/deliveries/$DELIVERY_ID/escrow/release" "{}" \
  -H "Authorization: Bearer $BUYER_TOKEN" >/dev/null

DELIVERY_SUMMARY="$(curl -fsS "$API_BASE_URL/deliveries/mine" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  | jq "map(select(.id==\"$DELIVERY_ID\")) | .[0] | {id,status,escrowStatus,courierId}")"
ORDER_SUMMARY="$(curl -fsS "$API_BASE_URL/orders/mine" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  | jq "map(select(.id==\"$ORDER_ID\")) | .[0] | {id,status,deliveryId,paymentId,totalAmount,currency}")"

BUYER_WALLET="$(curl -fsS "$API_BASE_URL/payments/wallet" -H "Authorization: Bearer $BUYER_TOKEN")"
SELLER_WALLET="$(curl -fsS "$API_BASE_URL/payments/wallet" -H "Authorization: Bearer $SELLER_TOKEN")"
COURIER_WALLET="$(curl -fsS "$API_BASE_URL/payments/wallet" -H "Authorization: Bearer $COURIER_TOKEN")"

echo
echo "== SUCCESS =="
echo "$DELIVERY_SUMMARY" | jq .
echo "$ORDER_SUMMARY" | jq .
echo "buyer wallet:   $(echo "$BUYER_WALLET" | jq -c .)"
echo "seller wallet:  $(echo "$SELLER_WALLET" | jq -c .)"
echo "courier wallet: $(echo "$COURIER_WALLET" | jq -c .)"
echo
echo "Context:"
echo "  seller=$SELLER_EMAIL"
echo "  buyer=$BUYER_EMAIL"
echo "  courier=$COURIER_EMAIL"
echo "  listingId=$LISTING_ID"
echo "  orderId=$ORDER_ID"
echo "  paymentId=$PAYMENT_ID"
echo "  deliveryId=$DELIVERY_ID"
