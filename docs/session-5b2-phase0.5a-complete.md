# Phase 0.5a — Complete

Four tasks shipped to `session-5b2-production`. Each committed separately.

| Task | Description | Commit |
| --- | --- | --- |
| 0.5a.1 | Profile role/tier_expires_at columns + test user set to max/admin | `31e86c2` |
| 0.5a.2 | Settings + Profile layout bug fixes | `343a8ab` |
| 0.5a.3 | VTX UI polish | `c7ad618` |
| 0.5a.4 | Tier gates (api + client + overlay) | (this commit) |

## Verified test user

`phantomfcalls@gmail.com`:
- tier = `max`
- role = `admin`
- tier_expires_at = 2036-04-18

All tier gates bypass automatically for this account.

## Shipped details

### 0.5a.2 — Layout
- `/app/settings/page.tsx`: flex-col on mobile, flex-row on md+, horizontal chip-scrolling nav. Added `min-w-0` to content. Expert Mode toggle now live (state + persisted).
- `/components/ProfileTab.tsx`: FAQ accordion replaced `max-h-96` clip with CSS `grid-rows-[0fr→1fr]` — FAQ answers of any length render fully.

### 0.5a.3 — VTX
- Rate limit counter removed from input area; surfaces only as a tooltip on the New Chat icon.
- Input upgraded to auto-expanding textarea. Enter sends, Shift+Enter = new line, max-height 240px then scrolls. Glassmorphism container with subtle focus glow.
- Send button removed.
- Keyboard hint: "Press Enter to send · Shift+Enter for new line".
- Placeholder: "Ask VTX about any token, wallet, or whale..."
- Welcome heading updated to "What do you need analyzed?"; 4 suggested prompt cards: whale moves, rugpull scan, trending narratives, analyze my portfolio.

### 0.5a.4 — Tier gates
New:
- `/lib/subscriptions/tierCheck.ts` — pure tier comparison helper.
- `/lib/subscriptions/apiTierGate.ts` — `withTierGate(tier, handler)` returning 403 `{error: 'upgrade_required', currentTier, requiredTier, expired}`.
- `/lib/subscriptions/serverTierCheck.ts` — `checkTierServer(tier)` for RSC layouts.
- `/components/tier/TierGateOverlay.tsx` — blurred preview + upgrade card.

API gates applied:
- `/api/whales` GET → `pro`
- `/api/whales/[address]` GET → `pro`
- `/api/whales/follow` POST + DELETE → `pro`
- `/api/clusters/[address]` GET → `pro`
- `/api/clusters/recent` GET → `pro`
- `/api/copy-trading/rules` GET + POST → `mini`
- `/api/copy-trading/rules/[id]` PATCH + DELETE → `mini`

Client gates applied:
- `/dashboard/whale-tracker/*` → pro (via new `layout.tsx`)
- `/dashboard/wallet-clusters/*` → pro (via new `layout.tsx`)

Admins bypass every gate.

## Known follow-ups

- Next 15 async-cookies migration is pending codebase-wide. My new files use the same synchronous `cookies()` pattern as the existing server client builder (25 RouteHandlerConfig warnings existed before these commits and remain unchanged). Resolving this is a separate refactor, not in scope for 0.5a.

## What's next

Chain 0.5b (Market unification + Portfolio) when user says "Start 0.5b".
