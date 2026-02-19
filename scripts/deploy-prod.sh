#!/usr/bin/env bash

set -euo pipefail

: "${PROD_SSH_HOST:?PROD_SSH_HOST is required}"
: "${PROD_SSH_USER:?PROD_SSH_USER is required}"
: "${PROD_APP_DIR:?PROD_APP_DIR is required}"

BACKEND_IMAGE="${BACKEND_IMAGE:-}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"
PROD_ENV_FILE="${PROD_ENV_FILE:-}"
PROD_APP_PUBLIC_URL="${PROD_APP_PUBLIC_URL:-}"
PROD_API_PUBLIC_URL="${PROD_API_PUBLIC_URL:-}"

if [[ -z "$BACKEND_IMAGE" || -z "$FRONTEND_IMAGE" ]]; then
  echo "BACKEND_IMAGE and FRONTEND_IMAGE are required." >&2
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

REMOTE="${PROD_SSH_USER}@${PROD_SSH_HOST}"

RESOLVED_PROD_APP_DIR="$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "REQUESTED_APP_DIR='${PROD_APP_DIR}' bash -s" <<'EOF'
set -euo pipefail

prepare_dir() {
  local dir="$1"
  if mkdir -p "$dir" 2>/dev/null; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo mkdir -p "$dir"
    sudo chown -R "$(id -u):$(id -g)" "$dir"
    return 0
  fi
  return 1
}

requested="${REQUESTED_APP_DIR:-$HOME/sandaga}"
fallback="$HOME/sandaga"

if prepare_dir "$requested"; then
  echo "$requested"
  exit 0
fi

if [[ "$requested" != "$fallback" ]] && prepare_dir "$fallback"; then
  echo "Permission denied for $requested, fallback to $fallback." >&2
  echo "$fallback"
  exit 0
fi

echo "Permission denied for $requested and fallback $fallback." >&2
echo "Set PROD_APP_DIR to a writable path or grant passwordless sudo for mkdir/chown." >&2
exit 1
EOF
)"

scp "${SSH_OPTS[@]}" "./docker-compose.deploy.yml" "${REMOTE}:${RESOLVED_PROD_APP_DIR}/docker-compose.deploy.yml"

if [[ -n "$PROD_ENV_FILE" ]]; then
  if [[ ! -f "$PROD_ENV_FILE" ]]; then
    echo "PROD_ENV_FILE points to a missing file: $PROD_ENV_FILE" >&2
    exit 1
  fi
  scp "${SSH_OPTS[@]}" "$PROD_ENV_FILE" "${REMOTE}:${RESOLVED_PROD_APP_DIR}/.env"
fi

ssh "${SSH_OPTS[@]}" "$REMOTE" <<EOF
set -euo pipefail
cd '${RESOLVED_PROD_APP_DIR}'

if [[ ! -f .env ]]; then
  echo ".env not found in ${RESOLVED_PROD_APP_DIR}. Create it before deploy or provide PROD_ENV_FILE." >&2
  exit 1
fi

chmod 600 .env || true

if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

upsert_env() {
  local key="\$1"
  local value="\$2"
  if grep -q "^\${key}=" .env; then
    sed -i "s|^\${key}=.*|\${key}=\${value}|" .env
  else
    echo "\${key}=\${value}" >> .env
  fi
}

upsert_env BACKEND_IMAGE "${BACKEND_IMAGE}"
upsert_env FRONTEND_IMAGE "${FRONTEND_IMAGE}"

# Align runtime public URLs (CORS, links) with prod domains when provided.
if [[ -n "${PROD_APP_PUBLIC_URL}" ]]; then
  upsert_env APP_PUBLIC_URL "${PROD_APP_PUBLIC_URL}"
  upsert_env FRONTEND_URL "${PROD_APP_PUBLIC_URL}"
fi

if [[ -n "${PROD_API_PUBLIC_URL}" ]]; then
  upsert_env API_PUBLIC_URL "${PROD_API_PUBLIC_URL}"
fi

if [[ -x ./backup-postgres.sh ]]; then
  APP_DIR='${RESOLVED_PROD_APP_DIR}' ./backup-postgres.sh || true
fi

docker compose -f docker-compose.deploy.yml pull backend frontend
docker compose -f docker-compose.deploy.yml up -d --remove-orphans db minio minio-init backend frontend
docker compose -f docker-compose.deploy.yml ps
EOF

echo "Production deploy completed."
