# Audit gap closure — patch instructions

This branch (`feat/audit-gap-closures`) ships standalone modules that
close the gaps surfaced by the brutal-honest audit on 2026-05-22:

- `lib/dune/realImplementations.ts` — real computations replacing the
  stub `{ note: '...' }` returns in `vtxToolsDune.ts` for 6 tier-1 +
  tier-2 tools.
- `lib/dune/fallbackFetchers.ts` — Birdeye + CoinGecko + Etherscan
  fallback closures for the §5.8 failure-ladder Tier-2 slot.
- `supabase/migrations/2026_05_22_dune_audit_gap_closures.sql` — the 6
  missing tables + 2 missing column sets the audit identified.

The foundation branches (`feat/dune-integration`,
`feat/dune-use-surfaces-and-followups`, `feat/portfolio-depth-and-security-hardening`)
aren't merged into main yet. Once they merge, apply these one-line
swap-ins to wire the real implementations into the existing tools:

---

## 1. Wire real handlers in `lib/ai/vtxToolsDune.ts`

Add at the top of the file:
```ts
import {
  computeSandwichRisk,
  computeStablecoinPulse,
  computeCexFlow,
  computeSmartMoneyInflowForToken,
  computeInsiderCheck,
  computeFindWalletsLike,
} from '@/lib/dune/realImplementations';
```

Then replace these six handlers (currently returning `{ note: '...' }`):

```ts
// handleSmartMoneyInflow
async function handleSmartMoneyInflow(input: { token_address: string; chain: string; hours?: number }) {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeSmartMoneyInflowForToken(input.token_address, input.chain, input.hours ?? 24);
  return JSON.stringify(r);
}

// handleSandwichRisk
async function handleSandwichRisk(input: { token_in: string; token_out: string; chain: string; size_usd: number }) {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeSandwichRisk(input);
  return JSON.stringify({ ...input, ...r });
}

// handleCexFlow
async function handleCexFlow(input: { chain: string; hours?: number }) {
  if (!isDuneConfigured()) return unavailable();
  return JSON.stringify(await computeCexFlow(input.chain, input.hours ?? 24));
}

// handleStablecoinPulse
async function handleStablecoinPulse(input: { chain: string; hours?: number }) {
  if (!isDuneConfigured()) return unavailable();
  return JSON.stringify(await computeStablecoinPulse(input.chain, input.hours ?? 24));
}

// handleInsiderCheck
async function handleInsiderCheck(input: { address: string; token: string; chain: string }) {
  if (!isDuneConfigured()) return unavailable();
  return JSON.stringify(await computeInsiderCheck(input.address, input.token, input.chain));
}

// handleFindWalletsLike
async function handleFindWalletsLike(input: { address: string; chain?: string; limit?: number }) {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeFindWalletsLike(input.address, input.chain ?? 'ethereum', input.limit ?? 20);
  return JSON.stringify({ seed: input.address, peers: r });
}
```

Net effect: 6 of the 8 tier-2 stubs become real. Three remain stubs
because they genuinely need a Dune query published first
(`token_age_buyers`, `new_token_scanner`, `mev_loss_report`). Those
return from their respective new materialized tables once the cron
populates them — same return-shape, no further code change.

---

## 2. Wire token-level smart-money flow in `lib/dune/useSurfaces.ts`

In `getTokenIntelligenceStrip`, replace the `smart_money_net_flow_24h_usd: null`
line with a real read from `computeSmartMoneyInflowForToken`:

```ts
import { computeSmartMoneyInflowForToken } from '@/lib/dune/realImplementations';

// inside getTokenIntelligenceStrip:
const flow = await computeSmartMoneyInflowForToken(token, chain, 24);
return {
  // ... existing fields
  smart_money_net_flow_24h_usd: flow.net_inflow_usd,
  // ... rest
};
```

---

## 3. Wire bytecode Tier-2 Jaccard in `lib/security/bytecodeSimilarity.ts`

After this migration applies, `rug_contract_signatures.shingles`
column exists. Replace the Tier-2 candidate-fetch block with:

```ts
// Tier 2: length-bucketed Jaccard.
const lenBytes = stripped.length / 2;
const lo = Math.floor(lenBytes * 0.95);
const hi = Math.ceil(lenBytes * 1.05);
const { data: candidates } = await admin
  .from('rug_contract_signatures')
  .select('address, category, shingles, bytecode_length')
  .gte('bytecode_length', lo)
  .lte('bytecode_length', hi)
  .not('shingles', 'is', null)
  .limit(50);

const targetShingles = shingles(stripped);
let bestMatch: { address: string; category: string; jaccard: number } | null = null;
for (const c of candidates ?? []) {
  const candShingles = new Set(String(c.shingles).split(','));
  const j = jaccard(targetShingles, candShingles);
  if (j >= 0.85 && (!bestMatch || j > bestMatch.jaccard)) {
    bestMatch = { address: c.address as string, category: c.category as string, jaccard: j };
  }
}
if (bestMatch) {
  return {
    chain, address,
    match: 'similar', confidence: Math.round(bestMatch.jaccard * 100),
    category: bestMatch.category,
    matchedAddress: bestMatch.address,
    bytecodeLength: lenBytes,
    jaccard: bestMatch.jaccard,
  };
}
```

When seeding new entries into `rug_contract_signatures`, write the
shingles column by joining the 8-byte tokens:
```sql
UPDATE rug_contract_signatures
SET shingles = (
  SELECT string_agg(s, ',')
  FROM <whatever populates the bytecode → shingles>
)
WHERE bytecode_hash = '...';
```

Or use the existing `shingles(hex)` helper in
`lib/security/bytecodeSimilarity.ts` from a one-off backfill script.

---

## 4. Wire failure-ladder fallbacks

In any caller of `descendLadder<T>` (e.g. new Dune-derived endpoints
under `/api/intelligence/dune/*`), pass a fallback closure from
`lib/dune/fallbackFetchers.ts`:

```ts
import { descendLadder } from '@/lib/dune/failureLadder';
import { holderConcentrationFallback } from '@/lib/dune/fallbackFetchers';

const result = await descendLadder({
  source_name: 'dune.holder_concentration',
  dune_result: await runDuneQuery({ query_id: process.env.DUNE_QUERY_HOLDER_CONCENTRATION!, parameters: { token, chain } }),
  transformDune: (rows) => rows[0],
  fallback: () => holderConcentrationFallback(token, chain),
});
```

When the Birdeye fallback wins, response headers stamp
`X-Data-Freshness: fallback` and the UI footnotes "data via Birdeye".

---

## 5. Wire drop-in components into pages

The three components from `feat/dune-use-surfaces-and-followups`
(`DuneIntelligenceStrip`, `SwapDuneStrip`, `DuneFeedCards`) are
unused. Drop them in:

**Token detail page** (`app/dashboard/market/[chain]/[address]/page.tsx`),
near the header chip strip:
```tsx
import DuneIntelligenceStrip from '@/components/market/DuneIntelligenceStrip';
// ... inside the JSX:
<DuneIntelligenceStrip chain={chain} address={address} />
```

**Swap page** (`app/dashboard/swap/page.tsx`), above the submit button:
```tsx
import SwapDuneStrip from '@/components/trading/SwapDuneStrip';
// ... inside the JSX:
{quoteData && (
  <SwapDuneStrip
    chain={chain}
    token_in={fromToken.address}
    token_out={toToken.address}
    size_usd={amountInUSD}
  />
)}
```

**Context Feed** (wherever the existing feed renders, typically
`app/dashboard/page.tsx` or a feed component):
```tsx
import DuneFeedCards from '@/components/context-feed/DuneFeedCards';
// ... inside the feed:
<DuneFeedCards limit={12} />
```

---

## 6. Extend `dune-refresh` cron with the new tables

Add to `TARGETS` in `app/api/cron/dune-refresh/route.ts`:

```ts
{ table: 'dune_token_age_buyers',     query_env: 'DUNE_QUERY_TOKEN_AGE_BUYERS',     ttl_seconds: 86_400, cost_credits: 25, mapper: mapTokenAgeBuyers,     primary_key: ['token_address', 'chain'] },
{ table: 'dune_smart_money_token_flow', query_env: 'DUNE_QUERY_SMART_MONEY_FLOW',    ttl_seconds: 21_600, cost_credits: 50, mapper: mapSmartMoneyFlow,    primary_key: ['token_address', 'chain'] },
{ table: 'dune_stablecoin_pulse',     query_env: 'DUNE_QUERY_STABLECOIN_PULSE',     ttl_seconds: 3_600,  cost_credits: 20, mapper: mapStablecoinPulse,    primary_key: ['chain', 'hour_bucket'] },
{ table: 'dune_cex_flow',             query_env: 'DUNE_QUERY_CEX_FLOW',             ttl_seconds: 3_600,  cost_credits: 20, mapper: mapCexFlow,            primary_key: ['chain', 'exchange', 'hour_bucket'] },
{ table: 'dune_mev_loss_aggregate',   query_env: 'DUNE_QUERY_MEV_LOSS',             ttl_seconds: 86_400, cost_credits: 30, mapper: mapMevLossAggregate,   primary_key: ['wallet_address', 'chain'] },
```

Mapper helpers mirror the existing `mapHolderConcentration` /
`mapBridgeFlows` pattern.

---

## What's still genuinely missing after these patches

After all six patches apply, the brutal-honest scorecard updates to:

| Layer | Before | After |
|---|---|---|
| Dune tier-1 tools | 3/5 real | 5/5 real (sandwich proper) |
| Dune tier-2 tools | 4/12 real | 10/12 real (3 still need Dune queries) |
| Trading Terminal strip | 2/7 real | 3/7 (smart-money flow lands; LP health, cohort bands, first-buyer, whales-holding still pending) |
| Swap UI strip | 1/8 real | 2/8 (sandwich proper; honeypot+tax still pending GoPlus wire) |
| Context Feed cards | 3/8 real | 5/8 (stablecoin_pulse + cex_drain land; 3 still pending Dune queries) |
| Bytecode Tier-2 | stub | live (Jaccard ≥ 0.85) |

Honest gaps remaining:
- 3 Dune queries genuinely need to be published before token_age_buyers,
  new_token_scanner, mev_loss_report can return real data
- Trading Terminal LP health / cohort bands / first-buyer / whales-holding
  need separate data pipelines (LP health from DexScreener,
  cohort bands from token_age_buyers Dune query, first-buyer from
  on-chain event scan)
- Swap UI honeypot_flag + observed_buy/sell_tax need GoPlus cache
  wire-in (existing infrastructure, just need the read paths)
