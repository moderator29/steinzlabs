# Social Layer — User Guide

Naka Labs is more than a trading platform. It's a social trading intelligence network where reputation is built on real on-chain performance.

## The Wire

The Wire is the SocialFi layer of Naka Labs: a live timeline where you post calls, react on-chain, and reward the people who get it right, all from your own wallet. It reads and works cleanly on mobile, tablet and desktop.

### Post a wire

Tap the compose button to open the **full-page composer**. From there you can:

- Write your wire and attach **up to 4 images** (JPG, PNG, WebP or GIF, each under 1 MB).
- Tag it with topics from the **Options** dropdown, picking one to three subjects so the right people find it.
- Use the **AI draft helper**: hand it rough notes or a ticker and it drops a clean draft into the editor. You still review, edit and post it yourself.

### Cashtags

Type a **cashtag** like `$SOL` or `$BTC` and it becomes a live price chip inside your wire. Anyone reading can tap the chip to see the current price, so a call always carries the number behind it.

### Tips and gifts

Any wire can receive **on-chain tips and gifts**, and the value it has earned shows right on the post. Gifting is **non-custodial**: the sender signs every gift from their own wallet, so nothing passes through us.

### Signal score

Each account carries a **Signal score** from 0 to 100. It is a transparent read on reputation built from real on-chain activity and genuine engagement, and it helps rank what rises in the feed. It is honest and legible, not a black box.

### Inline predictions

Attach an **inline prediction** to a wire, for example a call that SOL trades below a target within the hour. Readers **tap to agree** with it, and it ties into **Naka Predict**, so a hunch becomes something you can track.

### Relay and replies

- **Relay (repost)** pushes a wire to your own followers.
- **Reply** opens a **thread in a side panel** when you tap the comment icon, so a conversation never pulls you away from the feed.

### The post menu

The **"..." menu** on any wire gives you:

- **Share**: copy a public link or use your device share sheet.
- **Mute a user**: hides their wires from your feed. Their profile still works normally, and they are not notified.
- **Delete**: removes a wire you posted.

### Public share links

Every wire has a **public share link**. Drop it anywhere off the platform and people can preview the wire and follow it back into Naka Labs.

### Feeds

Switch between three views at the top of The Wire:

- **Latest**: every top-level wire, newest first.
- **Signal**: ranked by real engagement and Signal score.
- **Pack**: only the people you follow.

Tap a topic to filter the stream to that subject. The filter **applies on its own** and tapping it again clears it.

### Wire activity on your profile

A profile organizes a person's wire activity into tabs: **Posts**, **Replies**, **Media**, **Reposts** and **Gifts**.

## Follow people

Click **Follow** on any profile. By default the follow is instant (one-way). If the user has set their profile to private, the follow becomes a pending request — they decide whether to accept.

Mutual follows unlock direct messages and a "Mutual" badge on the follow button.

## Discover users

The **Find** button in the bottom nav opens `/discover`. From there:

- Live search by username, display name, or wallet address — 300 ms-debounced autocomplete shows up to 10 results as you type.
- Recommendations: "You might like to follow" surfaces users picked from people-you-follow-also-follow + tier-above-you + high-success-rate + recently-active. Dismiss a card with the × — it won't return.
- Eight leaderboards:
  - **Top Success Rate** — composite score (35% copy-trade winrate, 25% whale-pick accuracy, 20% portfolio 30d percentile, 10% community score, 10% activity score)
  - **Top Followers**
  - **New Users**
  - **Max Tier**
  - **Top Traders** — best 30-day portfolio percentile
  - **Top Copy Traders** — best copy-trade win rate
  - **Top Whale Watchers** — most accurate at picking profitable whales
  - **Most Active**

Click **View all →** on any leaderboard to see the top 100 with inline follow buttons.

## Encrypted direct messages

Click **Message** on any mutual-follow's profile. DMs are end-to-end encrypted with libsodium:

- Your device generates a public/private keypair the first time you open a DM. Public key is published; private key is wrapped with a secret derived from your active session and stored on the server only in ciphertext form. The server **cannot** decrypt your messages.
- Each conversation has its own symmetric key, sealed to each participant's public key.
- Messages stream over Supabase Realtime; new messages appear without polling.

**Why "Message" might be disabled** on someone's profile:
- They've set DMs to **Mutual** (default) and you don't follow each other.
- They've set DMs to **Following** and they don't follow you.
- They've set DMs to **Nobody**.
- One of you has blocked the other.
- They've been suspended from social features.

## Privacy settings

In **Settings → Privacy**:
- **Private account** — follows require approval.
- **DMs from** — Everyone / Following / Mutual / Nobody.
- **Show success rate** on profile — on by default.
- **Show wallet balance** on profile — off by default.
- **Show activity** on profile — on by default.

## Block, mute, report

From any profile's **⋯** menu:
- **Block** — they can't message you, you can't see each other in lists. Existing follow edges are removed in both directions.
- **Mute** — they don't know; you stop seeing their content.
- **Report** — pick a category (spam / harassment / scam / impersonation / other), describe what happened. Moderators review. Your identity isn't surfaced to the reported user.

## Profile

Your profile (`/u/<your-username>`) shows five containers — Posts, Subscription tier, Wallet, Followers count, Following count — plus four tabs: Overview, Posts, Following, Followers. Click the count cards to drill into the X-style follower / following lists with in-list search + sort by recent or success rate + infinite scroll.

## Success rate

The success-rate badge on your profile (X/100) is computed nightly. It combines:

- 35% — **Copy-trade win rate**: % of trades you copied that closed in profit (90-day window).
- 25% — **Whale-pick accuracy**: % of the whales you follow that have positive 30-day PnL.
- 20% — **Portfolio performance**: your 30-day realized PnL percentile vs all active platform users.
- 10% — **Community score**: followers (logistic) minus 10 per resolved report against you.
- 10% — **Activity score**: distinct feature-usage events in the last 30 days, capped at 30.

If a component has too little data (e.g. you've never copied a trade), it's dropped and the remaining weights are renormalized — your score is honest even when sparse.
