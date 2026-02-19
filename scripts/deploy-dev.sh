#!/usr/bin/env bash

set -euo pipefail

: "${DEV_SSH_HOST:?DEV_SSH_HOST is required}"
: "${DEV_SSH_USER:?DEV_SSH_USER is required}"
: "${DEV_APP_DIR:?DEV_APP_DIR is required}"

BACKEND_IMAGE="${BACKEND_IMAGE:-}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"

if [[ -z "$BACKEND_IMAGE" || -z "$FRONTEND_IMAGE" ]]; then
  echo "BACKEND_IMAGE and FRONTEND_IMAGE are required." >&2
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

REMOTE="${DEV_SSH_USER}@${DEV_SSH_HOST}"

ssh "${SSH_OPTS[@]}" "$REMOTE" <<EOF
set -euo pipefail
APP_DIR='${DEV_APP_DIR}'

if mkdir -p "\${APP_DIR}" 2>/dev/null; then
  exit 0
fi

if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo mkdir -p "\${APP_DIR}"
  sudo chown -R "\$(id -u):\$(id -g)" "\${APP_DIR}"
  exit 0
fi

echo "Permission denied for \${APP_DIR}." >&2
echo "Set DEV_APP_DIR to a writable path (example: \$HOME/sandaga-dev) or grant passwordless sudo for mkdir/chown." >&2
exit 1
EOF

scp "${SSH_OPTS[@]}" "./docker-compose.deploy.yml" "${REMOTE}:${DEV_APP_DIR}/docker-compose.deploy.yml"

ssh "${SSH_OPTS[@]}" "$REMOTE" <<EOF
set -euo pipefail
cd '${DEV_APP_DIR}'

if [[ ! -f .env ]]; then
  echo ".env not found in ${DEV_APP_DIR}. Create it before deploy." >&2
  exit 1
fi

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
