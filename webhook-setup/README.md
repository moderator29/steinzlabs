# Alchemy webhook address lists

One file per chain. Open the .txt file, select all, copy, paste into Alchemy dashboard's Addresses field when creating an Address Activity webhook.

Webhook URL for all of them: `https://steinzlabs.vercel.app/api/webhooks/alchemy-whale`

After creating each webhook, copy its Signing Key into Vercel env `ALCHEMY_WEBHOOK_SIGNING_KEY`.

Do not commit the `ethereum.txt` back if it grows (225+ lines is fine, but keep the repo clean).

Counts as of 2026-04-20:
- ethereum.txt: 215
- bsc.txt: 14
- base.txt: 5
- avalanche.txt: 5 (Alchemy doesn't support Avalanche Address Activity on all plans — verify)
- polygon.txt: 4
- arbitrum.txt: 3
- optimism.txt: 3
