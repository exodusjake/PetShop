#!/usr/bin/env bash
# Quick health + security check of a running Pawzora site. It only reads; it changes nothing.
#
#   Full check through the web server:   ./deploy/smoke-test.sh https://shop.example.com
#   API only (e.g. on the API server):    API_ONLY=1 ./deploy/smoke-test.sh http://localhost:4000
set -u
BASE="${1:-}"; [ -z "$BASE" ] && { echo "Usage: $0 <base-url>   (e.g. https://shop.example.com)"; exit 2; }
BASE="${BASE%/}"
PASS=0; FAIL=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
check(){ if [ "$2" = "1" ]; then ok "$1"; else bad "$1"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }
hdr()  { curl -s -I --max-time 15 "$@" | tr -d '\r'; }
has()  { echo "$1" | grep -qi "^$2" && echo 1 || echo 0; }

echo "Checking $BASE"
echo "API"
H=$(curl -s --max-time 15 "$BASE/api/health"); check "health endpoint reports the database connected" "$(echo "$H" | grep -q '"db":"connected"' && echo 1 || echo 0)"
P=$(curl -s --max-time 15 "$BASE/api/catalog/categories"); check "catalog responds with categories" "$(echo "$P" | grep -q '"categories"' && echo 1 || echo 0)"
AH=$(hdr "$BASE/api/catalog/categories")
check "API responses are not cacheable (Cache-Control: no-store)" "$(has "$AH" 'cache-control: no-store')"
check "API sets X-Content-Type-Options: nosniff" "$(has "$AH" 'x-content-type-options: nosniff')"
check "API does not reveal the framework (no X-Powered-By)" "$([ "$(has "$AH" 'x-powered-by')" = "0" ] && echo 1 || echo 0)"
check "admin API refuses anonymous visitors (401)" "$([ "$(code "$BASE/api/admin/stats")" = "401" ] && echo 1 || echo 0)"
check "orders API refuses anonymous visitors (401)" "$([ "$(code "$BASE/api/orders")" = "401" ] && echo 1 || echo 0)"
check "state-changing request without the CSRF header is blocked (403)" "$([ "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/logout")" = "403" ] && echo 1 || echo 0)"
check "malformed JSON is a clean 400, not a crash" "$([ "$(code -X POST -H 'X-Requested-With: pawzora' -H 'Content-Type: application/json' -d '{bad' "$BASE/api/auth/login")" = "400" ] && echo 1 || echo 0)"
check "unknown API path is 404" "$([ "$(code "$BASE/api/does-not-exist")" = "404" ] && echo 1 || echo 0)"

if [ "${API_ONLY:-0}" != "1" ]; then
  echo "Website"
  check "home page loads (200)" "$([ "$(code "$BASE/")" = "200" ] && echo 1 || echo 0)"
  check "deep link /shop returns the app (200)" "$([ "$(code "$BASE/shop")" = "200" ] && echo 1 || echo 0)"
  check "privacy policy page is reachable (200)" "$([ "$(code "$BASE/privacy")" = "200" ] && echo 1 || echo 0)"
  WH=$(hdr "$BASE/")
  check "Content-Security-Policy header is present" "$(has "$WH" 'content-security-policy')"
  check "X-Frame-Options is set (clickjacking protection)" "$(has "$WH" 'x-frame-options')"
  check "X-Content-Type-Options: nosniff is set" "$(has "$WH" 'x-content-type-options: nosniff')"
  check "nginx version is hidden (server_tokens off)" "$(echo "$WH" | grep -qiE '^server: nginx/[0-9]' && echo 0 || echo 1)"
  check ".env is never served" "$([ "$(code "$BASE/.env")" != "200" ] && echo 1 || echo 0)"
  check ".git is never served" "$([ "$(code "$BASE/.git/config")" != "200" ] && echo 1 || echo 0)"
  check "uploads folder cannot be listed" "$(curl -s --max-time 15 "$BASE/uploads/" | grep -qi 'index of' && echo 0 || echo 1)"
  case "$BASE" in
    https://*) check "HTTP redirects to HTTPS" "$([ "$(code "http://${BASE#https://}/")" = "301" ] || [ "$(code "http://${BASE#https://}/")" = "308" ] && echo 1 || echo 0)"
               check "HSTS header is present" "$(has "$WH" 'strict-transport-security')" ;;
    *) echo "  NOTE  $BASE is not HTTPS: login cookies need HTTPS in production (see DEPLOY.md)" ;;
  esac
fi

echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
