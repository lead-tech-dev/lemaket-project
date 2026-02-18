#!/usr/bin/env bash

set -euo pipefail

# Backward-compatible wrapper: STAGING_* -> DEV_*
export DEV_SSH_HOST="${DEV_SSH_HOST:-${STAGING_SSH_HOST:-}}"
export DEV_SSH_USER="${DEV_SSH_USER:-${STAGING_SSH_USER:-}}"
export DEV_APP_DIR="${DEV_APP_DIR:-${STAGING_APP_DIR:-}}"

bash "$(dirname "$0")/deploy-dev.sh"
