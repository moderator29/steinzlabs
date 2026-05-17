# Success Rate Algorithm

Source: `lib/reputation/scorer.ts`. Recomputed nightly by `/api/cron/recompute-reputation` (Vercel cron at 05:00 UTC daily).

## Composition

Five components, weighted 35 / 25 / 20 / 10 / 10:

| Weight | Component | Source data | Formula |
|---|---|---|---|
| 35% | Copy-trade win rate | `user_copy_trades` (closed in last 90d) | `wins / total_trades * 100`. Returns null if < 3 closed trades. |
| 25% | Whale-pick accuracy | `user_whale_follows` ∩ `whales.pnl_30d_usd` | `positive_pnl_whales / scored_whales * 100`. Returns null if no scored whales. |
| 20% | Portfolio performance | `swap_logs.pnl_usd` (last 30d) for user + population | Population percentile of user's 30d realized PnL. Returns null if user has no swap_logs in window. |
| 10% | Community score | `social_follows` (followers) − `user_reports` (resolved against user) | `min(100, round(75 * (1 - exp(-followers/60))))` then `max(0, base - resolved_reports*10)`. Returns null if no followers and no resolved reports. |
| 10% | Activity score | `feature_usage` (last 30d, count) | `min(100, round(count/30 * 100))`. Returns null only if `count` is null (RLS denial). |

## Renormalization

A user with sparse data shouldn't be penalized to near-zero just because they haven't copied a trade. `combineComponents` drops null components and renormalizes the remaining weights over the non-null axes:

```ts
const entries = activeComponents.map(c => ({ value: c.value, weight: c.weight }));
const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
const weighted = entries.reduce((s, e) => s + e.value * e.weight, 0);
return Math.round(weighted / totalWeight);
```

Edge cases:
- All five components null → returns the neutral default **50**.
- Single component → that component's value is the score (weight = 100%).

## Output

`scoreUser(userId)` returns:

```ts
{
  success_rate: 0–100,
  total_score: same as success_rate (kept distinct for future weighted boosters),
  components: { copy_trade_winrate, whale_pick_accuracy, portfolio_perf_pct, community_score, activity_score }
}
```

The cron upserts all six fields into `user_reputation` plus `last_calculated_at`. A post-pass orders `user_reputation` by `success_rate DESC` and writes `rank_overall` so leaderboards can sort cheaply.

## Display rules

- Hidden when the user has `show_success_rate = false`.
- Banded tones: ≥80 emerald, ≥60 blue, ≥40 amber, otherwise red.
- Component breakdown is **not** exposed publicly — only the composite score and the rank. The component breakdown is admin-only via `/admin/social-users?id=<uuid>` (which queries `user_reputation` directly).

## Why these weights

Industry benchmarks (Nansen's wallet rating, MEVX's trader score, Trojan's pnl badge): 60-70% trade-level performance, 20-30% behavioral signals, 10% activity. Steinz uses 55% trade performance (copy + portfolio) + 25% whale signal + 10% community + 10% activity — slightly heavier on social signal because the platform's differentiator is the social layer. Revisit weights quarterly using A/B tests on user retention.

## Failure modes

- **Etherscan rate-limit during whale PnL backfill** → `whales.pnl_30d_usd` stays stale → whale-pick accuracy shows null → component dropped, score still computed from the other four. Honest degradation.
- **swap_logs empty for user** → portfolio component null. If all four other components are also null → returns 50.
- **Population sample (5,000 rows)** has gaps for very-recently-joined users → percentile defaults to 100 (best). Documented quirk; intentional positive-bias for new users.

## When to recompute manually

Set `CRON_SECRET` and curl:

```
curl -H "x-cron-secret: $CRON_SECRET" https://<vercel-deployment>/api/cron/recompute-reputation
```

The route returns `{ scanned, succeeded, failed, ranked }` so you know the run was clean before checking the database.
