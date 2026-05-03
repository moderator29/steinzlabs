# Performance Baseline — 2026-05-02

The §7.3 deliverable: capture a performance snapshot to compare future regressions against.

This file is a **template + capture instructions** rather than a one-shot measurement. Performance numbers from local dev environments are noisy; the canonical baseline should be captured against the production deploy on `nakalabs.xyz` and committed verbatim. Re-capture on every major release.

---

## How to capture

### 1. Lighthouse — per major page

Run from a stable connection in incognito Chrome on a desktop with no other heavy tabs:

```bash
npx lighthouse https://nakalabs.xyz/                  --output html --output-path /tmp/lh-landing.html       --view
npx lighthouse https://nakalabs.xyz/dashboard         --output html --output-path /tmp/lh-dashboard.html     --view
npx lighthouse https://nakalabs.xyz/dashboard/market  --output html --output-path /tmp/lh-market.html        --view
npx lighthouse https://nakalabs.xyz/dashboard/swap    --output html --output-path /tmp/lh-swap.html          --view
npx lighthouse https://nakalabs.xyz/dashboard/whales  --output html --output-path /tmp/lh-whales.html        --view
npx lighthouse https://nakalabs.xyz/dashboard/vtx-ai  --output html --output-path /tmp/lh-vtx.html           --view
npx lighthouse https://nakalabs.xyz/dashboard/sniper  --output html --output-path /tmp/lh-sniper.html        --view
```

Capture into the table below: **Performance / Accessibility / Best Practices / SEO / PWA**, each 0-100.

### 2. Bundle analysis

```bash
ANALYZE=true npm run build
# opens an interactive treemap; record First Load JS for each route
```

Capture per-route First Load JS (kB) and identify the largest chunks.

### 3. DB query performance

In Supabase Dashboard → Database → Performance:
- Capture top 10 slowest queries (avg ms).
- Capture top 10 most-called queries (calls/min).
- Capture index usage ratios.

### 4. API response times

In Vercel → Project → Analytics → Functions:
- Capture p50 / p95 / p99 latency for each `/api/*` route.

In Sentry → Performance:
- Capture transaction sample for top 10 user-facing flows.

---

## Targets (commit when baseline captured)

| Metric | Target | Captured |
|--------|--------|----------|
| Lighthouse Performance (landing) | ≥ 90 | _to be filled_ |
| Lighthouse Performance (dashboard) | ≥ 80 | |
| Lighthouse Accessibility (every page) | ≥ 95 (WCAG AAA target per project rules) | |
| Lighthouse Best Practices | ≥ 95 | |
| First Load JS (landing) | ≤ 200 kB | |
| First Load JS (dashboard pages) | ≤ 250 kB | |
| Cold-start p99 (`/api/*`) | ≤ 1500 ms | |
| Warm p95 (`/api/whales`) | ≤ 300 ms | |
| Warm p95 (`/api/vtx-ai`) | ≤ 8000 ms (model latency dominates) | |
| Avg DB query latency | ≤ 50 ms | |
| 99th percentile DB query | ≤ 500 ms | |

## Known performance characteristics (audit-derived)

These are observations from the §1 12-agent audit and the supabase-architecture review, captured here so future perf work has a starting point:

- **Whale activity feed** (`whale_activity` — 36,881 rows live): SSE stream at `/api/whale-activity/stream` is the user-visible surface. The hot path uses an indexed `(chain, detected_at DESC)` lookup; cold start dominates.
- **VTX cache hit rate**: prompt cache breakpoints on system + tools. Hit rate target ≥ 70% on second-and-later turns within a 5-minute window. Below that suggests the cache_control fix from `2baf0c8` regressed.
- **Cluster compute** (5 algorithms over `wallet_edges` — 18k+ rows): first-time cluster takes 30–60s; cached afterward. The cache hit ratio in `cluster_cache` should be tracked.
- **Largest pages**: `/dashboard/vtx-ai` and `/dashboard/wallet-clusters` are the heaviest by bundle size — both have heavy chart / D3 deps. They are dynamic-imported lazily; verify lazy-load is still firing.
- **Cron throughput**: `cron_execution_log` has 7,869 rows live. p95 cron run time should stay under 30s; longer suggests a job is dragging.

## When to re-capture

- After any major Next.js bump (recently 15 → 16).
- After landing any feature that adds > 50 kB to a route.
- After a Lighthouse Performance score drop ≥ 5 points reported in CI.
- Quarterly even if nothing else triggers.

## See also

- [architecture.md](./architecture.md) — system architecture
- [supabase-architecture.md](./supabase-architecture.md) — DB schema + index inventory
- [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) — known perf-relevant items
