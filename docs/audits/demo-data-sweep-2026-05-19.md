# Demo / mock data sweep — 2026-05-19

Performed before public testing. Searches across all `.ts` / `.tsx`:

```bash
grep -rnE "mockData|fakeData|demoData|FAKE_|MOCK_|placeholder.*\.com|lorem|ipsum"
grep -rE "TODO.*mock|TODO.*demo|TODO.*fake|return\s*\[\s*\{[\s\S]{0,80}symbol:\s*['\"]MOCK"
grep -rE "function getMock|const mock\w*\s*=|sampleData|seedData|FAKE_TOKEN"
```

## Result

Zero remaining mock/demo data injected into UI. Earlier sessions already replaced every fake list with the corresponding real API call.

Only matches surfaced were:

- `placeholder="john@example.com"` on signup / login / forgot-password forms — legitimate placeholder UX, not data rendered to users.
- `placeholder="https://yoursite.com"` on builder-network submit form — same category.
- `placeholder="team@project.com"` on project-discovery submit form — same.
- `placeholder="https://twitter.com/… https://etherscan.io/…"` on whale-submit form — same.

## Live-API wiring confirmed across the surfaces called out in the public-testing prompt

| Surface | Live API | Source |
| --- | --- | --- |
| Dashboard market list | CoinGecko `/coins/markets` via `useMarketData` | `hooks/market/useMarketData.ts` |
| Top Gainers card | CoinGecko gainers + $1M floor | `app/api/dashboard/top-gainers/route.ts` |
| VTX TokenCard chart | DexScreener + CoinGecko OHLCV | `app/api/vtx/token-card/route.ts` |
| Wallet sparklines | DexScreener pair lookup | `app/api/wallet/sparkline/route.ts` |
| Token detail page | CoinGecko + DexScreener fusion | `app/api/market/token/[id]/route.ts` |
| Whale activity | Supabase `whale_activity` ingested from Alchemy / Helius webhooks | `app/api/whales/*` |
| Security scan | GoPlus / Honeypot.is | `lib/services/goplus.ts`, `lib/services/honeypot.ts` |
| Token Intelligence panel | Whale DB + Cluster graph + Anthropic thesis | `app/api/market/[address]/intelligence/route.ts` |
| Context Feed | Supabase ingestion pipeline | `app/api/context-feed/route.ts` |
| Trust score | Naka-proprietary 0-100 from contract verification + holders + liquidity | `components/trust/TrustScoreBadge.tsx` |
| NAKA chart | Mapped slug → real Uniswap pair via DexScreener | `app/api/market/token/[id]/chart/route.ts` |

## Empty-state contract verified

Per `CLAUDE.md` rules: "If the data is unavailable, return an empty state with an error, never fabricated numbers." Spot-checked the highest-traffic surfaces:

- `WhaleDetailPage` renders `'—'` via `fmtUsd(null)` when whale PnL / win-rate not yet backfilled.
- `WalletTokenRow` renders `'—'` for missing price.
- `TopGainersCard` shows the empty-state component when the API returns zero rows.
- `ContextFeed` shows its "No events yet" panel rather than seeding fake events.

No fabricated fallback values found.
