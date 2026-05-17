# Security Data Pipelines

The SecurityPanel on a token detail page renders three composite panels:

1. **TriangulationBadgeStack** — multi-source honeypot verdict.
2. **LpLockPanel** — locked-LP supply + soonest unlock + per-locker breakdown.
3. **DeployerHistoryPanel** — deployer wallet rug-history trust score.

Each is backed by a real server pipeline (no stubs). All three pipelines cache aggressively and degrade gracefully — if a source 500s, the panel hides instead of fabricating data.

## 1. Source triangulation

Path: `/api/security/triangulation?chain=...&token=...` → `lib/security/sourceFetchers.ts` + `lib/security/honeypotTriangulator.ts`.

### Sources

| Source | Auth | Chain coverage | Endpoint |
|---|---|---|---|
| GoPlus | Optional `GOPLUS_API_KEY` | EVM + Solana | `api.gopluslabs.io/api/v1/token_security/{chainId}` and `.../solana/token_security` |
| Honeypot.is | Public | EVM only | `api.honeypot.is/v2/IsHoneypot` |
| de.fi Scanner | Public | EVM only | `public-api.de.fi/v1/scanner/{chain}/{token}` |
| RugCheck | Public | Solana only | `api.rugcheck.xyz/v1/tokens/{token}/report` |

Each fetcher returns `{ verdict: 'honeypot' | 'safe' | 'unknown', raw: <full payload> }`. Failures (timeout / 500 / shape mismatch) → `unknown` so triangulation still works on the responding sources.

### Cache

`security_source_verdicts` (one row per chain × token × source). 6-hour TTL. The route reads cached rows first, fans out to stale or missing sources in parallel, upserts results, then runs `triangulateHoneypot` over the merged verdict map.

### Voting

`lib/security/honeypotTriangulator.ts` returns:

```ts
{
  honeypot: boolean,
  sourcesVoted: 0–4,
  sourcesAgreed: 0–4,
  confidence: 'high' | 'medium' | 'low',
  honeypotSources: string[],  // e.g. ['GoPlus', 'Honeypot.is']
  safeSources: string[],
}
```

Confidence rules:
- ≥3 sources voted **and** they're unanimous → `high`.
- ≥3 sources voted but split → `medium`.
- 2 sources voted → `medium` if both agree, `low` if split.
- 1 source voted → `low`.

The UI badge color tracks confidence + verdict (red high-conf honeypot vs amber low-conf, etc.). The panel hides entirely if `sourcesVoted === 0`.

## 2. LP lock

Path: derived inside `components/market/SecurityPanel.tsx` from the GoPlus `raw.lp_holders` payload that the existing `/api/security/scan` already returns.

EVM only — GoPlus's Solana response shape doesn't surface lock metadata the same way; the panel hides on Solana until a per-chain Solana lock fetcher exists.

For each `lp_holder` where `is_locked === '1'`:
- Map `tag` → `locker enum` (Team Finance / Unicrypt / PinkLock / other).
- For each entry in `locked_detail[]`, build an `LpLockRecord { locker, unlockAt: end_time, lpShare: amount-or-share }`.
- If `locked_detail` is absent, build a single record with a far-future `unlockAt` sentinel so it still counts as locked.

`lib/security/lpLockWindow.ts` aggregates the records into:
```ts
{ totalLockedPct, soonestUnlockAt, daysUntilUnlock, severity, byLocker[] }
```
Severity: `green` (≥80% locked AND ≥180d), `amber` (≥30d), `red` (<30d), `unknown` (no records).

## 3. Deployer history

Path: `/api/security/deployer-history?chain=...&token=...` → `lib/security/deployerHistoryFetcher.ts` + `lib/security/deployerRugHistory.ts`.

### EVM path

Uses Etherscan v2 unified API (`api.etherscan.io/v2/api?chainid={1|56|137|8453|42161|10|43114}`) — one endpoint covers all 7 EVM chains we support.

1. `getcontractcreation&contractaddresses={token}` → returns the deployer wallet.
2. `account/tokentx&address={deployer}&page=1&offset=200&sort=asc` → list every ERC-20 the deployer's first-touched (i.e. deployed reveal). Build a `DeployerToken[]` where each token's `deployedAtSec` is the timestamp of the first transfer.

Requires `ETHERSCAN_API_KEY` env var. Without the key, returns `{ available: false }` and the panel hides.

### Solana path

Uses Helius DAS (`mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}`).

1. `getAsset { id: token }` → returns `authorities[]` array. The update_authority (scope `full`) is the deployer.
2. `searchAssets { authorityAddress, tokenType: 'fungible', page: 1, limit: 100 }` → other tokens by the same authority.

Mint timestamps aren't in the DAS response — left as 0 for now (scoring handles missing timestamps via the flaggedAsRug path).

### Scoring

`lib/security/deployerRugHistory.ts` runs the scorer:
- A token is **dead** when current mcap < 5% of peak mcap (`DEAD_THRESHOLD_PCT = 0.05`).
- A token is a **fast death** when it dies within 7 days of deploy (`FAST_DEATH_WINDOW_SEC`).
- Score 0–100 based on dead-ratio, fast-death-ratio, and flagged count.
- Tier: clean / caution / risky / serial-rugger.

The route maps scorer.tier → panel.band: `clean` (most), `caution`, `dangerous` (was 'risky'), `serial-rugger` (unchanged), `pristine` (when totalDeployed ≤ 1).

### Cache

`deployer_history_cache` (chain × deployer_address unique). 24h TTL. Reads are bypassed by current route to always re-fetch fresh; switch to read-cache-first when traffic warrants by checking `fetched_at >= now() - 24h`.

## Cost containment

- Triangulation: 4 fetchers per stale token, all rate-limited by external upstream. The 6h cache holds the hit rate down to ~4 RPS per token even under heavy traffic.
- Deployer history: Etherscan v2 is 5 RPS free tier; Helius is generous for our usage. The 24h cache is the main lever.
- All fetches go through `safeFetch` w/ 8s timeout so a slow upstream can't tie up a Vercel function.

## Failure visibility

Panels hide silently when their pipeline returns no data — by design, the user should never see "Triangulation failed" because that erodes trust. Server-side, every panic gets logged through `lib/logger.ts` with `{ route, chain, token, src, err }` so we can monitor pipeline health in the Vercel dashboard.
