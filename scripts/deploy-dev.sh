#!/usr/bin/env bash

set -euo pipefail

: "${DEV_SSH_HOST:?DEV_SSH_HOST is required}"
: "${DEV_SSH_USER:?DEV_SSH_USER is required}"
: "${DEV_APP_DIR:?DEV_APP_DIR is required}"

BACKEND_IMAGE="${BACKEND_IMAGE:-}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"
DEV_ENV_FILE="${DEV_ENV_FILE:-}"

if [[ -z "$BACKEND_IMAGE" || -z "$FRONTEND_IMAGE" ]]; then
  echo "BACKEND_IMAGE and FRONTEND_IMAGE are required." >&2
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

REMOTE="${DEV_SSH_USER}@${DEV_SSH_HOST}"

RESOLVED_DEV_APP_DIR="$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "REQUESTED_APP_DIR='${DEV_APP_DIR}' bash -s" <<'EOF'
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

requested="${REQUESTED_APP_DIR:-$HOME/sandaga-dev}"
fallback="$HOME/sandaga-dev"

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
echo "Set DEV_APP_DIR to a writable path or grant passwordless sudo for mkdir/chown." >&2
exit 1
EOF
)"

scp "${SSH_OPTS[@]}" "./docker-compose.deploy.yml" "${REMOTE}:${RESOLVED_DEV_APP_DIR}/docker-compose.deploy.yml"

if [[ -n "$DEV_ENV_FILE" ]]; then
  if [[ ! -f "$DEV_ENV_FILE" ]]; then
    echo "DEV_ENV_FILE points to a missing file: $DEV_ENV_FILE" >&2
    exit 1
  fi
  scp "${SSH_OPTS[@]}" "$DEV_ENV_FILE" "${REMOTE}:${RESOLVED_DEV_APP_DIR}/.env"
fi

ssh "${SSH_OPTS[@]}" "$REMOTE" <<EOF
set -euo pipefail
cd '${RESOLVED_DEV_APP_DIR}'

if [[ ! -f .env ]]; then
  echo ".env not found in ${RESOLVED_DEV_APP_DIR}. Create it before deploy or provide DEV_ENV_FILE." >&2
  exit 1
fi

chmod 600 .env || true

if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

if grep -q '^BACKEND_IMAGE=' .env; then
  sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=${BACKEND_IMAGE}|" .env
else
  echo "BACKEND_IMAGE=${BACKEND_IMAGE}" >> .env
fi

if grep -q '^FRONTEND_IMAGE=' .env; then
  sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=${FRONTEND_IMAGE}|" .env
else
  echo "FRONTEND_IMAGE=${FRONTEND_IMAGE}" >> .env
fi

docker compose -f docker-compose.deploy.yml pull backend frontend
docker compose -f docker-compose.deploy.yml up -d --remove-orphans db minio minio-init backend frontend
docker compose -f docker-compose.deploy.yml ps
EOF

echo "Dev deploy completed."
