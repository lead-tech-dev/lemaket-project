#!/usr/bin/env bash
set -euo pipefail

# End-to-end regression script:
# Ensures a mobile-money payment is marked "completed" only when operator debit proof exists.
#
# Usage:
#   cd sandaga-backend
#   export PGPASSWORD='postgres'
#   bash scripts/test-mobile-money-webhook-debit-proof.sh
#
# Optional env overrides:
#   API_URL=http://localhost:3000
#   DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres DB_NAME=sandaga

API_URL="${API_URL:-http://localhost:3000}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-sandaga}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql introuvable."
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl introuvable."
  exit 1
fi

PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -P pager=off)

sql_scalar() {
  local query="$1"
  "${PSQL[@]}" -c "$query" | tr -d '\r' | sed '/^\s*$/d' | head -n1
}

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "PASS: $label => $actual"
  else
    echo "FAIL: $label (expected=$expected, actual=$actual)"
    exit 1
  fi
}

create_payment() {
  local provider="$1"
  local reference="$2"
  local metadata_json="$3"
  local user_id="$4"
  local description="TEST debit-proof $provider $reference"

  sql_scalar "INSERT INTO payments(amount,currency,status,description,provider,metadata,external_reference,user_id,payment_method_id)
              VALUES ('1000.00','XAF','pending','${description}','${provider}','${metadata_json}'::jsonb,'${reference}','${user_id}',NULL)
              RETURNING id;"
}

webhook_post() {
  local endpoint="$1"
  local payload="$2"
  curl -sS -X POST "$API_URL$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null
}

check_status() {
  local reference="$1"
  sql_scalar "SELECT status FROM payments WHERE external_reference='${reference}';"
}

check_debit_confirmed() {
  local reference="$1"
  sql_scalar "SELECT COALESCE(metadata->>'operatorDebitConfirmed','') FROM payments WHERE external_reference='${reference}';"
}

echo "==> Vérification connectivité API"
curl -sS "$API_URL/health" >/dev/null || echo "WARN: /health non accessible, on continue."

echo "==> Récupération d'un utilisateur de test"
USER_ID="$(sql_scalar "SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")"
if [[ -z "${USER_ID:-}" ]]; then
  echo "ERROR: aucun utilisateur trouvé dans la table users."
  exit 1
fi
echo "User test: $USER_ID"

STAMP="$(date +%s)"

echo ""
echo "==> ZIKOPAY: succès sans preuve => pending"
ZKP_REF_PENDING="it_zkp_np_${STAMP}"
create_payment "zikopay" "$ZKP_REF_PENDING" '{"paymentMethod":"mobile_money","paymentOperator":"orange"}' "$USER_ID" >/dev/null
webhook_post "/payments/zikopay/webhook" "{\"reference\":\"$ZKP_REF_PENDING\",\"status\":\"success\"}"
assert_eq "zikopay no-proof status" "pending" "$(check_status "$ZKP_REF_PENDING")"

echo "==> ZIKOPAY: succès avec preuve => completed"
ZKP_REF_OK="it_zkp_ok_${STAMP}"
create_payment "zikopay" "$ZKP_REF_OK" '{"paymentMethod":"mobile_money","paymentOperator":"orange"}' "$USER_ID" >/dev/null
webhook_post "/payments/zikopay/webhook" "{\"reference\":\"$ZKP_REF_OK\",\"status\":\"paid\",\"data\":{\"external_transaction_id\":\"ZKP-TX-$STAMP\",\"debitStatus\":\"debited\"}}"
assert_eq "zikopay with-proof status" "completed" "$(check_status "$ZKP_REF_OK")"
assert_eq "zikopay with-proof debit flag" "true" "$(check_debit_confirmed "$ZKP_REF_OK")"

echo ""
echo "==> MTN: succès sans preuve => pending"
MTN_REF_PENDING="it_mtn_np_${STAMP}"
create_payment "mtn" "$MTN_REF_PENDING" '{"paymentMethod":"mobile_money","paymentOperator":"mtn"}' "$USER_ID" >/dev/null
webhook_post "/payments/mtn/webhook" "{\"reference_id\":\"$MTN_REF_PENDING\",\"status\":\"SUCCESSFUL\"}"
assert_eq "mtn no-proof status" "pending" "$(check_status "$MTN_REF_PENDING")"

echo "==> MTN: succès avec preuve => completed"
MTN_REF_OK="it_mtn_ok_${STAMP}"
create_payment "mtn" "$MTN_REF_OK" '{"paymentMethod":"mobile_money","paymentOperator":"mtn"}' "$USER_ID" >/dev/null
webhook_post "/payments/mtn/webhook" "{\"reference_id\":\"$MTN_REF_OK\",\"status\":\"SUCCESSFUL\",\"financialTransactionId\":\"MTN-TX-$STAMP\",\"debitConfirmed\":true}"
assert_eq "mtn with-proof status" "completed" "$(check_status "$MTN_REF_OK")"
assert_eq "mtn with-proof debit flag" "true" "$(check_debit_confirmed "$MTN_REF_OK")"

echo ""
echo "==> ORANGE: succès sans preuve => pending"
OM_REF_PENDING="it_om_np_${STAMP}"
create_payment "orange" "$OM_REF_PENDING" '{"paymentMethod":"mobile_money","paymentOperator":"orange"}' "$USER_ID" >/dev/null
webhook_post "/payments/orange/webhook" "{\"reference\":\"$OM_REF_PENDING\",\"status\":\"PAID\"}"
assert_eq "orange no-proof status" "pending" "$(check_status "$OM_REF_PENDING")"

echo "==> ORANGE: succès avec preuve => completed"
OM_REF_OK="it_om_ok_${STAMP}"
create_payment "orange" "$OM_REF_OK" '{"paymentMethod":"mobile_money","paymentOperator":"orange"}' "$USER_ID" >/dev/null
webhook_post "/payments/orange/webhook" "{\"reference\":\"$OM_REF_OK\",\"status\":\"PAID\",\"txnid\":\"OM-TX-$STAMP\",\"debited\":true}"
assert_eq "orange with-proof status" "completed" "$(check_status "$OM_REF_OK")"
assert_eq "orange with-proof debit flag" "true" "$(check_debit_confirmed "$OM_REF_OK")"

echo ""
echo "SUCCESS: Tous les scénarios debit-proof sont conformes."
