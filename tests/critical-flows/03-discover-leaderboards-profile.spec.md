# Critical flow 03 — Discover → leaderboards → profile

**Persona**: authenticated user.

**When** the user navigates to `/discover`.
**Then** all 8 leaderboards render their first row within 1s
(`leaderboard-tile` elements ≥ 8).

**When** the user clicks the top user in "Top Followers".
**Then** the browser navigates to `/u/<username>` and the profile loads
with name, avatar, followers count, success-rate badge.

**When** the network tab is filtered to `/api/social/*`.
**Then** the requests are scoped to that user_id — no over-fetching.

## Asserted invariants
- No leaderboards return empty when the seed dataset is populated.
- All leaderboard rows have `aria-label` describing the metric + value.
- Real-time refresh visible if a new follow is recorded mid-view.
