# Multi-chain Dune queries (wash / MEV / cluster / smart-money)

These replace the current Ethereum-only Dune queries so the four Dune-backed
surfaces show **all chains**. Each query:

- emits **exactly** the columns the ingestion mapper in
  `app/api/cron/dune-refresh/route.ts` reads (nothing else needed),
- outputs a `chain` column already normalized to our canonical names
  (`ethereum`, `bsc`, `polygon`, `arbitrum`, `optimism`, `base`, `avalanche`),
  so no code change is required,
- rides Dune's cross-chain `dex.trades` spellbook (one row per DEX trade across
  every EVM chain), so widening chains costs no extra query — just a wider
  `blockchain IN (...)`.

## How to deploy

1. Open **dune.com** → New query → paste one block below → **Run** and confirm
   the columns/data look right (Dune's editor validates syntax + shows rows).
2. **Save** the query → copy its numeric **query ID** from the URL
   (`dune.com/queries/<ID>`).
3. In **Vercel → Settings → Environment Variables**, set the matching env var to
   that ID (Production + Preview), then redeploy:

   | Surface           | Table                     | Env var                      |
   |-------------------|---------------------------|------------------------------|
   | Wash Trade Radar  | `dune_wash_trade_score`   | `DUNE_QUERY_WASH_TRADE`      |
   | MEV Radar         | `dune_mev_loss_aggregate` | `DUNE_QUERY_MEV_LOSS`        |
   | Cluster Radar     | `dune_cluster_aggregates` | `DUNE_QUERY_CLUSTER_AGGREGATES` |
   | Smart-Money Score | `dune_smart_money_score`  | `DUNE_QUERY_SMART_MONEY`     |
   | (bonus) SM Flow   | `dune_smart_money_token_flow` | `DUNE_QUERY_SMART_MONEY_FLOW` |

4. The `dune-refresh` cron picks them up on its next run and upserts all chains.

> Note: these are **drafts** — validate each in Dune's editor before wiring the
> ID (per our data rule, never publish an unverified query). `dex.trades` is the
> maintained cross-chain DEX spellbook; column names below match its current
> schema (`blockchain, block_time, taker, token_bought_address,
> token_sold_address, amount_usd, tx_hash`). Solana is **not** in the EVM
> `dex.trades`; a Solana union via `dex_solana.trades` is noted at the end.

---

## 1) Smart-Money Score → `dune_smart_money_score`

Columns required: `wallet_address, chain, score, win_rate_pct,
realized_pnl_usd_90d, trade_count_90d, basis` (json).

`realized_pnl` here is a **cash-flow P&L** (USD received on sells − USD paid on
buys) over 90 days — a robust, transparent proxy, not FIFO lot matching.

```sql
WITH legs AS (
  SELECT blockchain, taker AS wallet, tx_hash,
         token_bought_address AS token, amount_usd AS usd, 1 AS is_buy, 0 AS is_sell
  FROM dex.trades
  WHERE block_time > now() - interval '90' day
    AND taker IS NOT NULL
    AND amount_usd BETWEEN 1 AND 50000000
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
  UNION ALL
  SELECT blockchain, taker AS wallet, tx_hash,
         token_sold_address AS token, amount_usd AS usd, 0 AS is_buy, 1 AS is_sell
  FROM dex.trades
  WHERE block_time > now() - interval '90' day
    AND taker IS NOT NULL
    AND amount_usd BETWEEN 1 AND 50000000
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
),
per_token AS (
  SELECT blockchain, wallet, token,
         SUM(usd * is_sell) - SUM(usd * is_buy) AS net_usd,
         SUM(usd) AS gross_usd
  FROM legs GROUP BY 1,2,3
),
per_wallet AS (
  SELECT blockchain, wallet,
         SUM(net_usd) AS realized_pnl_usd_90d,
         COUNT(*) AS token_positions,
         SUM(CASE WHEN net_usd > 0 THEN 1 ELSE 0 END) AS winners,
         SUM(gross_usd) AS volume_usd_90d
  FROM per_token GROUP BY 1,2
),
trades90 AS (
  SELECT blockchain, taker AS wallet, COUNT(DISTINCT tx_hash) AS trade_count_90d
  FROM dex.trades
  WHERE block_time > now() - interval '90' day AND taker IS NOT NULL
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
  GROUP BY 1,2
)
SELECT
  CASE w.blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE w.blockchain END AS chain,
  w.wallet AS wallet_address,
  CAST(LEAST(100, GREATEST(0,
      40 * (CASE WHEN w.realized_pnl_usd_90d > 0 THEN LEAST(1, ln(1 + w.realized_pnl_usd_90d) / ln(1 + 1000000)) ELSE 0 END)
    + 35 * (CAST(w.winners AS double) / NULLIF(w.token_positions, 0))
    + 25 * LEAST(1, ln(1 + t.trade_count_90d) / ln(1 + 500))
  )) AS integer) AS score,
  ROUND(100.0 * w.winners / NULLIF(w.token_positions, 0), 1) AS win_rate_pct,
  ROUND(w.realized_pnl_usd_90d, 0) AS realized_pnl_usd_90d,
  t.trade_count_90d,
  JSON_OBJECT('volume_usd_90d' VALUE ROUND(w.volume_usd_90d, 0), 'token_positions' VALUE w.token_positions) AS basis
FROM per_wallet w
JOIN trades90 t ON t.blockchain = w.blockchain AND t.wallet = w.wallet
WHERE w.volume_usd_90d > 50000 AND t.trade_count_90d >= 10
ORDER BY score DESC
LIMIT 2000
```

---

## 2) Smart-Money Token Flow → `dune_smart_money_token_flow`

Columns: `token_address, chain, net_inflow_usd_24h, buyers_24h, sellers_24h,
unique_wallets_24h`. Feeds Wash Radar's inflow sort + Token X-Ray. "Smart money"
= wallets with real 90d size (reuse the score's population, inline here as a
volume floor so this query is standalone).

```sql
WITH sm AS (   -- wallets that traded >= $100k over 90d = "smart money" proxy
  SELECT blockchain, taker AS wallet
  FROM dex.trades
  WHERE block_time > now() - interval '90' day AND taker IS NOT NULL
    AND amount_usd BETWEEN 1 AND 50000000
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
  GROUP BY 1,2 HAVING SUM(amount_usd) > 100000
),
flows AS (
  SELECT t.blockchain, t.token_bought_address AS token, t.taker AS wallet,
         t.amount_usd AS inflow, 0 AS outflow, 1 AS is_buyer, 0 AS is_seller
  FROM dex.trades t JOIN sm ON sm.blockchain = t.blockchain AND sm.wallet = t.taker
  WHERE t.block_time > now() - interval '24' hour AND t.amount_usd BETWEEN 1 AND 50000000
  UNION ALL
  SELECT t.blockchain, t.token_sold_address AS token, t.taker AS wallet,
         0 AS inflow, t.amount_usd AS outflow, 0 AS is_buyer, 1 AS is_seller
  FROM dex.trades t JOIN sm ON sm.blockchain = t.blockchain AND sm.wallet = t.taker
  WHERE t.block_time > now() - interval '24' hour AND t.amount_usd BETWEEN 1 AND 50000000
)
SELECT
  CASE blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE blockchain END AS chain,
  token AS token_address,
  ROUND(SUM(inflow) - SUM(outflow), 0) AS net_inflow_usd_24h,
  COUNT(DISTINCT CASE WHEN is_buyer = 1 THEN wallet END) AS buyers_24h,
  COUNT(DISTINCT CASE WHEN is_seller = 1 THEN wallet END) AS sellers_24h,
  COUNT(DISTINCT wallet) AS unique_wallets_24h
FROM flows
WHERE token IS NOT NULL
GROUP BY 1,2
HAVING COUNT(DISTINCT wallet) >= 3
ORDER BY net_inflow_usd_24h DESC
LIMIT 3000
```

---

## 3) Wash-Trade Score → `dune_wash_trade_score`

Columns: `token_address, chain, score, flagged_pairs`. `score` is a
**cleanliness** score 0–100 (the app grades ≥80 clean, ≥50 caution, else wash),
so we compute a wash-risk ratio and invert it. Wash signal = share of a token's
24h volume that comes from wallets round-tripping (buying *and* selling the same
token many times) — the classic self-trade churn pattern.

```sql
WITH t24 AS (
  SELECT blockchain, tx_hash, taker AS wallet, amount_usd,
         token_bought_address AS tok_buy, token_sold_address AS tok_sell
  FROM dex.trades
  WHERE block_time > now() - interval '24' hour
    AND taker IS NOT NULL AND amount_usd BETWEEN 1 AND 50000000
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
),
tok_wallet AS (   -- per token+wallet: did they both buy and sell, how much volume
  SELECT blockchain, token, wallet,
         SUM(buy_usd) AS buy_usd, SUM(sell_usd) AS sell_usd,
         COUNT(*) AS legs
  FROM (
    SELECT blockchain, tok_buy AS token, wallet, amount_usd AS buy_usd, 0 AS sell_usd FROM t24
    UNION ALL
    SELECT blockchain, tok_sell AS token, wallet, 0 AS buy_usd, amount_usd AS sell_usd FROM t24
  ) x
  WHERE token IS NOT NULL
  GROUP BY 1,2,3
),
tok AS (
  SELECT blockchain, token,
         SUM(buy_usd + sell_usd) AS total_usd,
         -- wash-suspect volume: wallets that both bought & sold (round-trippers)
         SUM(CASE WHEN buy_usd > 0 AND sell_usd > 0 THEN (buy_usd + sell_usd) ELSE 0 END) AS churn_usd,
         COUNT(DISTINCT CASE WHEN buy_usd > 0 AND sell_usd > 0 AND legs >= 4 THEN wallet END) AS flagged_pairs
  FROM tok_wallet GROUP BY 1,2
)
SELECT
  CASE blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE blockchain END AS chain,
  token AS token_address,
  CAST(GREATEST(0, LEAST(100, 100 - 100.0 * churn_usd / NULLIF(total_usd, 0))) AS integer) AS score,
  flagged_pairs
FROM tok
WHERE total_usd > 25000
ORDER BY score ASC   -- washiest first
LIMIT 3000
```

---

## 4) Cluster Aggregates → `dune_cluster_aggregates`

Columns: `cluster_id, chain, member_count, total_volume_usd_24h,
net_flow_usd_24h, primary_label`. A true graph-clustering job is heavy for
Dune; a solid, honest proxy is **funding clusters** — wallets grouped by the
address that funded them (same funder ⇒ likely one operator). Here we cluster by
each token's set of counterparties per chain as `cluster_id = chain||':'||token`
and aggregate the smart-money activity around it. Swap in a funder-based
clustering later if you publish one.

```sql
WITH sm AS (
  SELECT blockchain, taker AS wallet
  FROM dex.trades
  WHERE block_time > now() - interval '90' day AND taker IS NOT NULL
    AND amount_usd BETWEEN 1 AND 50000000
    AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
  GROUP BY 1,2 HAVING SUM(amount_usd) > 100000
),
c AS (
  SELECT t.blockchain, t.token_bought_address AS token, t.taker AS wallet,
         t.amount_usd AS inflow, 0 AS outflow
  FROM dex.trades t JOIN sm ON sm.blockchain = t.blockchain AND sm.wallet = t.taker
  WHERE t.block_time > now() - interval '24' hour AND t.amount_usd BETWEEN 1 AND 50000000
  UNION ALL
  SELECT t.blockchain, t.token_sold_address, t.taker, 0, t.amount_usd
  FROM dex.trades t JOIN sm ON sm.blockchain = t.blockchain AND sm.wallet = t.taker
  WHERE t.block_time > now() - interval '24' hour AND t.amount_usd BETWEEN 1 AND 50000000
)
SELECT
  CASE blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE blockchain END AS chain,
  concat(
    CASE blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE blockchain END,
    ':', token) AS cluster_id,
  COUNT(DISTINCT wallet) AS member_count,
  ROUND(SUM(inflow + outflow), 0) AS total_volume_usd_24h,
  ROUND(SUM(inflow) - SUM(outflow), 0) AS net_flow_usd_24h,
  CAST(NULL AS varchar) AS primary_label
FROM c
WHERE token IS NOT NULL
GROUP BY 1,2
HAVING COUNT(DISTINCT wallet) >= 4        -- real cluster only
ORDER BY total_volume_usd_24h DESC
LIMIT 2000
```

---

## 5) MEV Loss Aggregate → `dune_mev_loss_aggregate`

Columns: `wallet_address, chain, total_loss_usd_30d, sandwich_count,
frontrun_count`. **This one needs a real MEV dataset** — sandwich attribution
can't be derived from `dex.trades` alone (it needs same-block ordering of
attacker↔victim↔attacker). Two options:

- **Preferred:** Dune's community MEV spellbook. If `dex.sandwiches` (or
  `mev.sandwiched` / a maintained community table) is available in your Dune
  plan, use the query below and map its columns. Verify the table name in Dune's
  data explorer first — MEV spellbook names change.
- **Fallback:** keep MEV Radar Ethereum-only (its current state) until a
  cross-chain sandwich table exists, since a fabricated MEV number is worse than
  an honest ETH-only board.

Draft against a sandwich spellbook shaped `(blockchain, block_time,
victim, amount_usd)`:

```sql
-- Validate the source table name in Dune first (dex.sandwiches may be
-- 'sandwiches', 'mev.sandwiches', or a community dataset in your plan).
SELECT
  CASE blockchain WHEN 'bnb' THEN 'bsc' WHEN 'avalanche_c' THEN 'avalanche' ELSE blockchain END AS chain,
  victim AS wallet_address,
  ROUND(SUM(amount_usd), 0) AS total_loss_usd_30d,
  COUNT(*) AS sandwich_count,
  0 AS frontrun_count            -- populate if the source distinguishes frontruns
FROM dex.sandwiches
WHERE block_time > now() - interval '30' day
  AND victim IS NOT NULL AND amount_usd > 0
  AND blockchain IN ('ethereum','bnb','polygon','arbitrum','optimism','base','avalanche_c')
GROUP BY 1,2
ORDER BY total_loss_usd_30d DESC
LIMIT 2000
```

---

## Adding Solana

`dex.trades` is EVM-only. To include Solana, `UNION ALL` a Solana leg from
`dex_solana.trades` (schema: `block_time, trader_id, token_bought_mint_address,
token_sold_mint_address, amount_usd, tx_id`) with `'solana' AS chain`, mapping
`trader_id → wallet`, `*_mint_address → token`, `tx_id → tx_hash`. Keep it a
separate CTE and union at the end so the EVM path stays untouched. Validate
`dex_solana.trades` availability in your Dune plan before wiring.
