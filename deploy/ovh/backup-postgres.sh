#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sandaga}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"

mkdir -p "${BACKUP_DIR}"
cd "${APP_DIR}"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="${BACKUP_DIR}/sandaga-${ts}.sql.gz"

docker compose -f "${COMPOSE_FILE}" exec -T "${DB_CONTAINER}" \
  pg_dump -U "${DATABASE_USER:-postgres}" "${DATABASE_NAME:-sandaga}" \
  | gzip -9 > "${out}"

find "${BACKUP_DIR}" -type f -name "sandaga-*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup created: ${out}"
