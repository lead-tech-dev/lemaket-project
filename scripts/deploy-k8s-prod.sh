#!/usr/bin/env bash

set -euo pipefail

: "${PROD_SSH_HOST:?PROD_SSH_HOST is required}"
: "${PROD_SSH_USER:?PROD_SSH_USER is required}"

BACKEND_IMAGE="${BACKEND_IMAGE:-}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"
K8S_NAMESPACE="${K8S_NAMESPACE:-sandaga-prod}"
K8S_MANIFEST_PATH="${K8S_MANIFEST_PATH:-deploy/k8s/prod/apps.yaml}"

if [[ -z "$BACKEND_IMAGE" || -z "$FRONTEND_IMAGE" ]]; then
  echo "BACKEND_IMAGE and FRONTEND_IMAGE are required." >&2
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

REMOTE="${PROD_SSH_USER}@${PROD_SSH_HOST}"
REMOTE_DIR=".sandaga-k8s-prod"

ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p \"\$HOME/${REMOTE_DIR}\""
scp "${SSH_OPTS[@]}" "$K8S_MANIFEST_PATH" "$REMOTE:${REMOTE_DIR}/apps.yaml"

ssh "${SSH_OPTS[@]}" "$REMOTE" <<EOF
set -euo pipefail

if kubectl version --client >/dev/null 2>&1 && kubectl get namespace default >/dev/null 2>&1; then
  KCTL=(kubectl)
elif sudo -n k3s kubectl version --client >/dev/null 2>&1; then
  KCTL=(sudo -n k3s kubectl)
else
  echo "No Kubernetes access. Configure kubectl for ${PROD_SSH_USER} or allow passwordless: sudo k3s kubectl" >&2
  exit 1
fi

"\${KCTL[@]}" get namespace "${K8S_NAMESPACE}" >/dev/null 2>&1 || "\${KCTL[@]}" create namespace "${K8S_NAMESPACE}"
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" apply -f "\$HOME/${REMOTE_DIR}/apps.yaml"

if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  "\${KCTL[@]}" -n "${K8S_NAMESPACE}" create secret docker-registry ghcr-creds \
    --docker-server=ghcr.io \
    --docker-username="${GHCR_USER}" \
    --docker-password="${GHCR_TOKEN}" \
    --dry-run=client -o yaml | "\${KCTL[@]}" apply -f -
fi

"\${KCTL[@]}" -n "${K8S_NAMESPACE}" set image deployment/sandaga-backend backend="${BACKEND_IMAGE}"
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" set image deployment/sandaga-frontend frontend="${FRONTEND_IMAGE}"

"\${KCTL[@]}" -n "${K8S_NAMESPACE}" patch deployment sandaga-backend --type merge -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"ghcr-creds"}]}}}}' || true
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" patch deployment sandaga-frontend --type merge -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"ghcr-creds"}]}}}}' || true
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" patch deployment sandaga-backend --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"IfNotPresent"}]}}}}' || true
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" patch deployment sandaga-frontend --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","imagePullPolicy":"IfNotPresent"}]}}}}' || true

"\${KCTL[@]}" -n "${K8S_NAMESPACE}" rollout status deployment/sandaga-backend --timeout=300s
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" rollout status deployment/sandaga-frontend --timeout=300s
"\${KCTL[@]}" -n "${K8S_NAMESPACE}" get pods -o wide
EOF

echo "Kubernetes production deploy completed."
