#!/usr/bin/env bash
# Week-1 check: sandbox OAuth → create order → you approve in a browser → capture.
# Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET from worker/.dev.vars. Needs curl + python3.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .dev.vars; set +a
BASE=https://api-m.sandbox.paypal.com

TOKEN=$(curl -s -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" -d grant_type=client_credentials $BASE/v1/oauth2/token | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
echo "oauth ok"

ORDER=$(curl -s -X POST $BASE/v2/checkout/orders \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -H "PayPal-Request-Id: $(uuidgen)" \
  -d '{"intent":"CAPTURE","purchase_units":[{"reference_id":"smoke-1","amount":{"currency_code":"USD","value":"12.34","breakdown":{"item_total":{"currency_code":"USD","value":"12.34"}}},"items":[{"name":"Errand smoke test","unit_amount":{"currency_code":"USD","value":"12.34"},"quantity":"1"}]}],
       "payment_source":{"paypal":{"experience_context":{"brand_name":"Errand","user_action":"PAY_NOW","shipping_preference":"NO_SHIPPING","return_url":"https://example.com/return","cancel_url":"https://example.com/cancel"}}}}')
ID=$(echo "$ORDER" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["id"])')
APPROVE=$(echo "$ORDER" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(l["href"] for l in d["links"] if l["rel"] in ("payer-action","approve")))')
echo "order $ID created"
echo
echo "1. Open this URL, log in with the SANDBOX PERSONAL account, click Pay Now:"
echo "   $APPROVE"
echo "2. After it redirects to example.com, come back here and press Enter."
read -r
curl -s -X POST "$BASE/v2/checkout/orders/$ID/capture" -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -H "PayPal-Request-Id: $(uuidgen)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("capture status:",d.get("status"));c=d["purchase_units"][0]["payments"]["captures"][0];print("capture id:",c["id"],c["amount"])'
