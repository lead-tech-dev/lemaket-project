#!/usr/bin/env bash

set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

run_flow() {
  local script="$1"
  echo
  echo "#############################################"
  echo "# Running ${script}"
  echo "#############################################"
  bash "${BASE_DIR}/${script}"
}

run_flow "test-flow-auth.sh"
run_flow "test-flow-users.sh"
run_flow "test-flow-listings.sh"
run_flow "test-flow-messages.sh"
run_flow "test-flow-payments.sh"
run_flow "test-flow-home-storefront.sh"
run_flow "test-flow-engagement.sh"
run_flow "test-flow-dashboard.sh"
run_flow "test-delivery-flow.sh"
run_flow "test-flow-admin.sh"
run_flow "test-flow-admin-advanced.sh"

echo
echo "All flow scripts passed."
