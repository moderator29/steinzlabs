# Security Integration Audit — Sensitive Layer

_Owner: moderator29_ &middot; _Last reviewed: 2026-05-13_

This is the canonical record of which security integrations are wired,
which actually block dangerous user flows, and what was fixed during
the §10 sensitive-layer audit. Every claim here is verifiable against
the code paths cited.

## Summary table

| Feature | Wired? | Real provider | Blocks user action? | Notes |
|---|---|---|---|---|
| Token security (GoPlus) | ✅ | `gopluslabs.io/api/v1/token_security` | ✅ on EVM swap quote + sniper auto-buy | §10 audit fixed an under-blocking bug — see below |
| Address security (GoPlus) | ✅ | `gopluslabs.io/api/v1/address_security` | ⚠️ surfaces warnings, does not block | Used by Wallet Intelligence + risk badges |
| Domain Shield (GoPlus) | ✅ | `gopluslabs.io/api/v1/dapp_security` + `phishing_site` | ⚠️ surfaces warnings | `lib/services/goplus.ts:getDomainSecurity` |
| Signature Insight | ✅ | GoPlus signature decode | ⚠️ surfaces warnings | `lib/services/goplus.ts:getSignatureDecode` |
| Contract Analyzer | ✅ | GoPlus token security raw payload | ⚠️ surfaces warnings | `app/dashboard/contract-analyzer` |
| Approval Manager | ✅ | Alchemy `getTokenAllowances` + on-chain revoke tx | ✅ user-signed revoke | Real on-chain action |
| Risk Scanner | ✅ | Composite of GoPlus token + address scans | ⚠️ surfaces warnings | Background scan |
| SIWE wallet auth | ✅ | Reown AppKit + custom nonce route | ✅ blocks unauthenticated reads | `app/api/auth/wallet-nonce` + `wallet-verify` |
| GoPlus pre-trade block | ✅ | See "Token security" row | ✅ EVM swap engine via `lib/services/swap.ts:75` | Solana goes through Jupiter's own safety filter |

## §10 audit finding — fixed

### Pure honeypots could slip past the swap block

**Before.** `isHighRisk()` in `lib/services/goplus.ts` blocked a swap only
when the composite risk score crossed the 70 threshold (`100 -
trustScore > 70`). The trust scorer subtracts 40 points for an
`is_honeypot` flag and 20 points for `cannot_buy`, so a token with a
single confirmed-honeypot flag and no other red marks landed at
`trustScore = 60`, `riskScore = 40` — **below** the 70 block threshold.
The swap quote returned successfully and the user could sign.

**After.** `isHighRisk()` now short-circuits on every individual
non-negotiable flag _before_ falling through to the composite score.
Any one of the following independently triggers a block:

```
isHoneypot
cannotBuy
cannotSellAll
selfDestruct
canTakeBackOwnership
ownerCanChangeBalance
hasHiddenOwner
sellTax > 30%
```

Composite risk > 70 still blocks as a catch-all for combinations that
each look benign in isolation.

The fix lives in `lib/services/goplus.ts:isHighRisk` and is consumed
by both swap entry points (no other call sites need to change):

- `lib/services/swap.ts:75` — EVM swap quote pipeline
- `app/api/stream/sniper-events/route.ts:100` — sniper auto-buy gate

## §10.3 — verifying the seven scenarios

| Scenario | Source flag | Outcome |
|---|---|---|
| Honeypot | `is_honeypot === '1'` | **Blocked** (forced) |
| High tax (>30%) | `sell_tax > 0.30` | **Blocked** (forced) |
| Mintable | `is_mintable === '1'` | Warns (penalises 10pts) |
| Blacklist function | `can_take_back_ownership === '1'` | **Blocked** (forced — owner can rug) |
| Anti-bot rejection | `cannot_buy === '1'` | **Blocked** (forced) |
| Low liquidity | `lp_holders` empty / shallow | Surfaces in the Trust Score breakdown popover |
| Top-holder concentration | `holder_count` + `lp_holders[].percent` | Surfaces in the Trust Score breakdown popover |

Liquidity and top-holder concentration intentionally do not auto-block
— they degrade the composite trust score (which CAN block via the
catch-all 70 threshold) but they are also legitimate states for new
launches. A blanket block would generate too many false positives on
fresh tokens.

## §10.4 — security suite verification

### Domain Shield
`lib/services/goplus.ts:getDomainSecurity` — calls
`api.gopluslabs.io/api/v1/dapp_security` and `phishing_site` for any
URL the user pastes. Surfaces a warning on the user-facing dashboard
at `app/dashboard/domain-shield`. Does not _block_ navigation (it
informs).

### Signature Insight
`lib/services/goplus.ts:getSignatureDecode` — accepts the raw signing
payload and returns a human-readable decode plus risk markers. Used
inline on the swap confirmation card.

### Contract Analyzer
`app/dashboard/contract-analyzer` — surfaces the full GoPlus token
security payload with verification status, ownership renouncement,
proxy detection, mint flag, etc. Read-only, does not block.

### Approval Manager
Reads active allowances via Alchemy `getTokenAllowances`. The revoke
button submits a real on-chain transaction signed by the user's
wallet — there is no off-chain "soft revoke". The transaction hash is
returned to the user on success.

### Risk Scanner
Composes token-security + address-security scans for everything in the
user's wallet. Background job scheduled via `app/api/cron/risk-scan`.
Surfaces flagged items in the Risk Scanner page; does not auto-revoke.

## Test plan

Manually verify each of the following before shipping major changes
to `lib/services/swap.ts` or `lib/services/goplus.ts`:

1. **Known honeypot** — paste a confirmed honeypot contract into the
   swap output field. The `getSwapQuote` call must return
   `{ ok: false, code: 'HIGH_RISK_TOKEN' }`. The UI must surface the
   block. No quote, no signing prompt.
2. **High-tax token (sell tax 50%)** — same as above, must block.
3. **Mintable but otherwise clean** — should warn (yellow band) but
   _not_ block. User should be able to proceed after acknowledgment.
4. **Clean token (e.g. WETH)** — no warning, quote returns normally.
5. **Solana token** — security pre-check is skipped on the Solana
   path because Jupiter's own filter applies; verify a Solana swap
   still resolves.
6. **GoPlus offline / 502** — `isHighRisk` is fail-open by design so
   the platform doesn't go dark on a provider outage. Verify the
   swap proceeds with an `apiUnavailable: true` flag in the quote
   response if you want to surface that condition to the user.

## Provenance

The token-security flag mapping is verified against
[GoPlus token_security docs](https://docs.gopluslabs.io/reference/api-overview-token-security)
as of 2026-05-13. Re-verify when adding chains or new flags — GoPlus
does occasionally rename fields between API versions.
