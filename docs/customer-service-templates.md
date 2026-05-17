# Customer Service Templates

Copy-paste templates for the most common social-feature support tickets. Adapt tone to the user's channel (formal for email, casual for Telegram / Discord).

---

## "Why can't I DM @user?"

> Hey {name} — DMs on Naka Labs are gated by the receiving user's privacy settings. The most common reasons you'd see Message disabled:
>
> - **Mutual-only** (the default): you both need to follow each other before DM opens.
> - **Following-only**: @user has set DMs to only people they follow back. Try following them first; if they follow you back, the DM unlocks.
> - **Nobody**: @user has DMs off platform-wide.
> - **Block**: one of you blocked the other.
>
> Hover the disabled Message button — the tooltip says exactly which one applies. If you think this is a bug, send me the URL to their profile and your username and I'll look at it.

---

## "How do I make my account private?"

> Settings → Privacy → **Private account** toggle.
>
> While it's on, every new follow request needs your approval before they can see your followers/following list or send you a DM. You'll see pending requests on your profile as a one-click approve/reject. Existing followers stay.
>
> You can also tighten DMs separately under **DMs from** (Everyone / Following / Mutual / Nobody) without going fully private.

---

## "How is my success rate calculated?"

> Your success rate is a 0–100 score that updates nightly from real on-chain activity:
>
> - **35% copy-trade win rate** — what % of trades you copied closed in profit (90-day window).
> - **25% whale-pick accuracy** — what % of the whales you follow have positive 30-day PnL.
> - **20% portfolio performance** — your 30-day realized PnL percentile vs all active platform users.
> - **10% community score** — followers minus resolved reports against you.
> - **10% activity score** — feature-usage events in the last 30 days.
>
> If you haven't done one of these activities yet (e.g. no copy trades), that component is skipped and the remaining weights are renormalized so your score isn't dragged down for not doing something you haven't tried.
>
> Full algorithm: docs/admin/success-rate-algorithm.md

---

## "Someone is harassing me"

> I'm sorry to hear that. Three things you can do right now:
>
> 1. **Block** @them — open their profile → ⋯ menu → Block. They can't message you, you can't see each other anywhere, and any follow edge between you is removed in both directions.
> 2. **Mute** @them — same menu. Softer than block; they don't know, but their content stops surfacing for you.
> 3. **Report** @them — ⋯ menu → Report. Pick the category (harassment), describe what happened. Moderators review every report. Your identity stays private — the reported user never sees who reported them.
>
> If the harassment is happening in DMs, please screenshot the messages before blocking — once you block, your conversation list hides theirs, and we can pull the encrypted message metadata for moderator review but can't read the contents (DMs are end-to-end encrypted by design).
>
> If you feel unsafe or this involves threats, please also contact local authorities — we'll cooperate with any law-enforcement request.

---

## "My DM disappeared / can't decrypt"

> Naka Labs DMs are end-to-end encrypted — only your device holds the conversation key. If a message shows "[unable to decrypt]" it usually means one of two things:
>
> - **You signed out and back in with a fresh session.** The wrap secret protecting your private key is derived from your active session token. When the token fully resets, the key wrap is no longer recoverable and historical messages encrypted under the old key become unreadable. We're working on a device-recovery flow; for now, messages exchanged after your most recent sign-in stay readable.
> - **The other side wiped their account / changed something.** Each conversation key is sealed to both participants' keypairs; if one side regenerates, future messages won't decrypt for the other.
>
> Either way: nothing on our end deleted the message. We can confirm the message row exists in the database (ciphertext + iv) — we just can't read it any more than you can.

---

## "Can I see who blocked me?"

> No, by design. Blocks are private to the blocker — you'll just notice the user disappears from search, leaderboards, your follower/following lists, and DM is silently unavailable.
>
> This is intentional: surfacing "User X blocked you" would invite retaliation and harassment toward whoever exercised the block.

---

## "How do I replay the onboarding tour?"

> Settings → **Replay onboarding** (under your profile section). It re-mounts the 10-card walkthrough next time you open the dashboard.
>
> If you can't find it: clear your browser's storage for our domain and refresh — that also forces it back, but you'll have to sign in again.

---

## "Why does my success rate say 50 / 100?"

> 50 is the neutral default when there's not enough activity yet to score any of the five components. As soon as you start trading, copying whales, or using more features, your score updates nightly from real data.
>
> If you've been active for a while and still see 50, check Settings → Privacy → **Show success rate** is on; some users hide their score from their own profile by accident.

---

## "Bot followed me 50 times in 5 minutes"

> Our follow API rate-limits to 30 follows per hour per user — a real account can't do 50 in 5 minutes, so this is almost certainly a bot trying to look popular. Block the account and report it as **spam**; our most-blocked dashboard already surfaces this user to the moderator queue if multiple people block them.
>
> We also track high follow velocity as a suspicious-activity flag on our admin panel — accounts with 50+ follows in 24h are auto-flagged for review.

---

## Internal — escalation matrix

- **Spam / follow farming** → moderator queue, usually resolved without owner involvement.
- **Harassment + threats** → moderator queue + owner notification (Telegram).
- **Impersonation of a known figure** → owner only; legal review path.
- **DM-content disputes** (encrypted, can't read) → request screenshots from the reporter; act on those + context; document the action.
- **CSAM / illegal content** → preserve all metadata, suspend the account, notify NCMEC, then escalate.
