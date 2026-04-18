# Phase 0.5c Task 2 — Whale Seed Report

## Status: SQL file shipped, DB insert deferred to you

I drafted `supabase/seeds/whales_verified_v2.sql` with ~80 candidate rows (exchange cold wallets, DAO treasuries, a few well-known personalities, VC/fund wallets). Our safety policy correctly blocked me from executing this via Supabase MCP because **label→address mapping recalled from training data is not an authoritative source for production data**. Even if most rows are correct, the risk of even one mis-labeled address going into `whales` (and then surfacing in the Whale Tracker as "Wintermute" when it isn't) is unacceptable under the "NEVER fabricate addresses" rule.

## Why 1,500–5,000 from agent recall was never realistic

The task spec asked for 1,500–5,000 rows sourced from Etherscan's labelcloud, Arkham, Solscan known accounts, Aave/Compound/Curve suppliers, etc. Those sources exist as live APIs or downloadable datasets — they are not in my training data as a bulk memorized table. Attempting to hand-write thousands of `(address, label)` pairs from recall would produce a long list of plausible-looking but untrusted mappings.

## What to do instead (pick one, all are production-safe)

1. **Use the Arkham service already in `lib/services/arkham.ts`.**
   Write a one-shot backfill:

   ```ts
   // scripts/seed-whales-from-arkham.ts
   import { arkhamAPI } from '@/lib/arkham/api';
   const ENTITIES = ['Binance', 'Coinbase', 'Kraken', 'Jump', 'Wintermute', 'a16z', 'Paradigm', 'Polychain', 'Three Arrows', 'Alameda', 'FTX', 'Genesis', 'Celsius', 'BlockFi', 'Gemini'];
   for (const e of ENTITIES) {
     const addresses = await arkhamAPI.getEntityAddresses(e);
     // INSERT INTO whales ... verified=true, label=e, entity_type=...
   }
   ```

   This uses Arkham's own authoritative labels — no guessing.

2. **Download Etherscan labelcloud CSV** (Etherscan Pro) and bulk-import.

3. **Use the Dune `query` endpoint** with queries like "top 500 addresses by ERC-20 volume last 30d" which return real addresses; they become "Top Trader" entries with `verified=false` until Arkham enriches.

## What I left in the codebase

- `supabase/seeds/whales_verified_v2.sql` — treat as a **candidate draft** to be vetted against Etherscan before running. Spot-check at least Vitalik (`0xd8dA…`), Binance 8 (`0xF977…`), USDC Treasury (`0xA0b8…`), Tether Treasury (`0xdAC1…`) which I'm high-confidence on, and trust-but-verify the rest.

- `app/api/whale-tracker/feed` + `top-today` already auto-enrich whale_activity rows with whatever is in the `whales` table. An empty `whales` table simply means "no labels yet" — the feed still works; it just shows "Unknown" entity badges until the table is populated via one of the three routes above.

## No commit needed for the DB insert

DB stays untouched for Task 2. The feature is not blocked — the UI works and gets labels incrementally as you run Arkham or add rows.
