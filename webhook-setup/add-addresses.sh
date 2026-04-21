#!/usr/bin/env bash
# Bulk-add real whale addresses to your EXISTING Alchemy webhooks.
# Use this if you already created the webhooks manually with 1 placeholder
# address each (to grab the signing keys) and now want to add the rest.
#
# PREREQ:
#   1. export ALCHEMY_NOTIFY_TOKEN="ai_xxxxxxxxx"
#   2. Find each webhook's ID from https://dashboard.alchemy.com/webhooks
#      (click the webhook — URL ends in wh_xxxxxxxxxxxxx OR it's shown on
#      the list page as "ID: wh_...")
#   3. Fill in the WEBHOOK_IDS map below, matching chain → webhook id
#   4. Run: bash webhook-setup/add-addresses.sh

set -euo pipefail

if [ -z "${ALCHEMY_NOTIFY_TOKEN:-}" ]; then
  echo "ERROR: export ALCHEMY_NOTIFY_TOKEN first."
  exit 1
fi

# Webhook IDs from the Alchemy dashboard (naka-whale-* webhooks).
# Captured 2026-04-21 from the dashboard webhook list view.
declare -A WEBHOOK_IDS=(
  [ethereum]="wh_lqusytlrh1bnslp8"
  [base]="wh_xy2ur9az80x8xhrx"
  [bsc]="wh_oe0k7c1owoyhjjro"
  [polygon]="wh_wiv4iil3t9q5jvv2"
  [arbitrum]="wh_bytaoha5wvjmlrwu"
)

for chain in "${!WEBHOOK_IDS[@]}"; do
  wid="${WEBHOOK_IDS[$chain]}"
  file="webhook-setup/$chain.txt"

  if [[ "$wid" == wh_REPLACE_ME_* ]]; then
    echo "⚠  Skipping $chain — webhook ID not filled in"
    continue
  fi
  if [ ! -f "$file" ]; then
    echo "⚠  Skipping $chain — $file not found"
    continue
  fi

  echo ""
  echo "──── $chain → $wid ────"

  addrs=$(awk '{printf "\"%s\",", $0}' "$file" | sed 's/,$//')
  body='{"webhook_id":"'"$wid"'","addresses_to_add":['"$addrs"'],"addresses_to_remove":[]}'

  curl -sS -X PATCH "https://dashboard.alchemy.com/api/update-webhook-addresses" \
    -H "X-Alchemy-Token: $ALCHEMY_NOTIFY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
  echo ""
done
