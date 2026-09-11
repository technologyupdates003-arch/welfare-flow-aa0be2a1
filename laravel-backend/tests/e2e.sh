#!/usr/bin/env bash
# End-to-end endpoint tests for the KHCWW Laravel API.
# Usage: bash tests/e2e.sh [base-url]   (default http://127.0.0.1:8899)
B=${1:-http://127.0.0.1:8899}
pass=0; fail=0
chk() {
  if [ "$2" = "$3" ]; then echo "PASS $1 ($3)"; pass=$((pass+1));
  else echo "FAIL $1 expected $2 got $3 :: $(echo "$4" | head -c 300)"; fail=$((fail+1)); fi
}
req() {
  local m=$1 u=$2 d=$3 t=$4
  local args=(-s -o /tmp/lb-body -w '%{http_code}' -X "$m" "$B$u" -H 'Content-Type: application/json')
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$d" ] && args+=(-d "$d")
  curl "${args[@]}"
}
jget() { python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
except Exception:
  print(''); raise SystemExit
if isinstance(d,list): d = d[0] if d else {}
print(d.get('$1','') if isinstance(d,dict) else '')"; }

code=$(req GET /health); chk health 200 "$code" "$(cat /tmp/lb-body)"

code=$(req POST "/auth/v1/token?grant_type=password" '{"phone":"0700000000","password":"Member2026"}')
BODY=$(cat /tmp/lb-body); chk login 200 "$code" "$BODY"
TOKEN=$(echo "$BODY" | jget access_token)
REFRESH=$(echo "$BODY" | jget refresh_token)
if [ -n "$TOKEN" ]; then echo "PASS token-issued"; pass=$((pass+1)); else echo "FAIL token-issued"; fail=$((fail+1)); fi

code=$(req POST "/auth/v1/token?grant_type=password" '{"phone":"0700000000","password":"wrong"}'); chk bad-password 400 "$code" "$(cat /tmp/lb-body)"
code=$(req GET /auth/v1/user '' "$TOKEN"); chk current-user 200 "$code" "$(cat /tmp/lb-body)"
code=$(req GET /auth/v1/user); chk user-no-token 401 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/auth/v1/token?grant_type=refresh_token" "{\"refresh_token\":\"$REFRESH\"}"); chk refresh 200 "$code" "$(cat /tmp/lb-body)"

code=$(req GET "/rest/v1/members?select=id,name,phone&limit=5" '' "$TOKEN"); chk rest-select 200 "$code" "$(cat /tmp/lb-body)"
MID=$(cat /tmp/lb-body | jget id)
code=$(req GET "/rest/v1/members?count=exact" '' "$TOKEN"); chk rest-count 200 "$code" "$(cat /tmp/lb-body)"
code=$(req GET "/rest/v1/members?id=eq.$MID" '' "$TOKEN"); chk rest-filter-eq 200 "$code" "$(cat /tmp/lb-body)"
code=$(req GET "/rest/v1/members?name=ilike.*laban*&order=name.asc&limit=1" '' "$TOKEN"); chk rest-ilike-order 200 "$code" "$(cat /tmp/lb-body)"
code=$(req GET "/rest/v1/members"); chk rest-no-token 401 "$code" "$(cat /tmp/lb-body)"
code=$(req GET "/rest/v1/not_a_table" '' "$TOKEN"); chk rest-unknown-table 404 "$code" "$(cat /tmp/lb-body)"

code=$(req POST "/rest/v1/news" '{"title":"Test notice","content":"Hello members","status":"published"}' "$TOKEN")
chk rest-insert 201 "$code" "$(cat /tmp/lb-body)"
NID=$(cat /tmp/lb-body | jget id)
code=$(req PATCH "/rest/v1/news?id=eq.$NID" '{"title":"Updated notice"}' "$TOKEN"); chk rest-update 200 "$code" "$(cat /tmp/lb-body)"
code=$(req DELETE "/rest/v1/news?id=eq.$NID" '' "$TOKEN"); chk rest-delete 200 "$code" "$(cat /tmp/lb-body)"

code=$(req POST "/rest/v1/rpc/has_role" '{"_role":"super_admin"}' "$TOKEN"); chk rpc-has-role 200 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/rpc/get_members_with_roles" '{}' "$TOKEN"); chk rpc-members-roles 200 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/rpc/get_member_login_activity" '{"_search":"","_limit":5,"_offset":0}' "$TOKEN"); chk rpc-login-activity 200 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/rpc/generate_memo_reference" '{}' "$TOKEN"); chk rpc-memo-ref 200 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/rpc/update_member_status" "{\"target_member_id\":\"$MID\",\"new_status\":\"active\"}" "$TOKEN"); chk rpc-member-status 200 "$code" "$(cat /tmp/lb-body)"
code=$(req POST "/rpc/nope" '{}' "$TOKEN"); chk rpc-unknown 404 "$code" "$(cat /tmp/lb-body)"

echo "hello world" > /tmp/lb-upload.txt
code=$(curl -s -o /tmp/lb-body -w '%{http_code}' -X POST "$B/storage/v1/object/documents/test/hello.txt" -H "Authorization: Bearer $TOKEN" -F 'file=@/tmp/lb-upload.txt'); chk storage-upload 201 "$code" "$(cat /tmp/lb-body)"
code=$(curl -s -o /tmp/lb-body -w '%{http_code}' "$B/storage/v1/object/documents/test/hello.txt" -H "Authorization: Bearer $TOKEN"); chk storage-download 200 "$code" "$(cat /tmp/lb-body)"
code=$(curl -s -o /tmp/lb-body -w '%{http_code}' -X DELETE "$B/storage/v1/object/documents/test/hello.txt" -H "Authorization: Bearer $TOKEN"); chk storage-delete 200 "$code" "$(cat /tmp/lb-body)"

code=$(req POST /auth/v1/logout '' "$TOKEN"); chk logout 204 "$code" "$(cat /tmp/lb-body)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$B/rest/v1/members" -H 'Origin: http://x' -H 'Access-Control-Request-Method: GET'); chk cors-preflight 204 "$code" ""

echo "-------- PASS=$pass FAIL=$fail"
[ "$fail" = 0 ]
