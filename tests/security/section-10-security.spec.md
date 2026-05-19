# Section 10 — security tests

Six assertions the production deployment must pass before any new
session arc begins. Each test is reproducible from `psql` + a logged-in
HTTP client.

## S1 — DM bodies are not decryptable server-side

**Setup**: Alice and Bob mutual-followed. Alice sends "hello" → row in
`social_messages` with `ciphertext`, `nonce`, no plaintext column.

**Test**: connect to Postgres with the `service_role` JWT (highest
server privilege). `SELECT ciphertext FROM social_messages WHERE
id = '<row>';` returns the ciphertext bytes. Decrypt attempt:
`libsodium.crypto_box_open_easy(ciphertext, nonce, sender_pub,
receiver_priv)` fails because `receiver_priv` is sealed to the recipient
device only (not stored server-side at all).

**Pass criteria**: zero rows of plaintext recoverable server-side.

## S2 — Blocked users genuinely cannot interact

**Setup**: Alice blocks Bob (`social_blocks` row).

**Test matrix** (Bob's session):
- `GET /api/search/users?q=alice` → Alice does not appear.
- `POST /api/social/follow {target_id: alice}` → 403 with
  `blocked_by_target`.
- `POST /api/social/dm {to: alice, body: '…'}` → 403 with
  `blocked_by_target`.
- `GET /u/alice` → 404 or "Profile unavailable" view, never the real
  profile content.

**Pass criteria**: all four endpoints refuse Bob's identity.

## S3 — Private follow requires explicit approval

**Setup**: Bob sets `profiles.is_private = true`.

**Test**: Alice `POST /api/social/follow {target_id: bob}` → 201 with
`status: 'pending'`. Bob's `/u/bob` shows the pending request row.
Until Bob `PATCH /api/social/follow/<id> {accept: true}`, Alice's view
of Bob is the public-only stub (no posts, no followers list).

**Pass criteria**: feed visibility is gated by accepted status server-
side, not just hidden client-side.

## S4 — RLS cross-user isolation

**Setup**: Alice and Bob each have `social_blocks` rows.

**Test**: Bob signed in (anon JWT) issues
`SELECT * FROM social_blocks WHERE blocker_id = '<alice uuid>';`
→ returns 0 rows. RLS policy `social_blocks_select_owner_only` filters
to `blocker_id = auth.uid()` only.

**Pass criteria**: Bob cannot enumerate Alice's block list, and vice
versa.

## S5 — Rate-limit kick-in thresholds

Hammer the endpoints from a single user:
- 31 follows in 60 seconds → 31st returns 429 with retry-after.
- 61 DMs in 60 seconds → 61st returns 429.
- 6 reports in 60 minutes → 6th returns 429.

The rate-limit middleware is the canonical Upstash sliding-window in
`lib/rateLimit/rateLimit.ts`. Confirm Sentry tags
`rate_limit_kick=true` for the rejected requests.

**Pass criteria**: all three thresholds reject the over-quota request
within the 60-second window and reset cleanly afterward.

## S6 — Reporter identity hidden from reported user

**Setup**: Alice reports Bob.

**Test**: Bob receives no email, push, or in-app notification revealing
"reported by Alice" (or any identifier resolvable to Alice). The
`/api/notifications?user_id=bob` payload omits the report event entirely
(it goes only to the admin queue).

**Pass criteria**: Bob's notification feed shows zero rows referring to
the report. The admin queue at `/admin/social-reports` shows the
reporter for moderation purposes only.

---

## Asserted invariants

- All six tests reproducible from a clean test DB seed.
- Each failure modes routes through the existing error UI (no 500s).
- Sentry breadcrumbs include the rejection reason + the route name.
