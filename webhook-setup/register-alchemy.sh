#!/usr/bin/env bash
# Bulk-register all 6 Alchemy Address Activity webhooks via the Notify API.
# Skips the "paste a huge list" UI dance — one API call per chain adds all
# addresses at once.
#
# PREREQUISITE:
#   Get your Notify Auth Token from https://dashboard.alchemy.com/webhooks
#   (top-right, "AUTH TOKEN" — looks like "ai_xxxxxxxxxxxxxxx")
#
# USAGE (from repo root):
#   export ALCHEMY_NOTIFY_TOKEN="ai_xxxxxxx..."
#   bash webhook-setup/register-alchemy.sh
#
# Output: for each webhook created, prints the webhook id + signing_key.
# Collect the signing_keys, comma-join them, paste into Vercel env
#   ALCHEMY_WEBHOOK_SIGNING_KEYS=key1,key2,key3,key4,key5,key6

set -euo pipefail

if [ -z "${ALCHEMY_NOTIFY_TOKEN:-}" ]; then
  echo "ERROR: export ALCHEMY_NOTIFY_TOKEN first. Get it at https://dashboard.alchemy.com/webhooks"
  exit 1
fi

WEBHOOK_URL="https://nakalabs.xyz/api/webhooks/alchemy-whale"

# chain-name  alchemy-network-enum  address-file
CHAINS=(
  "ethereum ETH_MAINNET  webhook-setup/ethereum.txt"
  "base     BASE_MAINNET webhook-setup/base.txt"
  "bsc      BNB_MAINNET  webhook-setup/bsc.txt"
  "polygon  MATIC_MAINNET webhook-setup/polygon.txt"
  "arbitrum ARB_MAINNET  webhook-setup/arbitrum.txt"
  "optimism OPT_MAINNET  webhook-setup/optimism.txt"
)

KEYS=()

for row in "${CHAINS[@]}"; do
  read -r chain network file <<< "$row"
  echo ""
  echo "──── $chain ($network) ────"

  # Build JSON array of addresses
  addrs_json=$(awk '{printf "\"%s\",", $0}' "$file" | sed 's/,$//')

  body='{"network":"'"$network"'","webhook_type":"ADDRESS_ACTIVITY","webhook_url":"'"$WEBHOOK_URL"'","addresses":['"$addrs_json"']}'

  response=$(curl -sS -X POST "https://dashboard.alchemy.com/api/create-webhook" \
    -H "X-Alchemy-Token: $ALCHEMY_NOTIFY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")

  echo "$response"

  # Extract signing_key if present
  key=$(echo "$response" | grep -oE '"signing_key":"[^"]+"' | head -1 | cut -d'"' -f4)
  if [ -n "$key" ]; then
    KEYS+=("$key")
    echo "  → signing_key captured"
  else
    echo "  ⚠ no signing_key in response (may already exist or failed)"
  fi
done

echo ""
echo "══════════════════════════════════════════════════════════"
echo "All 6 webhooks processed. Paste this into Vercel env:"
echo ""
IFS=','
echo "ALCHEMY_WEBHOOK_SIGNING_KEYS=${KEYS[*]}"
echo ""
echo "Then redeploy."
