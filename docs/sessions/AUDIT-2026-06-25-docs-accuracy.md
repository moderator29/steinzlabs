# Docs Accuracy Audit (2026-06-25)

Read-only audit of every documentation/marketing surface vs the real
implementation and the live Supabase DB (`phvewrldcdxupsnakddx`). Two real
**code** bugs found and fixed in this branch; the remaining items are
documentation corrections (some involve a product decision and are flagged).

## Code bugs FIXED here
- **Max users excluded from VTX "pro" gate (client).** `components/VtxAiTab.tsx`
  and `app/dashboard/vtx-ai/page.tsx` used `const isPro = tier === 'pro'`, so a
  Max user was treated as non-pro and capped at 25 VTX msgs/day in that UI even
  though the server (`app/api/vtx-ai/route.ts:1081`) grants Max unlimited. →
  `tier === 'pro' || tier === 'max'`.
- **0x fee default was 0.4%, canonical is 0.5%.** `lib/services/zerox.ts` used
  `NEXT_PUBLIC_STEINZ_FEE_PERCENT || '0.004'` in both getSwapPrice and
  getSwapQuote, so when the env is unset the on-chain integrator fee was 0.4%,
  not the canonical 0.5% (`lib/trading/swapLogging.PLATFORM_FEE_BPS = 50`). →
  default `'0.005'`. (Confirm `NEXT_PUBLIC_STEINZ_FEE_PERCENT` is `0.005` or
  unset in env.)

## VTX message limits are fabricated across docs (HIGH)
Real system is **binary, per-IP**: free AND mini = 25/day
(`vtx-ai/route.ts:44` `FREE_TIER_LIMIT=25`); pro AND max = unlimited
(`:1081 isPro = pro||max`). There is no 100/150/400 tier. Every graduated
per-tier VTX number is wrong:
- `docs/pricing.md:51` Mini 150/day → 25/day
- `docs/pricing.md:65` Pro 400/day → unlimited
- `docs/pricing.md:84,124` Max "soft 1,000/day fair-use" → no such counter
- `app/whitepaper/page.tsx:666` Mini 100/day → 25/day
- `app/dashboard/pricing/page.tsx:42` Mini 100/day → 25/day
- `app/admin/docs/page.tsx:573` Mini 100/day → 25/day
> Product decision: Mini currently has NO VTX benefit over Free. Either give
> Mini a real quota (code) or state 25/day honestly.

## Sniper tier + chains wrong in docs/pricing.md (HIGH)
- Sniper is gated at **`max`** (`app/api/sniper/execute|criteria|kill-switch`
  all `withTierGate('max')`); `docs/pricing.md:66` lists it under Pro.
- Sniper chains = **ETH, SOL, BSC, TON, AVAX** (`lib/sniper/chains.ts:109`) —
  docs say "Ethereum, Base, BNB, Polygon, Solana" (no Base/Polygon; missing
  TON/AVAX).
- `CHANGELOG.md:82-84` still says sniper wraps `withTierGate('pro')` → now `'max'`.

## Chain-count chaos (HIGH) — pick one truth (DB has 9)
Live `whales` table: **449 rows, 291 verified, 9 chains** (incl. fantom).
- Landing `HeroLeft.tsx:28,33` + `cards-data.ts:18` + `FAQData.ts:34`: "12+ chains" (unsupported)
- `whitepaper:503,307`: "1,000+ wallets across 10 chains" → 449 / 9
- `README.md:11`: "8 chains"; `FeatureShowcase.tsx:166`: "1,000+ / 10 chains"
- `StatsSection.tsx:91` fallback `chainsSupported: 7`; swap supports 7 (`whitepaper:467`)
- `app/admin/docs/page.tsx:313`: "~1,000 wallets / 10 chains" → ~450 / 9

## Framework / stack versions (MED — quick fixes)
- `app/whitepaper/page.tsx:316`: "Built on Next.js 14" → **16** (`package.json` next ^16.2.6)
- `README.md:76` table: "Next.js 15" → 16 (README:11 already says 16 — internal contradiction)
- `README.md:85`: "Wagmi v5" → **v2** (`package.json` wagmi ^2.19.5)

## Swap fee stated as 0.4% in docs (now that code is 0.5%)
- `whitepaper:662`, `app/dashboard/pricing/page.tsx:28`, `app/admin/docs/page.tsx:328`
  say "0.4% fee" → canonical/code is now **0.5%**.

## Other code/comment mismatches (MED)
- `app/api/copy-trading/rules/route.ts:93` comment "alerts_only allowed at mini+"
  but wrapper is `withTierGate('pro')` → alerts_only is pro+. Whitepaper:487
  implies alerts-only below Pro — both inconsistent with the enforced pro floor.
- `lib/subscriptions/tiers.ts` (legacy FREE/PRO/PREMIUM + TIER_PRICING $19/$99)
  was removed on branch `fix/docs-accuracy...`/`feat/wallet-entitlements...`.

## Accurate, keep as-is (positive)
- README whale count "400+ tracked (290+ verified)" matches DB (449/291).
- `docs/pricing.md` Pro $9 / Max $15 matches the pricing page.
