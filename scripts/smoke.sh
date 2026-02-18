#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"

echo "Running smoke checks on ${BASE_URL}"

health_code="$(curl -sS -o /tmp/smoke-health.json -w "%{http_code}" "${BASE_URL}/health")"
if [[ "$health_code" != "200" ]]; then
  echo "Health check failed with status ${health_code}" >&2
  cat /tmp/smoke-health.json >&2 || true
  exit 1
fi

home_code="$(curl -sS -o /tmp/smoke-home.json -w "%{http_code}" "${BASE_URL}/home")"
if [[ "$home_code" != "200" ]]; then
  echo "Home endpoint failed with status ${home_code}" >&2
  cat /tmp/smoke-home.json >&2 || true
  exit 1
fi

echo "Smoke checks passed."
