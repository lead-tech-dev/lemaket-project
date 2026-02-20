#!/usr/bin/env bash

set -euo pipefail

MODE="subset"
DEV_DUMP_PATH=""
WORKDIR=""

DEV_NAMESPACE="${DEV_NAMESPACE:-sandaga-dev}"
PROD_NAMESPACE="${PROD_NAMESPACE:-sandaga-prod}"
DEV_DB_POD="${DEV_DB_POD:-pg-postgresql-0}"
PROD_DB_POD="${PROD_DB_POD:-pg-prod-postgresql-0}"
DEV_BACKEND_DEPLOY="${DEV_BACKEND_DEPLOY:-sandaga-backend}"
DEV_FRONTEND_DEPLOY="${DEV_FRONTEND_DEPLOY:-sandaga-frontend}"
PROD_BACKEND_DEPLOY="${PROD_BACKEND_DEPLOY:-sandaga-backend}"
DEV_REPLICAS="${DEV_REPLICAS:-1}"
PROD_REPLICAS="${PROD_REPLICAS:-2}"

usage() {
  cat <<'EOF'
Usage:
  bash ./scripts/k8s-data-sync.sh --mode subset
  bash ./scripts/k8s-data-sync.sh --mode all --dev-dump /path/sandaga-full.dump

Options:
  --mode subset|all    subset: sync categories/admin/form_* from dev to prod
                       all: restore full dump into dev, then run subset sync
  --dev-dump PATH      Required for --mode all
  --workdir PATH       Optional local working dir (defaults to mktemp)

Environment overrides:
  DEV_NAMESPACE, PROD_NAMESPACE
  DEV_DB_POD, PROD_DB_POD
  DEV_BACKEND_DEPLOY, DEV_FRONTEND_DEPLOY, PROD_BACKEND_DEPLOY
  DEV_REPLICAS, PROD_REPLICAS
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --dev-dump)
      DEV_DUMP_PATH="${2:-}"
      shift 2
      ;;
    --workdir)
      WORKDIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "subset" && "$MODE" != "all" ]]; then
  echo "Invalid --mode: $MODE" >&2
  usage
  exit 1
fi

if [[ "$MODE" == "all" ]]; then
  if [[ -z "$DEV_DUMP_PATH" || ! -f "$DEV_DUMP_PATH" ]]; then
    echo "--dev-dump is required and must exist when --mode all is used." >&2
    exit 1
  fi
fi

if [[ -z "$WORKDIR" ]]; then
  WORKDIR="$(mktemp -d -t sandaga-k8s-sync-XXXXXX)"
  AUTO_WORKDIR=1
else
  mkdir -p "$WORKDIR"
  AUTO_WORKDIR=0
fi

cleanup() {
  if [[ "${AUTO_WORKDIR:-0}" -eq 1 ]]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT

KCTL=()
if kubectl version --client >/dev/null 2>&1 && kubectl get namespace default >/dev/null 2>&1; then
  KCTL=(kubectl)
elif sudo -n k3s kubectl version --client >/dev/null 2>&1; then
  KCTL=(sudo -n k3s kubectl)
else
  echo "No Kubernetes access. Configure kubectl or allow passwordless sudo for: k3s kubectl" >&2
  exit 1
fi

kpsql_cmd() {
  local namespace="$1"
  local pod="$2"
  local database="$3"
  local sql="$4"
  "${KCTL[@]}" -n "$namespace" exec -i "$pod" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; psql -v ON_ERROR_STOP=1 -U postgres -d \"$database\" -c \"$sql\""
}

kpsql_stdin() {
  local namespace="$1"
  local pod="$2"
  local database="$3"
  "${KCTL[@]}" -n "$namespace" exec -i "$pod" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; psql -v ON_ERROR_STOP=1 -U postgres -d \"$database\""
}

get_column_list() {
  local namespace="$1"
  local pod="$2"
  local database="$3"
  local table="$4"
  "${KCTL[@]}" -n "$namespace" exec "$pod" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; psql -U postgres -d \"$database\" -Atc \"SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}';\""
}

export_dev_csv() {
  local query="$1"
  local output_file="$2"
  "${KCTL[@]}" -n "$DEV_NAMESPACE" exec -i "$DEV_DB_POD" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; psql -v ON_ERROR_STOP=1 -U postgres -d sandaga --csv" <<SQL > "$output_file"
$query
SQL
}

fix_dev_permissions() {
  kpsql_cmd "$DEV_NAMESPACE" "$DEV_DB_POD" postgres "ALTER DATABASE sandaga OWNER TO sandaga;"
  kpsql_cmd "$DEV_NAMESPACE" "$DEV_DB_POD" sandaga "ALTER SCHEMA public OWNER TO sandaga; GRANT USAGE, CREATE ON SCHEMA public TO sandaga;"
  kpsql_cmd "$DEV_NAMESPACE" "$DEV_DB_POD" sandaga "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sandaga; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sandaga; GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO sandaga;"
}

restore_dev_from_dump() {
  echo "Restoring full dump into ${DEV_NAMESPACE}/${DEV_DB_POD}..."
  "${KCTL[@]}" -n "$DEV_NAMESPACE" scale deployment "$DEV_BACKEND_DEPLOY" "$DEV_FRONTEND_DEPLOY" --replicas=0 || true
  "${KCTL[@]}" -n "$DEV_NAMESPACE" cp "$DEV_DUMP_PATH" "${DEV_DB_POD}:/tmp/sandaga-full.dump"
  "${KCTL[@]}" -n "$DEV_NAMESPACE" exec -i "$DEV_DB_POD" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \"DROP DATABASE IF EXISTS sandaga WITH (FORCE)\"; psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \"CREATE DATABASE sandaga\"; pg_restore -U postgres -d sandaga --no-owner --no-privileges /tmp/sandaga-full.dump"
  fix_dev_permissions
  "${KCTL[@]}" -n "$DEV_NAMESPACE" scale deployment "$DEV_BACKEND_DEPLOY" --replicas="$DEV_REPLICAS" || true
  "${KCTL[@]}" -n "$DEV_NAMESPACE" scale deployment "$DEV_FRONTEND_DEPLOY" --replicas="$DEV_REPLICAS" || true
}

backup_prod() {
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  local remote_dump="/tmp/prod-before-subset-${stamp}.dump"
  local local_dump="${WORKDIR}/prod-before-subset-${stamp}.dump"
  echo "Creating production backup at ${local_dump}..."
  "${KCTL[@]}" -n "$PROD_NAMESPACE" exec -i "$PROD_DB_POD" -- bash -lc \
    "export PGPASSWORD=\"\$(cat /opt/bitnami/postgresql/secrets/postgres-password)\"; pg_dump -U postgres -d sandaga -Fc -f \"$remote_dump\""
  "${KCTL[@]}" -n "$PROD_NAMESPACE" cp "${PROD_DB_POD}:${remote_dump}" "$local_dump"
}

sync_subset_dev_to_prod() {
  local categories_cols users_cols steps_cols fields_cols
  categories_cols="$(get_column_list "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga categories)"
  users_cols="$(get_column_list "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga users)"
  steps_cols="$(get_column_list "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga form_steps)"
  fields_cols="$(get_column_list "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga form_fields)"

  echo "Exporting CSV files from dev with prod column order..."
  export_dev_csv "SELECT ${categories_cols} FROM categories ORDER BY 1;" "${WORKDIR}/categories.csv"
  export_dev_csv "SELECT ${users_cols} FROM users WHERE role = \$\$admin\$\$ ORDER BY id;" "${WORKDIR}/admin_users.csv"
  export_dev_csv "SELECT ${steps_cols} FROM form_steps ORDER BY 1;" "${WORKDIR}/form_steps.csv"
  export_dev_csv "SELECT ${fields_cols} FROM form_fields ORDER BY 1;" "${WORKDIR}/form_fields.csv"

  echo "Copying CSV files to production db pod..."
  "${KCTL[@]}" -n "$PROD_NAMESPACE" cp "${WORKDIR}/categories.csv" "${PROD_DB_POD}:/tmp/categories.csv"
  "${KCTL[@]}" -n "$PROD_NAMESPACE" cp "${WORKDIR}/admin_users.csv" "${PROD_DB_POD}:/tmp/admin_users.csv"
  "${KCTL[@]}" -n "$PROD_NAMESPACE" cp "${WORKDIR}/form_steps.csv" "${PROD_DB_POD}:/tmp/form_steps.csv"
  "${KCTL[@]}" -n "$PROD_NAMESPACE" cp "${WORKDIR}/form_fields.csv" "${PROD_DB_POD}:/tmp/form_fields.csv"

  echo "Applying subset import to production..."
  "${KCTL[@]}" -n "$PROD_NAMESPACE" scale deployment "$PROD_BACKEND_DEPLOY" --replicas=0 || true

  cat <<'SQL' | kpsql_stdin "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga
BEGIN;
CREATE TEMP TABLE tmp_categories (LIKE categories INCLUDING ALL);
\copy tmp_categories FROM '/tmp/categories.csv' CSV HEADER;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
INSERT INTO categories SELECT * FROM tmp_categories;
COMMIT;
SQL

  cat <<'SQL' | kpsql_stdin "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga
BEGIN;
CREATE TEMP TABLE tmp_admin_users (LIKE users INCLUDING ALL);
\copy tmp_admin_users FROM '/tmp/admin_users.csv' CSV HEADER;
DELETE FROM users WHERE role = 'admin';
INSERT INTO users SELECT * FROM tmp_admin_users;
COMMIT;
SQL

  cat <<'SQL' | kpsql_stdin "$PROD_NAMESPACE" "$PROD_DB_POD" sandaga
BEGIN;
CREATE TEMP TABLE tmp_form_steps (LIKE form_steps INCLUDING ALL);
\copy tmp_form_steps FROM '/tmp/form_steps.csv' CSV HEADER;

CREATE TEMP TABLE tmp_form_fields (LIKE form_fields INCLUDING ALL);
\copy tmp_form_fields FROM '/tmp/form_fields.csv' CSV HEADER;

TRUNCATE TABLE form_fields RESTART IDENTITY CASCADE;
TRUNCATE TABLE form_steps RESTART IDENTITY CASCADE;

INSERT INTO form_steps SELECT * FROM tmp_form_steps;
INSERT INTO form_fields SELECT * FROM tmp_form_fields;
COMMIT;
SQL

  "${KCTL[@]}" -n "$PROD_NAMESPACE" scale deployment "$PROD_BACKEND_DEPLOY" --replicas="$PROD_REPLICAS" || true
}

echo "Using kubectl command: ${KCTL[*]}"
echo "Working directory: ${WORKDIR}"

if [[ "$MODE" == "all" ]]; then
  restore_dev_from_dump
fi

backup_prod
sync_subset_dev_to_prod

echo "Done."
echo "Quick checks:"
echo "  ${KCTL[*]} -n ${DEV_NAMESPACE} get pods"
echo "  ${KCTL[*]} -n ${PROD_NAMESPACE} get pods"
echo "  curl -fsS https://api-dev.lemaket.com/health"
echo "  curl -fsS https://api.lemaket.com/health"
