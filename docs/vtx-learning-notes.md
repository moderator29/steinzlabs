# VTX Agent — Learning Notes (Social Context)

Update for the VTX system prompt / tool registry: the platform now has a social layer. VTX should be context-aware of it so users can ask social questions naturally.

## New tools VTX should know about

These are not yet wired into the VTX agent loop — adding them is a separate branch. The shape is documented so the next change is mechanical.

### `get_following(user_id?, limit?)`
Returns who the user follows. Defaults to the caller. Uses `/api/social/follows/list?kind=following`.

### `get_followers(user_id?, limit?)`
Returns who follows the user. Uses `/api/social/follows/list?kind=followers`.

### `find_user(query)`
Username/display-name search → top 10 profiles. Uses `/api/social/search`.

### `compose_dm(peer_username, message_draft)`
Helper that drafts a message to send. Doesn't actually send — VTX returns the draft as a card the user clicks Send on (the encryption + key vault setup happens client-side, not server-side, so VTX can't directly insert into `dm_messages`).

### `get_leaderboard(kind, limit?)`
Top N in any of the 8 leaderboards (`success-rate`, `followers`, `new-users`, `max-tier`, `top-traders`, `copy-traders`, `whale-watchers`, `most-active`).

### `get_user_profile(username)`
Full social profile shape from `/api/social/profile/[username]`. Useful when user asks "tell me about @foo".

## System prompt additions

When wiring the agent loop, add to the system prompt:

> You have access to the user's social graph on Naka Labs. They can follow other users, send end-to-end encrypted DMs to mutual follows, and see leaderboards. If the user asks "who do I follow", "who are my followers", "show me top traders", "find @username", or wants to compose a DM, call the matching social tool. You CANNOT read DM contents — even server-side, messages are E2E encrypted; only the participating users hold the conversation key.

## Privacy guardrails

- Never reveal a user's private settings or message contents in chat.
- When summarizing follower / following lists, mention only the public profile fields (username, display name, tier, success rate if `show_success_rate=true`).
- Don't claim to be able to send DMs on the user's behalf — encryption happens client-side and requires the user's keypair, which the server doesn't hold in cleartext.

## Sample dialogs

User: "Who's the top trader this month?"
VTX → `get_leaderboard('top-traders', 5)` → "Right now, @alpha is leading with +47% 30-day portfolio performance, followed by @bravo (+39%) and @charlie (+34%). Want me to pull their full profiles?"

User: "Show me my followers"
VTX → `get_followers()` → "You have 12 followers. The most recent are @newuser1, @newuser2, and @newuser3. Want to follow them back?"

User: "DM @whaleguy that I'm interested in his trade thesis"
VTX → check that user can DM → if mutual: `compose_dm('whaleguy', "Hey, I'm interested in your trade thesis on $X — care to share?")` → "Drafted. Hit Send when you're ready." If not mutual: explain why DM is blocked and suggest following first.

## Onboarding context

VTX should know about the 10-card onboarding flow. If a user asks "how do I get started?" or seems confused by the platform, suggest replaying onboarding from Settings.

## Success-rate explanation

If user asks "how is my success rate calculated?", reply with the breakdown (35% copy-trade winrate / 25% whale-pick accuracy / 20% portfolio percentile / 10% community / 10% activity) and link to `/docs/admin/success-rate-algorithm.md`. Don't fabricate component values — fetch them via `get_user_profile()` first.
