# Critical flows 04 – 20 — remaining Section-10 scenarios

Flows 01-03 each have their own file because their setup is non-trivial.
Flows 04-20 share a common 2-user setup so they're batched here.

## Common setup

Two pre-seeded accounts in the test environment:
- `alice@test.naka` — public profile, has a wallet, holds NAKA above the
  cult threshold.
- `bob@test.naka` — public profile, no wallet, below cult threshold.

Both have `onboarding_completed_at` set. Use Playwright contexts so each
flow gets isolated cookies.

---

## 04 — Follow another profile

When Alice opens Bob's `/u/bob` and clicks "Follow", the button toggles
to "Following", Bob's followers count increments by 1, and
`social_follows` has a new row `(alice→bob)`.

## 05 — Unfollow from own Following list

Alice opens her own `/u/alice`, clicks the Following container, sees Bob
in the list, clicks the unfollow icon. List row disappears with a fade,
Bob's followers count decrements, `social_follows` row removed.

## 06 — Followers container renders

Alice's `/u/alice` → click "Followers". The list paginates 50/page and
the "Load more" button is visible when there's a next page.

## 07 — Autocomplete user search

Type "bo" into the global search box → autocomplete shows bob within
300ms. Clicking the result opens `/u/bob`.

## 08 — Bottom-nav Find opens discover

Tap the "Find" tab in the bottom nav → `/discover` loads.

## 09 — DM gated by mutual

Alice opens Bob's profile. Mutual follow is false. The Message button
is `aria-disabled="true"` with a tooltip explaining the gate.

## 10 — Mutual follow unlocks DM

Bob follows Alice back. Alice opens Bob's profile → Message button is
enabled. Click opens `/messages?to=bob`.

## 11 — Send encrypted DM end-to-end

Alice sends "hello bob" → message renders optimistically, encrypted via
libsodium client-side, the API returns 201 with `social_messages.id`,
Bob's session realtime-subscribes and the message lands within 500ms.
Bob marks it read → `read_at` populates server-side.

## 12 — Block user

Alice blocks Bob from his profile. Bob can no longer DM Alice, doesn't
appear in Alice's search results, can't see Alice's profile, and the
follow state for both sides is hard-reset. `social_blocks` row created.

## 13 — Private account follow approval

Bob sets account to private (`profiles.is_private = true`). Alice
follows Bob → `social_follows` row has `status='pending'`. Bob sees the
pending request, approves it → `status='accepted'` and Alice's UI
updates within 1s via realtime.

## 14 — Report user surfaces in admin

Alice reports Bob with reason "spam". `/admin/social-reports` shows the
report under Bob's row within 30s. Reporter (Alice) is never visible to
Bob (RLS check: select on social_reports as Bob returns 0 rows).

## 15 — Audit tracker shows findings

`/admin/audit-tracker` renders the agent audit findings with filter
chips by agent + severity. Drill-in shows the file:line refs.

## 16 — Profile containers 4 + 5

Alice's `/u/alice` renders containers Followers (#4) and Following (#5)
with correct counts and clickable rows.

## 17 — Followers/Following pagination

When followers > 50, "Load more" appears, fetches the next page, appends
without re-fetching prior rows, scroll position preserved.

## 18 — Success-rate badge after cron

Trigger `/api/cron/recompute-reputation` manually (CRON_SECRET header).
Alice's `profiles.success_rate` updates within the cron's run time.
Her profile badge re-renders with the new value on next page load.

## 19 — Real-time leaderboard refresh

While on `/discover`, an external event bumps a row's metric. The
leaderboard updates the row position within 2s via realtime subscription
without a full page refresh.

## 20 — Mobile responsive at every breakpoint

Every page above renders correctly at 375 / 393 / 412 / 768 / 1024 /
1440 / 1920. Specific gotchas: launchpad grid is `grid-cols-2
sm:grid-cols-4`, portfolio donut h-64 has the `md:h-80` breakpoint, no
horizontal scroll at 375.

---

## Common asserted invariants

- No console errors / warnings on any of the 20 flows.
- Every fetch in the network tab returns 200 or 304.
- Sentry breadcrumbs include the route name + user_id (never PII).
- WCAG AAA: no element below 7:1 (normal text) / 4.5:1 (large text).
- No `console.log` reaches production output.
- Animation respects `prefers-reduced-motion`.
