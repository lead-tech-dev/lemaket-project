#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$0")/_flow-lib.sh"

require_basics
api_health_check

step "Auth - register"
AUTH_EMAIL="$(new_email auth)"
register_user "$AUTH_EMAIL" "Auth" "User" "false"
USER_ID="$(jq_get '.user.id')"
TOKEN="$(jq_get '.accessToken')"
[[ -n "$USER_ID" && "$USER_ID" != "null" ]] || { echo "Missing user id" >&2; exit 1; }
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || { echo "Missing access token" >&2; exit 1; }

step "Auth - login success"
login_user "$AUTH_EMAIL" "$TEST_PASSWORD"
assert_status_in "200 201"
assert_jq '.accessToken != null'

step "Auth - login failure"
login_user "$AUTH_EMAIL" "WrongPass123!"
assert_status_in "400 401 403"

step "Auth - forgot password"
api_call "POST" "/auth/forgot-password" "" "{\"email\":\"${AUTH_EMAIL}\"}"
assert_status_in "200 201"

step "Auth - reset password"
RESET_TOKEN="$(db_one "SELECT token FROM password_reset_tokens WHERE user_id='${USER_ID}' AND used=false ORDER BY created_at DESC LIMIT 1;")"
[[ -n "$RESET_TOKEN" ]] || { echo "Reset token not found in DB" >&2; exit 1; }
NEW_PASSWORD="New${TEST_PASSWORD}"
api_call "POST" "/auth/reset-password" "" "{\"token\":\"${RESET_TOKEN}\",\"password\":\"${NEW_PASSWORD}\"}"
assert_status_in "200 201 204"

step "Auth - login with new password"
login_user "$AUTH_EMAIL" "$NEW_PASSWORD"
assert_status_in "200 201"
assert_jq '.accessToken != null'

echo
echo "Auth flow OK"
echo "email=${AUTH_EMAIL}"
