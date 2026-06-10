#!/usr/bin/env bash
#
# CamPay smoke test — collecte (payin) puis polling du statut.
#
# Valide de bout en bout le contrat externe CamPay : auth, POST /collect/,
# GET /transaction/<ref>/. Met en évidence le champ `amount` renvoyé par le
# provider (utile pour vérifier si la PROD renvoie le vrai montant, là où la
# sandbox renvoie 0.00).
#
# Config (par ordre de priorité) :
#   1) variables d'env CAMPAY_TOKEN / CAMPAY_BASE
#   2) CAMPAY_PERMANENT_TOKEN / CAMPAY_BASE_URL lus dans sandaga-backend/.env
#
# Usage :
#   scripts/campay-smoke.sh                      # sandbox, 10 XAF, MTN success
#   scripts/campay-smoke.sh --phone 237677777770 # sandbox, numéro FAILED
#   scripts/campay-smoke.sh --amount 5 --phone 237699999999   # Orange success
#   scripts/campay-smoke.sh --prod --yes --phone 2376XXXXXXXX --amount 100
#
# Numéros de test SANDBOX (max 25 XAF) :
#   237677777777 MTN -> SUCCESSFUL   237677777770 MTN -> FAILED
#   237699999999 ORG -> SUCCESSFUL   237699999990 ORG -> FAILED
#
# ⚠️  --prod initie une VRAIE transaction (argent réel + confirmation USSD sur
#     un vrai téléphone). Nécessite --yes et un --phone réel.

set -euo pipefail

AMOUNT="10"
PHONE="237677777777"
EXTREF="smoke-$(date +%s 2>/dev/null || echo manual)"
PROD=0
CONFIRM=0
DESC="CamPay smoke test"

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

read_env() { # $1 = clé
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r'
}

TOKEN="${CAMPAY_TOKEN:-$(read_env CAMPAY_PERMANENT_TOKEN)}"
if [[ "$PROD" -eq 1 ]]; then
  BASE="${CAMPAY_BASE:-https://www.campay.net/api}"
else
  BASE="${CAMPAY_BASE:-$(read_env CAMPAY_BASE_URL)}"
  BASE="${BASE:-https://demo.campay.net/api}"
fi

if [[ -z "$TOKEN" ]]; then
  echo "❌ Token CamPay introuvable (CAMPAY_TOKEN ou CAMPAY_PERMANENT_TOKEN dans $ENV_FILE)." >&2
  exit 1
fi

jget() { python3 -c "import json,sys;
try: d=json.load(sys.stdin)
except Exception: print(''); sys.exit(0)
print(d.get('$1','') if isinstance(d, dict) else '')"; }

# --- Garde-fou PROD ----------------------------------------------------------
if [[ "$PROD" -eq 1 ]]; then
  echo "⚠️  MODE PRODUCTION : transaction RÉELLE de ${AMOUNT} XAF vers ${PHONE}."
  if [[ "$CONFIRM" -ne 1 ]]; then
    echo "   Refusé : ajoutez --yes pour confirmer une transaction réelle." >&2
    exit 1
  fi
  case "$PHONE" in 23767777777*|23769999999*)
    echo "   Refusé : numéro de test sandbox utilisé en prod. Donnez un vrai --phone." >&2
    exit 1;;
  esac
fi

echo "== CamPay smoke =="
echo "  base   : $BASE"
echo "  token  : ${TOKEN:0:6}…(${#TOKEN} chars)"
echo "  amount : $AMOUNT XAF   phone: $PHONE   ext_ref: $EXTREF"
echo

# --- 1) Collect --------------------------------------------------------------
echo "→ POST /collect/"
COLLECT=$(curl -sS -m 30 -X POST "$BASE/collect/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d "{\"amount\":\"$AMOUNT\",\"currency\":\"XAF\",\"from\":\"$PHONE\",\"description\":\"$DESC\",\"external_reference\":\"$EXTREF\"}")
echo "  $COLLECT"
REF="$(printf '%s' "$COLLECT" | jget reference)"
if [[ -z "$REF" ]]; then
  echo "❌ Pas de reference renvoyée — collecte échouée. Arrêt." >&2
  exit 1
fi
echo "  reference=$REF  ussd=$(printf '%s' "$COLLECT" | jget ussd_code)  operator=$(printf '%s' "$COLLECT" | jget operator)"
echo

# --- 2) Polling du statut ----------------------------------------------------
echo "→ GET /transaction/$REF/ (polling jusqu'à 120s)"
FINAL=""
for i in $(seq 1 20); do
  sleep 6
  S=$(curl -sS -m 20 -H "Authorization: Token $TOKEN" -H "Accept: application/json" "$BASE/transaction/$REF/")
  ST="$(printf '%s' "$S" | jget status)"
  AMT="$(printf '%s' "$S" | jget amount)"
  echo "  poll$i: status=$ST amount=$AMT"
  if [[ "$ST" == "SUCCESSFUL" || "$ST" == "FAILED" ]]; then FINAL="$S"; break; fi
done

echo
if [[ -z "$FINAL" ]]; then
  echo "⏱  Statut non résolu dans le délai (reste PENDING). Réf: $REF"
  exit 3
fi

FINAL_STATUS="$(printf '%s' "$FINAL" | jget status)"
FINAL_AMOUNT="$(printf '%s' "$FINAL" | jget amount)"
FINAL_APP_AMOUNT="$(printf '%s' "$FINAL" | jget app_amount)"
echo "== Résultat =="
echo "  status      : $FINAL_STATUS"
echo "  amount      : $FINAL_AMOUNT   (attendu: $AMOUNT)"
echo "  app_amount  : $FINAL_APP_AMOUNT"
echo "  operator_reference : $(printf '%s' "$FINAL" | jget operator_reference)"
echo
if [[ "$FINAL_STATUS" == "SUCCESSFUL" ]]; then
  if [[ "$FINAL_AMOUNT" == "0.00" || "$FINAL_AMOUNT" == "0" || -z "$FINAL_AMOUNT" ]]; then
    echo "ℹ️  amount=0 sur SUCCESSFUL → le provider ne reporte pas le montant (cas sandbox)."
    echo "    Le contrôle anti-fraude se désactive proprement ; la garde reste le statut re-vérifié."
  else
    echo "✅ amount réel reporté sur SUCCESSFUL → le contrôle anti-fraude de montant est actif."
  fi
fi
