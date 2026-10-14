#!/usr/bin/env bash
# Demo recording helper for the iPhone 18 Pro simulator.
#   scripts/record-demo.sh prep     # status bar 9:41, reset the demo user's server data, relaunch the app
#   scripts/record-demo.sh start    # start recording to ~/Desktop/gofer-raw-<timestamp>.mov (Ctrl-C to stop)
#   scripts/record-demo.sh simulate <watchId> [price]   # force a price drop on the live Worker
#   scripts/record-demo.sh cfr <raw.mov>                # transcode to constant frame rate before cutting
set -euo pipefail
DEVICE=250FDF0D-DF15-4DC0-B569-B17ACF39C22A
USER_ID=88A7DF07-8698-4991-92D2-51CBD94C102C
BASE=https://gofer.kbfoxtk.workers.dev
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  prep)
    xcrun simctl status_bar "$DEVICE" override --time 9:41 --batteryLevel 100 --batteryState charged --cellularBars 4 --wifiBars 3
    (cd "$ROOT/worker" && npx wrangler d1 execute errand --remote --command \
      "DELETE FROM orders WHERE user_id='$USER_ID'; DELETE FROM watches WHERE user_id='$USER_ID'; UPDATE rules SET auto_under_usd=0, monthly_cap_usd=0 WHERE user_id='$USER_ID'; UPDATE users SET vault_id=NULL, vault_customer_id=NULL WHERE id='$USER_ID';" >/dev/null)
    xcrun simctl terminate "$DEVICE" com.gofer.ios 2>/dev/null || true
    xcrun simctl launch "$DEVICE" com.gofer.ios
    echo "ready: clean user, rules 0, no wallet, clock 9:41"
    ;;
  start)
    OUT=~/Desktop/gofer-raw-$(date +%H%M%S).mov
    echo "recording to $OUT (Ctrl-C to stop)"
    xcrun simctl io "$DEVICE" recordVideo --codec h264 "$OUT"
    ;;
  simulate)
    KEY=$(grep '^APP_KEY' "$ROOT/worker/.dev.vars" | cut -d= -f2- | tr -d '" ')
    curl -s -X POST "$BASE/debug/watches/${2:?watchId}/simulate" -H "content-type: application/json" \
      -H "x-app-key: $KEY" -H "x-user-id: $USER_ID" -d "{\"price\": ${3:-58}}"; echo
    ;;
  watches)
    (cd "$ROOT/worker" && npx wrangler d1 execute errand --remote --command "SELECT id, status, target_price, last_price FROM watches WHERE user_id='$USER_ID'")
    ;;
  cfr)
    IN=${2:?raw.mov}; OUT=${IN%.*}-cfr.mp4
    ffmpeg -i "$IN" -vf fps=30,scale=1080:-2 -c:v libx264 -crf 18 -pix_fmt yuv420p -an "$OUT"
    echo "$OUT"
    ;;
  *) sed -n 2,6p "$0"; exit 1;;
esac
