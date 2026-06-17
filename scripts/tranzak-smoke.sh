#!/usr/bin/env bash
#
# Tranzak smoke test — auth, collecte (mobile wallet charge) puis polling du statut.
#
# Valide de bout en bout le contrat externe Tranzak :
#   POST /auth/token                                  (appId + appKey -> token)
#   POST /xp021/v1/request/create-mobile-wallet-charge  (-> requestId)
#   GET  /xp021/v1/request/details?requestId=<id>     (statut autoritaire)
# Met en évidence le champ `amount`/`currencyCode` renvoyé par le provider.
#
# Config (par ordre de priorité) :
#   1) variables d'env TRANZAK_APP_ID / TRANZAK_APP_KEY / TRANZAK_BASE
#   2) TRANZAK_APP_ID / TRANZAK_APP_KEY / TRANZAK_MODE / TRANZAK_BASE_URL
#      lus dans sandaga-backend/.env
#
# Usage :
#   scripts/tranzak-smoke.sh                          # sandbox, 100 XAF, MTN success
#   scripts/tranzak-smoke.sh --amount 50 --phone 237680657567
#   scripts/tranzak-smoke.sh --prod --yes --phone 2376XXXXXXXX --amount 100
#
# Numéro de test SANDBOX validé :
#   237680657567 MTN -> SUCCESSFUL (auto-complété sans PIN)
#   (la sandbox Tranzak complète automatiquement les collectes.)
#
# ⚠️  --prod initie une VRAIE transaction (argent réel + confirmation USSD sur
#     un vrai téléphone). Nécessite --yes et un --phone réel.

set -euo pipefail

AMOUNT="100"
PHONE="237680657567"
EXTREF="smoke-$(date +%s 2>/dev/null || echo manual)"
PROD=0
CONFIRM=0
DESC="Tranzak smoke test"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --amount) AMOUNT="$2"; shift 2;;
    --phone)  PHONE="$2"; shift 2;;
    --ref)    EXTREF="$2"; shift 2;;
    --desc)   DESC="$2"; shift 2;;
    --prod)   PROD=1; shift;;
    --yes)    CONFIRM=1; shift;;
    -h|--help) sed -n '2,30p' "$0"; exit 0;;
    *) echo "Option inconnue: $1" >&2; exit 2;;
  esac
done

# --- Résolution de la config -------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../sandaga-backend/.env"

read_env() { # $1 = clé ; renvoie vide (sans échouer) si absente/commentée
  [[ -f "$ENV_FILE" ]] || return 0
  { grep -E "^$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- | tr -d '\r'
}

APP_ID="${TRANZAK_APP_ID:-$(read_env TRANZAK_APP_ID)}"
APP_KEY="${TRANZAK_APP_KEY:-$(read_env TRANZAK_APP_KEY)}"
MODE="$(read_env TRANZAK_MODE)"
if [[ "$PROD" -eq 1 ]]; then
  BASE="${TRANZAK_BASE:-https://dsapi.tranzak.me}"
else
  BASE="${TRANZAK_BASE:-$(read_env TRANZAK_BASE_URL)}"
  if [[ -z "$BASE" ]]; then
    [[ "${MODE,,}" == "live" ]] && BASE="https://dsapi.tranzak.me" || BASE="https://sandbox.dsapi.tranzak.me"
  fi
fi

if [[ -z "$APP_ID" || -z "$APP_KEY" ]]; then
  echo "❌ Identifiants Tranzak introuvables (TRANZAK_APP_ID / TRANZAK_APP_KEY dans $ENV_FILE)." >&2
  exit 1
fi

# Extrait une clé depuis l'enveloppe { success, data:{...} } : cherche dans data puis à la racine.
jget() { python3 -c "import json,sys
try: d=json.load(sys.stdin)
except Exception: print(''); sys.exit(0)
data=d.get('data') if isinstance(d,dict) else None
if isinstance(data,dict) and '$1' in data: print(data.get('$1',''))
elif isinstance(d,dict): print(d.get('$1',''))
else: print('')"; }

# --- Garde-fou PROD ----------------------------------------------------------
if [[ "$PROD" -eq 1 ]]; then
  echo "⚠️  MODE PRODUCTION : transaction RÉELLE de ${AMOUNT} XAF vers ${PHONE}."
  if [[ "$CONFIRM" -ne 1 ]]; then
    echo "   Refusé : ajoutez --yes pour confirmer une transaction réelle." >&2
    exit 1
  fi
  case "$PHONE" in 237680657567)
    echo "   Refusé : numéro de test sandbox utilisé en prod. Donnez un vrai --phone." >&2
    exit 1;;
  esac
  case "${APP_KEY}" in SAND_*)
    echo "   Refusé : clé SAND_ utilisée en --prod. Fournissez une clé PROD_." >&2
    exit 1;;
  esac
fi

echo "== Tranzak smoke =="
echo "  base   : $BASE"
echo "  appId  : $APP_ID   appKey: ${APP_KEY:0:9}…(${#APP_KEY} chars)"
echo "  amount : $AMOUNT XAF   phone: $PHONE   mchRef: $EXTREF"
echo

# --- 1) Auth -----------------------------------------------------------------
echo "→ POST /auth/token"
AUTH=$(curl -sS -m 30 -X POST "$BASE/auth/token" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d "{\"appId\":\"$APP_ID\",\"appKey\":\"$APP_KEY\"}")
TOKEN="$(printf '%s' "$AUTH" | jget token)"
if [[ -z "$TOKEN" ]]; then
  echo "❌ Auth échouée : $AUTH" >&2
  exit 1
fi
echo "  token=${TOKEN:0:8}…  scope=$(printf '%s' "$AUTH" | jget scope)  expiresIn=$(printf '%s' "$AUTH" | jget expiresIn)"
echo

# --- 2) Collecte -------------------------------------------------------------
echo "→ POST /xp021/v1/request/create-mobile-wallet-charge"
COLLECT=$(curl -sS -m 30 -X POST "$BASE/xp021/v1/request/create-mobile-wallet-charge" \
  -H "Authorization: Bearer $TOKEN" -H "X-App-ID: $APP_ID" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d "{\"amount\":$AMOUNT,\"currencyCode\":\"XAF\",\"description\":\"$DESC\",\"mobileWalletNumber\":\"$PHONE\",\"mchTransactionRef\":\"$EXTREF\",\"returnUrl\":\"https://dev.lemaket.com\"}")
echo "  $COLLECT"
REQID="$(printf '%s' "$COLLECT" | jget requestId)"
if [[ -z "$REQID" ]]; then
  echo "❌ Pas de requestId renvoyé — collecte échouée. Arrêt." >&2
  exit 1
fi
echo "  requestId=$REQID  status=$(printf '%s' "$COLLECT" | jget status)"
echo

# --- 3) Polling du statut ----------------------------------------------------
echo "→ GET /xp021/v1/request/details?requestId=$REQID (polling jusqu'à 120s)"
FINAL=""
for i in $(seq 1 20); do
  sleep 6
  S=$(curl -sS -m 20 -H "Authorization: Bearer $TOKEN" -H "X-App-ID: $APP_ID" -H "Accept: application/json" \
    "$BASE/xp021/v1/request/details?requestId=$REQID")
  ST="$(printf '%s' "$S" | jget status)"
  AMT="$(printf '%s' "$S" | jget amount)"
  echo "  poll$i: status=$ST amount=$AMT"
  if [[ "$ST" == "SUCCESSFUL" || "$ST" == "FAILED" ]]; then FINAL="$S"; break; fi
done

echo
if [[ -z "$FINAL" ]]; then
  echo "⏱  Statut non résolu dans le délai (reste PENDING/IN_PROGRESS). requestId: $REQID"
  exit 3
fi

FINAL_STATUS="$(printf '%s' "$FINAL" | jget status)"
FINAL_AMOUNT="$(printf '%s' "$FINAL" | jget amount)"
FINAL_CURRENCY="$(printf '%s' "$FINAL" | jget currencyCode)"
FINAL_TXID="$(printf '%s' "$FINAL" | jget transactionId)"
echo "== Résultat =="
echo "  status        : $FINAL_STATUS"
echo "  amount        : $FINAL_AMOUNT $FINAL_CURRENCY   (attendu: $AMOUNT XAF)"
echo "  transactionId : $FINAL_TXID"
echo
if [[ "$FINAL_STATUS" == "SUCCESSFUL" ]]; then
  if [[ -n "$FINAL_TXID" ]]; then
    echo "✅ SUCCESSFUL avec transactionId → preuve de débit OK (contrôle anti-fraude actif)."
  else
    echo "ℹ️  SUCCESSFUL sans transactionId → preuve de débit absente (le backend resterait PENDING)."
  fi
fi
