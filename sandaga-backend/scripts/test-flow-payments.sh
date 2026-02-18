#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Payments - create user"
PAY_EMAIL="$(new_email pay.user)"
register_user "$PAY_EMAIL" "Pay" "User" "false"
PAY_USER_ID="$(jq_get '.user.id')"
PAY_TOKEN="$(jq_get '.accessToken')"

step "Payments - payment methods CRUD"
api_call "POST" "/payments/methods" "$PAY_TOKEN" '{"type":"wallet","label":"Wallet principal"}'
assert_status_in "200 201"
METHOD_ID="$(jq_get '.id')"

api_call "PATCH" "/payments/methods/${METHOD_ID}" "$PAY_TOKEN" '{"label":"Wallet principal MAJ","isDefault":true}'
assert_status_in "200"
assert_jq '.label == "Wallet principal MAJ"'

api_call "POST" "/payments/methods/${METHOD_ID}/verify" "$PAY_TOKEN" '{}'
assert_status_in "200 201"

api_call "POST" "/payments/methods/${METHOD_ID}/confirm" "$PAY_TOKEN" '{"success":true}'
assert_status_in "200 201"
assert_jq '.verificationStatus == "verified"'

api_call "GET" "/payments/methods" "$PAY_TOKEN"
assert_status_in "200"
assert_jq "map(select(.id == \"${METHOD_ID}\" and .verificationStatus == \"verified\")) | length == 1"

step "Payments - wallet summary + transactions + export"
db_sql "UPDATE users SET wallet_balance='7500.00', wallet_currency='XAF' WHERE id='${PAY_USER_ID}';" >/dev/null
db_sql "INSERT INTO wallet_transactions (user_id,type,amount,currency,status,metadata) VALUES ('${PAY_USER_ID}','topup','7500.00','XAF','completed','{}'::jsonb);" >/dev/null

api_call "GET" "/payments/wallet" "$PAY_TOKEN"
assert_status_in "200"
assert_jq '.currency == "XAF" and (.balance|tonumber) >= 7500'

api_call "GET" "/payments/wallet/transactions?limit=5" "$PAY_TOKEN"
assert_status_in "200"
assert_jq '.items | length >= 1'

EXPORT_STATUS="$(curl -sS -o /tmp/wallet-transactions.csv -w "%{http_code}" -H "Authorization: Bearer ${PAY_TOKEN}" "${API_BASE_URL}/payments/wallet/transactions/export")"
if [[ "$EXPORT_STATUS" != "200" ]]; then
  echo "Wallet CSV export failed with status ${EXPORT_STATUS}" >&2
  cat /tmp/wallet-transactions.csv >&2
  exit 1
fi
grep -q "Date,Type,Montant,Devise,Statut" /tmp/wallet-transactions.csv

step "Payments - invoices list"
api_call "GET" "/payments/invoices" "$PAY_TOKEN"
assert_status_in "200"
assert_jq 'type == "array"'

step "Payments - remove method"
api_call "DELETE" "/payments/methods/${METHOD_ID}" "$PAY_TOKEN"
assert_status_in "200 204"

echo
echo "Payments flow OK"
echo "user=${PAY_EMAIL}"
echo "walletExport=/tmp/wallet-transactions.csv"
