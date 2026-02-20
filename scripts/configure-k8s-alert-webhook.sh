#!/usr/bin/env bash

set -euo pipefail

MON_NS="${MONITORING_NAMESPACE:-monitoring}"
WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

usage() {
  cat <<'EOF'
Usage:
  ALERT_WEBHOOK_URL="https://hooks.slack.com/services/..." \
  bash ./scripts/configure-k8s-alert-webhook.sh
EOF
}

if [[ -z "$WEBHOOK_URL" ]]; then
  usage
  echo "ALERT_WEBHOOK_URL is required." >&2
  exit 1
fi

if kubectl version --client >/dev/null 2>&1 && kubectl get namespace default >/dev/null 2>&1; then
  KCTL=(kubectl)
elif sudo -n k3s kubectl version --client >/dev/null 2>&1; then
  KCTL=(sudo -n k3s kubectl)
elif [[ -t 0 ]] && sudo k3s kubectl version --client >/dev/null 2>&1; then
  KCTL=(sudo k3s kubectl)
else
  echo "No Kubernetes access. Configure kubectl or allow passwordless sudo for k3s kubectl." >&2
  exit 1
fi

"${KCTL[@]}" get namespace "$MON_NS" >/dev/null 2>&1 || "${KCTL[@]}" create namespace "$MON_NS"

"${KCTL[@]}" -n "$MON_NS" create secret generic monitoring-webhook \
  --from-literal=url="$WEBHOOK_URL" \
  --dry-run=client -o yaml | "${KCTL[@]}" apply -f -

"${KCTL[@]}" apply -f deploy/k8s/monitoring/alertmanager-config.yaml

echo "Alert webhook configured in namespace ${MON_NS}."
