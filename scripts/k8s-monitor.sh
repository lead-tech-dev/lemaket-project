#!/usr/bin/env bash

set -euo pipefail

DEV_HEALTH_URL="${DEV_HEALTH_URL:-https://api-dev.lemaket.com/health}"
PROD_HEALTH_URL="${PROD_HEALTH_URL:-https://api.lemaket.com/health}"
DEV_NAMESPACE="${DEV_NAMESPACE:-sandaga-dev}"
PROD_NAMESPACE="${PROD_NAMESPACE:-sandaga-prod}"
DISK_PATH="${DISK_PATH:-/}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
DISK_CRIT_PERCENT="${DISK_CRIT_PERCENT:-95}"
LOG_SINCE="${LOG_SINCE:-15m}"
BACKEND_ERROR_WARN_THRESHOLD="${BACKEND_ERROR_WARN_THRESHOLD:-1}"
BACKEND_ERROR_FAIL_THRESHOLD="${BACKEND_ERROR_FAIL_THRESHOLD:-20}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_ON_WARN="${ALERT_ON_WARN:-false}"

FAIL_COUNT=0
WARN_COUNT=0
declare -a REPORT_LINES

add_ok() {
  REPORT_LINES+=("[OK] $1")
}

add_warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  REPORT_LINES+=("[WARN] $1")
}

add_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  REPORT_LINES+=("[FAIL] $1")
}

detect_kubectl() {
  if kubectl version --client >/dev/null 2>&1 && kubectl get namespace default >/dev/null 2>&1; then
    KCTL=(kubectl)
  elif sudo -n k3s kubectl version --client >/dev/null 2>&1; then
    KCTL=(sudo -n k3s kubectl)
  else
    echo "No Kubernetes access. Configure kubectl or allow passwordless sudo for: k3s kubectl" >&2
    exit 1
  fi
}

check_health() {
  local name="$1"
  local url="$2"
  local body_file
  body_file="$(mktemp)"

  local code
  code="$(curl -sS -m 15 -o "$body_file" -w "%{http_code}" "$url" || true)"
  local body
  body="$(cat "$body_file" 2>/dev/null || true)"
  rm -f "$body_file"

  if [[ "$code" != "200" ]]; then
    add_fail "${name} healthcheck failed (${url}) code=${code}"
    return
  fi

  if printf '%s' "$body" | grep -Eiq '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    add_ok "${name} healthcheck OK (${url})"
  else
    add_warn "${name} healthcheck returned 200 but body is unexpected (${url})"
  fi
}

check_backend_pods() {
  local namespace="$1"
  local bad
  bad="$("${KCTL[@]}" -n "$namespace" get pods -l app=sandaga-backend --no-headers 2>/dev/null | awk '$2 !~ /^1\/1$/ || $3 ~ /(CrashLoopBackOff|Error|ImagePullBackOff|ErrImagePull|Pending)/ {print $1" "$2" "$3}' || true)"

  if [[ -n "$bad" ]]; then
    add_fail "${namespace} backend pods unhealthy: ${bad//$'\n'/; }"
  else
    add_ok "${namespace} backend pods healthy"
  fi
}

check_recent_backend_errors() {
  local namespace="$1"
  local logs
  logs="$("${KCTL[@]}" -n "$namespace" logs deploy/sandaga-backend --since="$LOG_SINCE" 2>/dev/null || true)"
  local count
  count="$(printf '%s' "$logs" | grep -Eio 'error|exception|queryfailederror|unhandled' | wc -l | tr -d ' ' || true)"
  count="${count:-0}"

  if (( count >= BACKEND_ERROR_FAIL_THRESHOLD )); then
    add_fail "${namespace} backend logs: ${count} error-like lines in last ${LOG_SINCE}"
  elif (( count >= BACKEND_ERROR_WARN_THRESHOLD )); then
    add_warn "${namespace} backend logs: ${count} error-like lines in last ${LOG_SINCE}"
  else
    add_ok "${namespace} backend logs clean for last ${LOG_SINCE}"
  fi
}

check_disk() {
  local pct
  pct="$(df -P "$DISK_PATH" | awk 'NR==2 {gsub("%","",$5); print $5}')"
  pct="${pct:-0}"

  if (( pct >= DISK_CRIT_PERCENT )); then
    add_fail "Disk usage critical on ${DISK_PATH}: ${pct}%"
  elif (( pct >= DISK_WARN_PERCENT )); then
    add_warn "Disk usage high on ${DISK_PATH}: ${pct}%"
  else
    add_ok "Disk usage OK on ${DISK_PATH}: ${pct}%"
  fi
}

send_webhook_if_needed() {
  if [[ -z "$ALERT_WEBHOOK_URL" ]]; then
    return
  fi

  if (( FAIL_COUNT == 0 )) && [[ "$ALERT_ON_WARN" != "true" || "$WARN_COUNT" -eq 0 ]]; then
    return
  fi

  local status="WARN"
  if (( FAIL_COUNT > 0 )); then
    status="FAIL"
  fi

  local report
  report="$(printf '%s\n' "${REPORT_LINES[@]}")"
  local text
  text="[$status] sandaga k8s monitor ($(date -u +%Y-%m-%dT%H:%M:%SZ))\n${report}"
  local escaped
  escaped="$(printf '%s' "$text" | sed 's/\\/\\\\/g; s/"/\\"/g; :a;N;$!ba;s/\n/\\n/g')"

  curl -sS -m 15 -X POST \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${escaped}\",\"content\":\"${escaped}\"}" \
    "$ALERT_WEBHOOK_URL" >/dev/null || true
}

main() {
  detect_kubectl

  check_health "dev" "$DEV_HEALTH_URL"
  check_health "prod" "$PROD_HEALTH_URL"
  check_backend_pods "$DEV_NAMESPACE"
  check_backend_pods "$PROD_NAMESPACE"
  check_recent_backend_errors "$DEV_NAMESPACE"
  check_recent_backend_errors "$PROD_NAMESPACE"
  check_disk

  printf '%s\n' "${REPORT_LINES[@]}"
  echo "Summary: fails=${FAIL_COUNT} warns=${WARN_COUNT}"

  send_webhook_if_needed

  if (( FAIL_COUNT > 0 )); then
    exit 1
  fi
}

main "$@"
