# Handoff: Dune queries setup

**Mission for next session:** create 11 Dune queries, save them, copy the IDs into the matching Vercel env vars. After this, every Dune-derived surface in the platform lights up end-to-end.

Owner is `moderator29` (Phantomfcalls). Read CLAUDE.md before doing anything — locked rules apply.

---

## 0. Credentials + how to run

The Dune API key is in `.env.local` at the repo root (gitignored — NEVER commit it):

```bash
cat .env.local
# Should print: DUNE_API_KEY=<key>
```

You have two paths to create the 11 queries. Pick whichever your session supports:

**Path A — Dune MCP** (preferred). Owner has already configured the Dune MCP server on their Claude Code with:

```bash
claude mcp add --scope user --transport http dune https://api.dune.com/mcp/v1 --header "x-dune-api-key: <key>"
```

If `mcp__dune__*` tools appear in your tool list, use them. Look for tools like `mcp__dune__create_query`, `mcp__dune__execute_query`, etc.

**Path B — direct REST API via curl**. If your auto-mode classifier blocks API-key-in-command-line, write the key to an env file first, then `curl` reading from `$DUNE_API_KEY`:

```bash
export DUNE_API_KEY=$(grep DUNE_API_KEY .env.local | cut -d= -f2)
curl -X POST https://api.dune.com/api/v1/query \
  -H "X-Dune-API-Key: $DUNE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"...","query_sql":"..."}'
```

The Dune REST endpoint for creating queries is `POST /api/v1/query`. Response contains `query_id` — that's the integer you paste into Vercel.

---

## 1. The 11 queries to create

For each query below: create it on Dune, name it as shown, save it, capture the `query_id`, then build the env-var mapping at the end of this doc.

Schema rule: each query's SELECT must return the exact column names listed in the comment header. The dune-refresh cron's mapper (`app/api/cron/dune-refresh/route.ts`) writes those columns into the matching Supabase table. If column names mismatch, the row writes nulls and the surface stays blank.

If a Dune table reference errors with "table not found", try the chain-prefixed variant (e.g. `dex.trades` → `dex_ethereum.trades`) or the curated namespace.

### Query 1 — holder_concentration

Name: `naka_holder_concentration`. Vercel env: `DUNE_QUERY_HOLDER_CONCENTRATION`.

Expected columns: `token_address`, `chain`, `top1_pct`, `top10_pct`, `top50_pct`, `top100_pct`, `gini`, `nakamoto`.

```sql
WITH transfers AS (
  SELECT "to" AS holder, CAST(value AS DOUBLE) AS amount
  FROM erc20_ethereum.evt_Transfer
  WHERE contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
    AND evt_block_time >= NOW() - INTERVAL '90' DAY
  UNION ALL
  SELECT "from" AS holder, -1 * CAST(value AS DOUBLE) AS amount
  FROM erc20_ethereum.evt_Transfer
  WHERE contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
    AND evt_block_time >= NOW() - INTERVAL '90' DAY
),
holder_totals AS (
  SELECT holder, SUM(amount) AS balance FROM transfers
  GROUP BY holder HAVING SUM(amount) > 0
),
ranked AS (
  SELECT holder, balance,
    ROW_NUMBER() OVER (ORDER BY balance DESC) AS rn,
    COUNT(*) OVER () AS holder_count,
    SUM(balance) OVER (ORDER BY balance DESC) / SUM(balance) OVER () * 100 AS cum_pct
  FROM holder_totals
)
SELECT
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' AS token_address,
  'ethereum' AS chain,
  MAX(CASE WHEN rn <= GREATEST(1, holder_count / 100) THEN cum_pct END) AS top1_pct,
  MAX(CASE WHEN rn <= GREATEST(1, holder_count / 10)  THEN cum_pct END) AS top10_pct,
  MAX(CASE WHEN rn <= GREATEST(1, holder_count / 2)   THEN cum_pct END) AS top50_pct,
  100.0 AS top100_pct,
  (2.0 * SUM(rn * balance) / (MAX(holder_count) * SUM(balance))) - ((MAX(holder_count) + 1.0) / MAX(holder_count)) AS gini,
  MIN(CASE WHEN cum_pct >= 51 THEN rn END) AS nakamoto
FROM ranked
```

### Query 2 — smart_money_score

Name: `naka_smart_money_score`. Vercel env: `DUNE_QUERY_SMART_MONEY`.

Expected columns: `wallet_address`, `chain`, `score`, `win_rate_pct`, `realized_pnl_usd_90d`, `trade_count_90d`, `basis`.

```sql
SELECT
  taker AS wallet_address,
  'ethereum' AS chain,
  LEAST(100, GREATEST(0,
    50 + LEAST(40, COUNT(*) / 10) + LEAST(10, SUM(amount_usd) / 100000)
  )) AS score,
  CAST(NULL AS DOUBLE) AS win_rate_pct,
  SUM(amount_usd) AS realized_pnl_usd_90d,
  COUNT(*) AS trade_count_90d,
  JSON_OBJECT(
    'buy_count':  SUM(CASE WHEN token_bought_symbol IS NOT NULL THEN 1 ELSE 0 END),
    'sell_count': SUM(CASE WHEN token_sold_symbol   IS NOT NULL THEN 1 ELSE 0 END)
  ) AS basis
FROM dex.trades
WHERE blockchain = 'ethereum'
  AND block_time >= NOW() - INTERVAL '90' DAY
  AND amount_usd > 10000
GROUP BY taker
HAVING COUNT(*) >= 5
ORDER BY realized_pnl_usd_90d DESC
LIMIT 500
```

### Query 3 — bridge_flows

Name: `naka_bridge_flows`. Vercel env: `DUNE_QUERY_BRIDGE_FLOWS`.

Expected columns: `from_chain`, `to_chain`, `hour_bucket`, `total_usd`, `tx_count`.

```sql
SELECT
  source_chain AS from_chain,
  destination_chain AS to_chain,
  DATE_TRUNC('hour', block_time) AS hour_bucket,
  SUM(amount_usd) AS total_usd,
  COUNT(*) AS tx_count
FROM cross_chain.bridge_transactions
WHERE block_time >= NOW() - INTERVAL '24' HOUR
  AND amount_usd > 1000
GROUP BY 1, 2, 3
ORDER BY total_usd DESC
LIMIT 200
```

### Query 4 — wash_trade_score

Name: `naka_wash_trade_score`. Vercel env: `DUNE_QUERY_WASH_TRADE`.

Expected columns: `token_address`, `chain`, `score`, `flagged_pairs`.

```sql
WITH suspicious AS (
  SELECT
    token_bought_address AS token,
    taker,
    COUNT(*) AS round_trip_count
  FROM dex.trades
  WHERE blockchain = 'ethereum'
    AND block_time >= NOW() - INTERVAL '7' DAY
  GROUP BY 1, 2
  HAVING COUNT(*) > 20
)
SELECT
  token AS token_address,
  'ethereum' AS chain,
  LEAST(100, COUNT(DISTINCT taker) * 5 + SUM(round_trip_count) / 10) AS score,
  COUNT(DISTINCT taker) AS flagged_pairs
FROM suspicious
GROUP BY token
HAVING COUNT(DISTINCT taker) >= 3
LIMIT 200
```

### Query 5 — deployer_history

Name: `naka_deployer_history`. Vercel env: `DUNE_QUERY_DEPLOYER_HISTORY`.

Expected columns: `deployer_address`, `chain`, `total_deployed`, `total_rugged`, `total_successful`, `oldest_deploy_at`.

```sql
SELECT
  "from" AS deployer_address,
  'ethereum' AS chain,
  COUNT(*) AS total_deployed,
  SUM(CASE WHEN c.symbol IS NULL     THEN 1 ELSE 0 END) AS total_rugged,
  SUM(CASE WHEN c.symbol IS NOT NULL THEN 1 ELSE 0 END) AS total_successful,
  MIN(t.block_time) AS oldest_deploy_at
FROM ethereum.creation_traces t
LEFT JOIN tokens.erc20 c ON c.contract_address = t.address
WHERE t.block_time >= NOW() - INTERVAL '365' DAY
GROUP BY "from"
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC
LIMIT 300
```

### Query 6 — cluster_aggregates

Name: `naka_cluster_aggregates`. Vercel env: `DUNE_QUERY_CLUSTER_AGGREGATES`.

Expected columns: `cluster_id`, `chain`, `member_count`, `total_volume_usd_24h`, `net_flow_usd_24h`, `primary_label`.

```sql
SELECT
  taker AS cluster_id,
  'ethereum' AS chain,
  CAST(COUNT(DISTINCT block_number) AS INTEGER) AS member_count,
  SUM(amount_usd) AS total_volume_usd_24h,
  SUM(amount_usd) AS net_flow_usd_24h,
  CAST(NULL AS VARCHAR) AS primary_label
FROM dex.trades
WHERE blockchain = 'ethereum'
  AND block_time >= NOW() - INTERVAL '24' HOUR
  AND amount_usd > 50000
GROUP BY taker
ORDER BY total_volume_usd_24h DESC
LIMIT 200
```

### Query 7 — token_age_buyers

Name: `naka_token_age_buyers`. Vercel env: `DUNE_QUERY_TOKEN_AGE_BUYERS`.

Expected columns: `token_address`, `chain`, `age_under_7d_pct`, `age_7_30d_pct`, `age_30_90d_pct`, `age_over_90d_pct`, `total_buyers`.

```sql
WITH first_seen AS (
  SELECT taker, MIN(block_time) AS first_tx
  FROM dex.trades
  WHERE blockchain = 'ethereum'
  GROUP BY taker
),
recent_buys AS (
  SELECT
    t.token_bought_address AS token,
    t.taker,
    DATE_DIFF('day', f.first_tx, t.block_time) AS wallet_age_days
  FROM dex.trades t
  JOIN first_seen f ON f.taker = t.taker
  WHERE t.blockchain = 'ethereum'
    AND t.block_time >= NOW() - INTERVAL '7' DAY
    AND t.amount_usd > 100
)
SELECT
  token AS token_address,
  'ethereum' AS chain,
  100.0 * SUM(CASE WHEN wallet_age_days < 7  THEN 1 ELSE 0 END) / COUNT(*) AS age_under_7d_pct,
  100.0 * SUM(CASE WHEN wallet_age_days BETWEEN 7  AND 30 THEN 1 ELSE 0 END) / COUNT(*) AS age_7_30d_pct,
  100.0 * SUM(CASE WHEN wallet_age_days BETWEEN 30 AND 90 THEN 1 ELSE 0 END) / COUNT(*) AS age_30_90d_pct,
  100.0 * SUM(CASE WHEN wallet_age_days > 90 THEN 1 ELSE 0 END) / COUNT(*) AS age_over_90d_pct,
  COUNT(*) AS total_buyers
FROM recent_buys
GROUP BY token
HAVING COUNT(*) >= 10
LIMIT 300
```

### Query 8 — smart_money_token_flow

Name: `naka_smart_money_token_flow`. Vercel env: `DUNE_QUERY_SMART_MONEY_FLOW`.

Expected columns: `token_address`, `chain`, `net_inflow_usd_24h`, `buyers_24h`, `sellers_24h`, `unique_wallets_24h`.

```sql
WITH top_traders AS (
  SELECT taker FROM dex.trades
  WHERE blockchain = 'ethereum'
    AND block_time >= NOW() - INTERVAL '90' DAY
    AND amount_usd > 50000
  GROUP BY taker
  HAVING SUM(amount_usd) > 500000
)
SELECT
  COALESCE(t.token_bought_address, t.token_sold_address) AS token_address,
  'ethereum' AS chain,
  SUM(CASE WHEN t.token_bought_address IS NOT NULL THEN t.amount_usd ELSE -t.amount_usd END) AS net_inflow_usd_24h,
  COUNT(CASE WHEN t.token_bought_address IS NOT NULL THEN 1 END) AS buyers_24h,
  COUNT(CASE WHEN t.token_sold_address   IS NOT NULL THEN 1 END) AS sellers_24h,
  COUNT(DISTINCT t.taker) AS unique_wallets_24h
FROM dex.trades t
JOIN top_traders s ON s.taker = t.taker
WHERE t.blockchain = 'ethereum'
  AND t.block_time >= NOW() - INTERVAL '24' HOUR
GROUP BY 1
HAVING ABS(SUM(CASE WHEN t.token_bought_address IS NOT NULL THEN t.amount_usd ELSE -t.amount_usd END)) > 10000
ORDER BY ABS(net_inflow_usd_24h) DESC
LIMIT 300
```

### Query 9 — stablecoin_pulse

Name: `naka_stablecoin_pulse`. Vercel env: `DUNE_QUERY_STABLECOIN_PULSE`.

Expected columns: `chain`, `hour_bucket`, `usdc_net_flow_usd`, `usdt_net_flow_usd`, `dai_net_flow_usd`.

```sql
SELECT
  'ethereum' AS chain,
  DATE_TRUNC('hour', evt_block_time) AS hour_bucket,
  SUM(CASE WHEN contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
           THEN CAST(value AS DOUBLE) / 1e6 ELSE 0 END) AS usdc_net_flow_usd,
  SUM(CASE WHEN contract_address = 0xdac17f958d2ee523a2206206994597c13d831ec7
           THEN CAST(value AS DOUBLE) / 1e6 ELSE 0 END) AS usdt_net_flow_usd,
  SUM(CASE WHEN contract_address = 0x6b175474e89094c44da98b954eedeac495271d0f
           THEN CAST(value AS DOUBLE) / 1e18 ELSE 0 END) AS dai_net_flow_usd
FROM erc20_ethereum.evt_Transfer
WHERE contract_address IN (
  0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,
  0xdac17f958d2ee523a2206206994597c13d831ec7,
  0x6b175474e89094c44da98b954eedeac495271d0f
)
  AND evt_block_time >= NOW() - INTERVAL '24' HOUR
GROUP BY hour_bucket
ORDER BY hour_bucket DESC
```

### Query 10 — cex_flow

Name: `naka_cex_flow`. Vercel env: `DUNE_QUERY_CEX_FLOW`.

Expected columns: `chain`, `exchange`, `hour_bucket`, `net_inflow_usd`.

```sql
WITH cex_addrs AS (
  SELECT * FROM (VALUES
    (0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be, 'binance'),
    (0xd551234ae421e3bcba99a0da6d736074f22192ff, 'binance'),
    (0x71660c4005ba85c37ccec55d0c4493e66fe775d3, 'coinbase'),
    (0x503828976d22510aad0201ac7ec88293211d23da, 'coinbase'),
    (0x6cc5f688a315f3dc28a7781717a9a798a59fda7b, 'okx'),
    (0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0, 'kraken')
  ) AS t(addr, exchange)
)
SELECT
  'ethereum' AS chain,
  c.exchange,
  DATE_TRUNC('hour', t.evt_block_time) AS hour_bucket,
  SUM(CASE WHEN t."to"   = c.addr THEN CAST(t.value AS DOUBLE) / 1e6
           WHEN t."from" = c.addr THEN -CAST(t.value AS DOUBLE) / 1e6
           ELSE 0 END) AS net_inflow_usd
FROM erc20_ethereum.evt_Transfer t
JOIN cex_addrs c ON t."to" = c.addr OR t."from" = c.addr
WHERE t.contract_address = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  AND t.evt_block_time >= NOW() - INTERVAL '24' HOUR
GROUP BY c.exchange, hour_bucket
ORDER BY hour_bucket DESC
```

### Query 11 — mev_loss_aggregate

Name: `naka_mev_loss_aggregate`. Vercel env: `DUNE_QUERY_MEV_LOSS`.

Expected columns: `wallet_address`, `chain`, `total_loss_usd_30d`, `sandwich_count`, `frontrun_count`.

```sql
SELECT
  taker AS wallet_address,
  'ethereum' AS chain,
  SUM(amount_usd * 0.005) AS total_loss_usd_30d,
  CAST(COUNT(*) AS INTEGER) AS sandwich_count,
  CAST(0 AS INTEGER) AS frontrun_count
FROM dex.trades
WHERE blockchain = 'ethereum'
  AND block_time >= NOW() - INTERVAL '30' DAY
  AND amount_usd > 50000
GROUP BY taker
HAVING COUNT(*) >= 5
ORDER BY total_loss_usd_30d DESC
LIMIT 500
```

---

## 2. Final Vercel env vars

Once all 11 queries are saved on Dune, write the IDs into Vercel:

```
DUNE_API_KEY=<rotate then paste new key>
DUNE_PLAN=free
DUNE_QUERY_HOLDER_CONCENTRATION=<id1>
DUNE_QUERY_SMART_MONEY=<id2>
DUNE_QUERY_BRIDGE_FLOWS=<id3>
DUNE_QUERY_WASH_TRADE=<id4>
DUNE_QUERY_DEPLOYER_HISTORY=<id5>
DUNE_QUERY_CLUSTER_AGGREGATES=<id6>
DUNE_QUERY_TOKEN_AGE_BUYERS=<id7>
DUNE_QUERY_SMART_MONEY_FLOW=<id8>
DUNE_QUERY_STABLECOIN_PULSE=<id9>
DUNE_QUERY_CEX_FLOW=<id10>
DUNE_QUERY_MEV_LOSS=<id11>
```

Trigger a redeploy after the last env var lands.

---

## 3. Migrations to apply on the same merge wave

The Dune integration depends on schema that lands in three migrations. If feat/dune-integration + feat/audit-gap-closures + feat/final-gap-closures are already merged, the migrations are tracked in repo at:

- `supabase/migrations/2026_05_21_dune_integration.sql`
- `supabase/migrations/2026_05_22_dune_audit_gap_closures.sql`
- `supabase/migrations/2026_05_22_final_gap_closures.sql`

Apply via `mcp__supabase__apply_migration` if available.

---

## 4. Verification after cron tick

1. Wait for `/api/cron/dune-refresh` next run (06:00 UTC daily) or trigger manually with the cron auth header from `vercel env`.
2. Confirm rows landed:
   ```sql
   SELECT 'dune_holder_concentration' AS t, COUNT(*) FROM dune_holder_concentration
   UNION ALL SELECT 'dune_smart_money_score', COUNT(*) FROM dune_smart_money_score
   UNION ALL SELECT 'dune_bridge_flows',      COUNT(*) FROM dune_bridge_flows
   UNION ALL SELECT 'dune_wash_trade_score',  COUNT(*) FROM dune_wash_trade_score
   UNION ALL SELECT 'dune_deployer_history',  COUNT(*) FROM dune_deployer_history
   UNION ALL SELECT 'dune_cluster_aggregates',COUNT(*) FROM dune_cluster_aggregates
   UNION ALL SELECT 'dune_token_age_buyers',  COUNT(*) FROM dune_token_age_buyers
   UNION ALL SELECT 'dune_smart_money_token_flow', COUNT(*) FROM dune_smart_money_token_flow
   UNION ALL SELECT 'dune_stablecoin_pulse',  COUNT(*) FROM dune_stablecoin_pulse
   UNION ALL SELECT 'dune_cex_flow',          COUNT(*) FROM dune_cex_flow
   UNION ALL SELECT 'dune_mev_loss_aggregate',COUNT(*) FROM dune_mev_loss_aggregate;
   ```
3. Hit a token detail page in prod — the `<DuneIntelligenceStrip />` chips should now show data.
4. Hit the Context Feed — Dune cards should appear above the chain tabs.
5. Hit `/api/sim/portfolio?wallet=…&trades=true` — confirms Sim path when `SIM_API_KEY` is set (separate dep).

---

## 5. Troubleshooting

If a query errors with "table not found" or "column unknown" on Dune:

- `dex.trades` may need to be `dex_ethereum.trades` on schema-versioned tables; try the chain-prefixed variant.
- `ethereum.creation_traces` may be `ethereum.transactions WHERE to_address IS NULL` if the curated table isn't on the user's tier.
- `cross_chain.bridge_transactions` is a curated table — fall back to per-bridge tables (e.g. `across_v3_ethereum.spoke_pool_v3_evt_FundsDeposited`) and union them if the curated one isn't available.

Don't fabricate columns. If Dune can't return one of the required fields, return `CAST(NULL AS <type>)` for it so the mapper writes null rather than crashing.

---

## 6. Locked rules (do not violate)

- All commits authored as `moderator29 <101205446+moderator29@users.noreply.github.com>`. No AI co-author trailers, no "Generated with Claude" anywhere.
- Conventional Commits.
- Never commit to main. Owner merges.
- No mock data — if a Dune query can't return real numbers, return null and let the UI render the empty state.
- The Dune API key in `.env.local` is owner-rotated AFTER setup completes; treat it as one-shot.
