# Social Moderation — Admin Guide

The social layer adds four admin surfaces. All require an admin role (or the static `ADMIN_BEARER_TOKEN` env var) and use the existing `verifyAdminRequest` gate.

## `/admin/social-reports`

The moderator queue. Filter by status (pending / resolved / dismissed / all) + category (spam / harassment / scam / impersonation / other). Each row shows:

- Reporter username + avatar (or "unknown" if their account was deleted).
- Reported user username + avatar.
- Category badge + status badge.
- Reason text (raw, what the reporter wrote — up to 2,000 chars).
- Admin notes (if previously resolved).

Per-row actions:
- **Resolve** — mark `status = 'resolved'`, set `resolved_at = now()`, log to `admin_audit_log`. The reporting user sees no notification (deliberate — protects the reporter from retaliation if the report was against a vindictive user).
- **Dismiss** — same as resolve but `status = 'dismissed'`. Use when the report is invalid (mass-reported, etc.).

Add admin notes via the dialog if the resolution needs context for the next moderator to read.

## `/admin/social-block-analytics`

Aggregates `social_blocks` and `social_mutes` to surface:
- **Most-blocked users** (top 20) — strong signal of bad actors. A user with 50+ blocks is almost always either a scammer, a serial harasser, or a botnet target. Investigate before banning; check their activity in `/admin/social-users?id=<their-uuid>`.
- **Most-muted users** (top 20) — softer signal; usually just annoying rather than malicious. Don't auto-suspend on mute count alone.

Counts are computed via client-side aggregation right now (`/api/admin/social/block-analytics`). When `social_blocks` exceeds ~10k rows, swap to a Postgres RPC for performance.

## `/admin/social-users`

Per-user social activity dump. Paste a profile UUID (you can grab it from a `/u/<username>` URL by inspecting the request to `/api/social/profile/<username>` in devtools, or from any `admin_audit_log` row).

Surfaces:
- **Profile basics** — username, role, joined date, suspended-until date if any.
- **Counts** — followers, following, blocks made, blocks against, mutes against, reports filed, reports against, DMs sent, follows in last 24h.
- **Suspicious-activity flags** — computed inline:
  - "High follow velocity: 50+ in last 24h" → likely follow-farming bot.
  - "Blocked by 10+ users" → likely abusive content.
  - "3+ reports filed against" → escalate to deeper review.
  - "20+ reports filed (possible abuse)" → reporter may be weaponizing the report system; investigate them too.

### Moderator actions

| Action | Effect |
|---|---|
| **Suspend social 24h / 7d** | Sets `profiles.social_suspended_until`. `canUserDM` rejects with `reason: 'suspended'`. Follows can still happen (intentional — suspension is for messaging + community signal, not the whole platform). |
| **Unsuspend** | Clears `social_suspended_until`. |
| **Force-disable** | Sets `profiles.role = 'disabled'`. The existing auth flow rejects disabled users. Use this only for confirmed scammers / Ban-worthy ToS violations. |
| **Restore** | Sets `profiles.role = 'user'`. Re-enables a previously force-disabled account. |

Message-level actions (`remove_message` / `restore_message`) are available via the same `/api/admin/social/moderate` endpoint but the UI surface for them lives inside the dispute resolution flow (not in this page) — a moderator following up on a DM-harassment report uses the message_id from the report context.

Every action is logged to `admin_audit_log` with the moderator's user_id, action name, target type/id, and metadata.

## `/admin/onboarding-analytics`

Funnel for the last 30 days. Per-card row:
- Viewed / Next / Skip clicked / Skip confirmed / Completed counts.
- Drop-off percentage = (1 − Next / Viewed).

Plus A/B variant comparison at the top: A vs B completion rate. If one variant's completion rate is meaningfully higher and the sample size is decent, copy that variant into the default in `lib/onboarding/cards.ts`.

## `/admin/audit-tracker`

Live summary of every feature audited against industry standards. Source-of-truth: `docs/industry-standard-audit.md`. Update the markdown when a backlog item ships; the tracker auto-reflects via the static status enum.

## Audit log

All moderator actions write to `admin_audit_log` (`actor_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at`). Query for compliance reviews or to investigate "who did what" disputes:

```sql
SELECT * FROM admin_audit_log
WHERE action LIKE 'social.%'
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

## Rate limits

In-memory token buckets in `lib/social/rateLimit.ts`:
- Follow: 30 per hour per user
- DM send: 60 per minute per user
- Report: 5 per hour per user
- Block: 20 per 10 min per user

These reset on serverless cold start and are per-instance (so a noisy abuser sees per-region effective limits). Upgrade to Upstash Redis when abuse warrants it.
