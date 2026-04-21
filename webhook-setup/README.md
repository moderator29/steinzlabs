# Alchemy webhook address lists

One file per chain. Open the .txt file, select all, copy, paste into Alchemy dashboard's Addresses field when creating an Address Activity webhook.

Webhook URL for all of them (Alchemy EVM): `https://nakalabs.xyz/api/webhooks/alchemy-whale`
Webhook URL for Helius (Solana):         `https://nakalabs.xyz/api/webhooks/helius-whale`

After creating each Alchemy webhook, copy its Signing Key. Vercel env:
  ALCHEMY_WEBHOOK_SIGNING_KEYS=key1,key2,key3,key4,key5   (comma-separated, any match passes)

For Helius webhook: set a custom Authorization header value of your choice,
then put the same value in Vercel env:
  HELIUS_WEBHOOK_SECRET=your-value

Do not commit the `ethereum.txt` back if it grows (225+ lines is fine, but keep the repo clean).

Counts as of 2026-04-20:
- ethereum.txt: 215
- bsc.txt: 14
- base.txt: 5
- avalanche.txt: 5 (Alchemy doesn't support Avalanche Address Activity on all plans — verify)
- polygon.txt: 4
- arbitrum.txt: 3
- optimism.txt: 3
