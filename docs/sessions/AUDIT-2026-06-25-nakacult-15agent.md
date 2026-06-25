<!-- 15-agent brutally-honest NakaCult audit, 15/15 agents. Verified vs live Supabase project phvewrldcdxupsnakddx. -->

# NakaCult Brutal Audit (2026-06-25, 15-agent)

## Executive verdict

NakaCult is a beautifully-built corpse. The craft is real — the entry cinematic, aurora shells, player orb, and chamber styling are genuinely strong, and the backend code is honest: it reads real data sources (Alchemy, Helius, DexScreener, CoinGecko, Anthropic), it does not hardcode fake metrics into the happy path, and most empty states render honest em-dashes rather than lies. There is craft here worth keeping.

But underneath the polish, **the entire product is disconnected from a running pipeline and from reality**:

- **Genuinely good:** The Forge (live Alchemy NFT fan-out, honest offline/empty states). The Conviction scoring engine (real DexScreener entry+re-price, never fake-scored). The "Ape or Nope" game code (CoinGecko trending → DexScreener pricing, no mocks). The offering raffle, signal feeder, and Sage AI route (real Anthropic Sonnet with real token accounting). The cron cost architecture (every cron is kill-switch gated and short-circuits on empty work). The naka_prompts seed config. CultPlayer/CultStatsCounter component logic. These are correctly wired and data-honest.

- **Fake / broken / empty:** The platform-wide **Vercel cron scheduler has been dead since 2026-05-13 — 43 days dark.** Every "Daily" / "Live" / "snapshot" label is a lie: the Daily Seal is 6 weeks stale, the Treasury is a NULL placeholder, the Ape game has never opened a single round, membership has not been re-verified in 6 weeks, and 6 of the cult crons (ape-open, ape-resolve, conviction-score, offering-draw, signal-feed, naka-cult-resolver) have **never executed once.** Every interactive cult table is empty (0 proposals, 0 votes, 0 whispers, 0 convictions, 0 offerings, 0 signals, 0 hall messages, 0 sage messages, 0 achievements, 0 loadouts). The Vault's hero "THE CULT IS ALIVE" strip reads "—, —, 0, 3" — the opposite of alive. The three flagship chambers (Conclave/Oracle/Sanctum) are **fully built and live but rendered as disabled "Coming soon" tiles** — core nav is unreachable from its own home, while the secondary Commons chambers ARE clickable (exactly backwards). The "Ddergo Library player" is a Spotify iframe with 8 fabricated track rows all pointing at one playlist. The "E2E encrypted DMs" claim is fiction — zero crypto, plaintext storage, no DM concept. Weighted voting is a hardcoded `weight = isChosen ? 2 : 1` constant, not holdings-derived. "Realtime" is dead across nearly every surface (tables not in the publication; UIs poll or fetch-once). The cult_stats view counts a retired tier so the public counter shows "Active Cultists: 0" while 3 members exist.

- **The retired-feature scandal:** The **"Chosen" lineage is explicitly RETIRED but is load-bearing across ~12 cult API routes, the DB, and the UI** — driving vote weight (2x), gating writes (curation/echo/seal-draft/annals), pinning leaderboards, rendering a live "Chosen Seals: 3" stat, and surviving in cosmetics (gold_ring "Chosen Ring") and achievements (chosen_seal_written). This is not a dead remnant; it is an active, populated subsystem that directly violates the retirement directive.

Bottom line: NakaCult has the chassis of a $300 product and the running state of an abandoned one. Nothing needs to be "invented" — it needs to be **turned on, de-Chosen, made honest, and de-Spotify'd.**

---

## Critical issues (P0)

| Area | Issue | Location | Data verdict | Fix |
|---|---|---|---|---|
| Crons / platform | **Entire Vercel cron scheduler dead 43 days** (last run 2026-05-13 19:34 UTC). Kills Daily Seal, Treasury, membership re-verify, proposal resolution, Ape game. App server is alive (trust route ran 2026-06-23) — only the scheduler is dead. | vercel.json:34-43; cron_execution_log (most_recent_any_cron 2026-05-13) | STALE | Re-enable Vercel Cron (check CRONS_PAUSED env, CRON_SECRET, cron-plan limits — vercel.json lists 54 crons, exceeds Hobby/Pro). Add a health-watch that pages when any cult cron's max(completed_at) > 2x its cadence. |
| Access | **naka-cult-resolver cron has NEVER run** — the daily on-chain entitlement sweep that grants NIPPO/NAKA/Founder access is non-functional. No wallet can ever earn cult access on-chain. | app/api/cron/naka-cult-resolver/route.ts:27; cron_execution_log (0 rows); vercel.json:36 | EMPTY | Confirm deployed + authorized; add a startup log row; run manually once and verify cultGranted reflects wallets in user_wallets_v2. Until it runs, only manual SQL grants work. |
| Access | **All 3 cult members are manually-granted `cult_source='legacy'`** (identical 2026-06-21 12:47:30 bulk-insert timestamp). Zero members ever resolved on-chain. The "access iff holds NIPPO/NAKA" invariant is currently fiction. | profiles; lib/cult/entitlements.ts:96 | STALE | Acceptable only as pre-mint bootstrap; resolver (above) MUST run before launch. Add admin view distinguishing legacy vs on-chain members. |
| Vault nav | **Three flagship chambers (Conclave/Oracle/Sanctum) marked `comingSoon` → dead unclickable tiles**, but all three routes are fully built and live. Secondary Commons chambers ARE clickable — backwards. | app/vault/page.tsx:59-83; ChamberPortal.tsx:59-61 vs app/vault/conclave|oracle|sanctum/page.tsx | N/A | Remove comingSoon from the three primary portals so they link to shipped routes. Gate genuinely-unbuilt sub-features inside the chamber, not the whole portal. |
| Vault stats | **cult_stats.active_members counts retired `tier='naka_cult'` (=0)** while the gate uses `cult_member=true` (=3). Vault shows "Active Cultists: 0" to real members. | DB view cult_stats; app/vault/page.tsx:134 | STALE | `CREATE OR REPLACE VIEW`: active_members := count(*) FILTER (WHERE cult_member=true). Mirror into supabase/migrations. |
| Vault stats | **$NAKA Held counter is permanently dead** — view literally selects `NULL::numeric AS total_naka_held`; no aggregation feeds it anywhere. | DB view cult_stats; app/vault/page.tsx:135; CultStatsCounter.tsx:85 | EMPTY | Wire to a real sum of resolved on-chain NAKA per member (persisted by the resolver cron), or remove the tile. |
| Conclave | **Vote weight is FABRICATED** — `const weight = access.isChosen ? 2 : 1` with no Alchemy/Helius balance read, despite the holdings resolver already existing in lib/cult/holdings.ts. UI advertises "sqrt-scaled by holdings" governance that does not exist. | app/api/cult/proposals/[id]/vote/route.ts:55-71; VoteOrbs.tsx:18 | FABRICATED | Read voter's real $NAKA balance at cast time via resolveHoldings(), snapshot onto the vote row, apply sqrt scaling server-side. Until then do not claim holdings-weighted voting. |
| Conclave | **"Realtime" is DEAD** — cult_proposals & cult_proposal_votes are NOT in the supabase_realtime publication (pg_publication_tables returned []), so subscribed channels never receive events. Plus the **RLS read policy keys off `tier='naka_cult'`** while the gate uses `cult_member` — silently zeroes anon-client reads for legitimate members even if the publication were fixed. | ConclaveClient.tsx:51-59; VoteOrbs.tsx:43-48; DB policies cult_proposals_read/cult_votes_read | N/A | `ALTER PUBLICATION supabase_realtime ADD TABLE` both tables (REPLICA IDENTITY FULL); rewrite both RLS policies to gate on `cult_member=true`. |
| Oracle | **Daily Seal cron stopped 43 days ago** — Oracle serves a 2026-05-13 briefing as "today's" Daily Seal. The GET route returns the most-recent seal regardless of age. 2026-05-12 also failed on an Anthropic 529 with no retry. | cult-generate-daily-seal/route.ts:24-152; vercel.json:34 | STALE | Revive scheduler; add a freshness guard (never serve a seal >48h old as "today"); Sentry alert when no seal by 08:00 UTC; add retry/backoff on 529. |
| Oracle | **`MODEL='claude-opus-4-7'` is not a valid Anthropic model id** — the one live seal row was produced against this bogus id. | cult-generate-daily-seal/route.ts:11; cult_daily_seals | FABRICATED | Set a real current Anthropic model id; on 4xx log to Sentry and retry with a known-good id. *(Verify model ids against the Anthropic model list before editing.)* |
| Oracle | **"E2E encrypted DMs" is a pure label** — zero crypto (no encrypt/decrypt/nonce/pubkey/crypto.subtle/nacl anywhere), plaintext `body text` column, no recipient/DM concept. It is a public anonymous broadcast board. A fabricated security claim. | whispers/route.ts:84-94; cult_whispers.body (text) | FABRICATED | Stop calling it E2E/DMs anywhere. Rename to "Anonymous Signal Board." If real DMs are wanted, build separately (X25519 device keypair, sealed-box, ciphertext+nonce only). |
| Conclave | **'Chosen' badge RETIRED but drives vote weight, gold-ring rendering, and writes is_chosen** to vote rows. | vote/route.ts:57,66,68; VoteOrbs.tsx:84,89; lib/cult/access.ts:44,116 | REAL (3/16 profiles is_chosen=true) | Remove isChosen from CultAccess, drop double-weight, stop writing is_chosen, strip gold-ring/tooltip. Plan migration to drop the column. |
| Sanctum | **No achievement-earning pipeline exists** — the 5 action-based achievements are permanently unearnable; the only writer is a Chosen-only manual API grant with no UI. Annals is a museum no one can enter. | annals/route.ts:101-118 (only writer); cult_member_achievements (0 rows) | REAL (catalog) / EMPTY (grants) | Build idempotent server-side grant hooks at each real action site (seal read, vote, listen, whisper echoed, founding-year backfill). |
| Sanctum | **Equipped loadout is write-only** — only MantlePanel + its own route read cult_member_loadouts; nothing else renders worn cosmetics. The tagline "what carries forward when the cult sees you" is false. | MantlePanel.tsx:119; cult_member_loadouts (0 rows) | EMPTY | Read loadout in every identity-render site (IdentityStrip, Hall, Conviction, directory) and apply worn cosmetics, or rewrite the copy. |
| Sanctum | **Track catalog is fabricated metadata over one Spotify playlist** — 8 rows with distinct hand-invented titles/artists/durations all sharing identical `storage_path 'spotify:playlist:2tuf8ddMY5YPMlqzNWsVyC'`. No per-track audio exists. | cult_ambient_tracks; LibraryPlayer.tsx:54-56; library/route.ts:21-26 | FABRICATED | Ingest real per-track audio (Supabase Storage/CDN, durations from ffprobe) OR pull real Spotify Web API metadata; delete the 8 fabricated rows. |
| Sanctum | **On-page LibraryPlayer has zero playback controls** in playlist mode — just a static notice telling you to use a floating orb. The real audio is an off-the-shelf Spotify `<iframe>`. | LibraryPlayer.tsx:68-73; CultPlayer.tsx:114-124 | N/A | Build a first-party player (Web Audio API transport: play/pause, seekable progress, queue reflecting display_order, keyboard shortcuts, persistent cross-chamber playback). |
| Ape | **Feature is entirely EMPTY and the opening cron has never run** — page shows "No round live" to every member. | cult_ape_rounds/votes (0 rows); cult-ape-open (0 executions); vercel.json:42-43 | EMPTY | Manually invoke cult-ape-open with the cron secret to seed round #1; verify the deploy that added vercel.json:42-43 shipped to main; log skipped/error branches. |
| Commons | **Offering/Conviction/Pulse crons have NEVER run** — Hall silent, board blank, no offerings, Pulse quiet. All four feature tables empty despite 3 real members (gate is not the blocker). | cult-offering-draw, cult-signal-feed, cult-conviction-score; vercel.json:39-41 | EMPTY | Revive scheduler; verify Vercel Cron enabled on the deployment + on the cron plan; add Sentry heartbeat. |
| Data / Chosen | **'Chosen' lineage RETIRED but fully alive across DB + code** — profiles.is_chosen (3 rows), useChosenStatus hook, ChosenLibraryCurator, ChosenSealDraftPanel, gold_ring "Chosen Ring" cosmetic, chosen_seal_written achievement, ~12 cult API routes. | profiles.is_chosen; lib/hooks/useChosenStatus.ts; components/vault/{sanctum/ChosenLibraryCurator, oracle/ChosenSealDraftPanel}.tsx; cult_cosmetics; cult_achievements | REAL | Purge end-to-end as one epic (see fix sequence): drop/rename profiles.is_chosen, delete Chosen components/hooks, rename cosmetic+achievement, strip from every route payload and leaderboard. Decide the post-Chosen gate model first. |

---

## High (P1) and Medium (P2/P3) — grouped by chamber

### Landing (/naka-cult)
- **P0 — CTAs are login-coupled Links, not wallet-connect.** page.tsx is a pure RSC; primary CTAs route via `Link href="/vault"` and `/dashboard/pricing` with zero AppKit/wagmi wiring. A wallet holder not logged into the platform never gets an on-chain check. The canonical pattern (`useAppKit().open()`) already exists at WalletAuthButton.tsx:40. *(app/naka-cult/page.tsx:54,238,240,59)*
- **P1 — Treasury stat renders "…" over a NULL, 52-day-stale snapshot** under a "Live snapshot" label. *(CultStatsStrip.tsx:59-66,84-87; cult_treasury_snapshots)*
- **P1 — Animated aurora + 3 floating orbs run inside the scroll container**, not a fixed layer; `overflow-anchor:none` + `scrollRestoration='manual'` are band-aids. *(landing.css:6-19,37-53,513-556; page.tsx:33-37; app/layout.tsx:127)*
- **P1 — Retired "Chosen" remnants** in markup/CSS/types. *(page.tsx:169; landing.css:432-441; access.ts:44,94,117)*
- **P2 — Cultist/Soundtrack stats REAL but trivially small** (3 cultists, 8 tracks); NAKA_THRESHOLD is a hardcoded 1_227_000 constant, not shared on-chain config. *(CultStatsStrip.tsx:10,52-74)*
- **P2 — Low-opacity body text fails WCAG AAA** — rgba(200,214,255,0.55) ≈ 4.62:1 on #050816 at 10-11px. *(landing.css:352,450,371,422,501)*
- **P3 — Orphaned `.nakacult-hero__logo` CSS** (post-LivingSigil rebrand) + non-member CTA points to /dashboard/pricing, contradicting the page's own FAQ that the cult is NOT a platform tier. *(landing.css:660-680; page.tsx:240)*

### Access / Membership
- **P1 — cult_stats.active_members hardwired to retired tier** → public counter permanently 0 (3 real). *(cult_stats; vault/page.tsx:134)*
- **P1 — total_naka_held hardcoded NULL** — "$NAKA Held" permanently empty. *(cult_stats; vault/page.tsx:135)*
- **P1 — Live resolver ignores the DB-editable threshold.** entitlements.ts uses an env constant; only cult-verify reads platform_settings via getCultThreshold(). Admin threshold edits don't affect who gets granted. *(entitlements.ts:30; holdings.ts:35-54)*
- **P1 — 'Chosen' load-bearing across the access surface** (CultAccess.isChosen, /api/cult/me contract, useChosenStatus, IdentityStrip, vault "Chosen Seals" stat). *(access.ts:44,120; useChosenStatus.ts; vault/page.tsx:137; layout.tsx:30)*
- **P2 — ERC-20 decimals never populated; resolver assumes 18.** If $NAKA mints with non-18 decimals, the 1.227M threshold comparison is wrong by orders of magnitude. *(alchemy.ts:114-117; holdings.ts:122-123; entitlements.ts:69)*
- **P2 — getCultThreshold queries platform_settings without `.eq('id',1)`/order** — non-deterministic if a 2nd row appears. *(holdings.ts:41)*
- **P2 — Solana members silently unsupported** in the authoritative grant path. holdings.ts implements full Solana resolution but naka-cult-resolver is EVM-only; one wallet's solanaAddress is dropped. *(cult-verify-membership/route.ts:77; naka-cult-resolver/route.ts:49,51)*
- **P3 — Inconsistent enablement** — cult-verify no-ops unless NAKA_TOKEN_CONTRACT env set, but the grant cron runs on hardcoded defaults. Members can be granted but never re-verified/revoked. *(holdings.ts:79-85; cult-verify-membership/route.ts:37)*

### Vault Shell & Navigation
- **P1 — Retired "Chosen" badge rendered in shell + as a live stat** across ~10 components. *(IdentityStrip.tsx:6-28; layout.tsx:30; vault/page.tsx:137; cult_stats.chosen_count)*
- **P1 — "Decrees Passed" honestly 0 but whole governance pipeline empty** — strip reads "—, —/0, 0, 3"; only the retired chosen_count shows a number. *(vault/page.tsx:136; cult_proposals 0 rows)*
- **P2 — Ape page subtext #8C9AC0 fails AAA on card bg** (6.69:1 on ~#0A0F2E). Other shell colors pass. *(ape/page.tsx:12)*
- **P2 — VaultEntryAnimation blocks the whole Vault 2.8s** with timer-only dismissal, no Esc, no focus management. *(VaultEntryAnimation.tsx:42-52,75; vault.css:275-286)*
- **P3 — Perpetual 30s conic-gradient on a -50% inset (4x viewport) layer** + portal-breathe + orb spin = always-on compositor work. Reduced-motion is honored. *(vault.css:31-43,144-147,879-882)*

### Conclave
- **P1 — Treasury panel EMPTY** — single manual NULL-balance snapshot, 7+ weeks stale; refresh cron hard-gated off (NAKA_TREASURY_WALLET unset → skipped='env_unset'). *(TreasuryPanel.tsx:11-37; cult-refresh-treasury/route.ts:33-45)*
- **P1 — Proposal/vote tables completely empty** — every member sees "The Conclave is silent." *(cult_proposals, cult_proposal_votes)*
- **P1 — VoteOrbs realtime subscription DEAD** (cult_proposal_votes not in publication). *(VoteOrbs.tsx:42-48)*
- **P2 — stake_naka / slashing is cosmetic** — any number 0..1e9 accepted, no balance check, no on-chain transfer, no escrow. Fake economic stake in a real-money product. *(CreateProposalModal.tsx:122-131; route.ts:66; cult-resolve-proposals/route.ts:50)*
- **P2 — Conviction scoring is REAL code but UNPROVEN** (0 rows; leaderboard always blank). No fix needed — cold-start. *(cult-conviction-score/route.ts:31-55; convictionPrice.ts:24-52)*
- **P2 — Vote failures silently swallowed** — empty catch ("toast can be added later"), violates CLAUDE.md. *(ProposalCard.tsx:61-63)*
- **P2 — MIN_VOTERS_FOR_PASS=5 slashes low-turnout decrees** — quorum failure punished as a loss, and on fabricated weight totals. *(cult-resolve-proposals/route.ts:46-50)*
- **P3 — Cinematic pass/fail sounds almost never fire** (dead realtime + 10-min resolver timing). *(ConclaveClient.tsx:26-31)*

### Oracle
- **P1 — Sage AI sold as "streaming" but is a blocking single-shot call** (`messages.create`, non-streaming) and has NEVER been used (cult_sage_messages empty). *(sage/route.ts:123-128; VtxSagePanel.tsx:128-132)*
- **P1 — Whisper & Echo tables completely empty**; thresholds (5 echo / 3 silence) unreachable with current cohort. *(cult_whispers, cult_whisper_votes, cult_echo_wallets)*
- **P1 — Whisper Network not realtime** — no publication, no polling; other members' activity invisible until reload. *(WhisperNetworkPanel.tsx:54-76; EchoChamberPanel.tsx:45-67)*
- **P1 — Echo Chamber built entirely around retired "Chosen"** — renders "Chosen path — seat a new wallet," "Only the Chosen may seat wallets," gates all writes on isChosen. *(EchoChamberPanel.tsx:18,155,173-177,219; echo routes; access.ts:44-120)*
- **P2 — Optimistic Sage UI desyncs on error** — comment says it rolls back the user turn but code doesn't; server already persisted it → orphaned user turn on reload. *(VtxSagePanel.tsx:67-73)*
- **P2 — Vote/threshold transition not atomic** — insert→recount→update race window; last-writer-wins on count columns. *(whispers/[id]/vote/route.ts:61-97)*
- **P2 — Echo Chamber advertises live holdings but renders static rows** — no Alchemy/Helius enrichment wired. *(EchoChamberPanel.tsx:28-34,134-168)*
- **P3 — Daily Seal prompt is a hardcoded placeholder** — only the date is injected; no market/narrative/sentiment data. Genuine model output, but a context-free horoscope. *(cult-generate-daily-seal/route.ts:18-20,96-104)*
- **P3 — Whisper anonymity is server-trust only** (author_id stored, never projected); UI's absolute "anonymous" overstates the guarantee. *(whispers/route.ts:22-28,92; WhisperNetworkPanel.tsx:157)*
- **P3 — Dead SubChamberPlaceholder** in OracleHubClient. *(OracleHubClient.tsx:49-61)*

### Sanctum
- **P1 — Cosmetic achievement-gating UI is dead code** — all 17 cosmetics have NULL requires_achievement_code, so the lock branch never executes. *(MantlePanel.tsx:84-88,144,181-184)*
- **P1 — Reorder API persists an order the player never honors** — CultPlayer takes the first spotify:playlist match; order is irrelevant; list hidden in playlist mode. Chosen curators reorder into the void. *(library/reorder/route.ts:53-65; ChosenLibraryCurator.tsx:51-79; CultPlayer.tsx:60-61)*
- **P1 — 'Chosen' lineage NOT retired** — full is_chosen-gated curator ships and is hub-wired; both write routes return error 'chosen_only'. *(ChosenLibraryCurator.tsx; SanctumHubClient.tsx:7,37; library/[id]/route.ts:24; reorder/route.ts:27)*
- **P1 — EVM addresses lowercased in the Forge** — violates the addressNormalize rule; checksum casing lost in Etherscan links. NFT data itself is real Alchemy. *(forge/route.ts:37,102)*
- **P2 — Annals POST grant endpoint has no UI** — orphaned write path, curl-only. *(annals/route.ts:57-119)*
- **P2 — CultPlayer DEFAULT_PLAYLIST is stale** ('4ZjnNBKs9x7XdHPLQJmsiK' ≠ DB '2tuf8ddMY5YPMlqzNWsVyC') — wrong playlist on first paint / fetch failure. *(CultPlayer.tsx:21)*
- **P2 — LibraryPlayer empty-state leaks DB table name** to members ("Drop ambient tracks via cult_ambient_tracks."). *(LibraryPlayer.tsx:48,71)*
- **P2 — SubChamberPlaceholder dead code** in SanctumHubClient. *(SanctumHubClient.tsx:47-59)*
- **P3 — All 17 cosmetics have asset_url=NULL** — "cosmetics" are CSS color dots, no rendered frames/glows/sigils. *(cult_cosmetics; MantlePanel.tsx:160-178)*

### Ape
- **P1 — Retired "Chosen" badge (◈) rendered + threaded through the API.** *(ApePanel.tsx:22,200; ape/route.ts:63,80)*
- **P1 — Token resolver can grade the WRONG coin** — free-text symbol search, no chain scope, no verification that the matched pair's base token equals the trending token. *(convictionPrice.ts:30-38; cult-ape-open/route.ts:48-50)*
- **P2 — Not realtime (10s full-refetch); RLS-enabled tables have ZERO policies** so client realtime is impossible. *(ApePanel.tsx:52-56; cult_ape_rounds/votes)*
- **P2 — Resolve cron does N+1 read-modify-write per vote, no transaction** — partial failure strands points; race on cult_points. *(cult-ape-resolve/route.ts:69-90)*
- **P3 — 'flat' outcome fires no Signal Pulse** but renders in the panel — feed inconsistency. *(cult-ape-resolve/route.ts:53,92-100)*

### Commons (Hall / Conviction / Offering / Pulse)
- **P1 — Retired "Chosen" badge (◈) rendered in Hall and Conviction.** *(HallPanel.tsx:11,87-88; ConvictionPanel.tsx:15,143; hall/conviction routes)*
- **P1 — Nothing realtime** — Hall polls 5s (claims "real time"), Pulse 15s, Conviction load-once. *(HallPanel.tsx:46; PulsePanel.tsx:50; ConvictionPanel.tsx:55)*
- **P2 — Offering winner uses Math.random()** — not provably fair for a treasury-funded raffle. *(cult-offering-draw/route.ts:52-53)*
- **P2 — Muted #6B779C fails AAA** (~4.2:1 on #070A16) across timestamps/meta. *(HallPanel.tsx:90; PulsePanel.tsx:77; ConvictionPanel.tsx:136-162; OfferingPanel.tsx:89,111)*
- **P2 — Conviction resolver EVM-only; Solana mints fall through to symbol search** → wrong-pair mis-scoring. (`.toLowerCase` here is on chainId, NOT an address — rule NOT violated.) *(convictionPrice.ts:11,29-33)*
- **P3 — Panels control-sparse** — no filters/sort/status views; PulsePanel discards all of detail JSON except detail.message. *(OfferingPanel, PulsePanel, ConvictionPanel; PulsePanel.tsx:70)*

### Data / Crons (cross-cutting)
- **P1 — naka_trust_scores polluted with symbol-keyed garbage** — 4/5 rows keyed by ticker ("usdc","pepe") with identical graceful-default layers (40/30/50/40/50 → 41) and null sources, masquerading as computed scores. *(naka_trust_scores; calculate.ts:66,92,109,149,179)*
- **P2 — cult-ape-open is the only cron with NO empty-work short-circuit** — fans out CoinGecko + up to ~15 sequential DexScreener calls daily into a dead game. *(cult-ape-open/route.ts:45-53)*
- **P2 — Retired Chosen wired through daily-seal draft path + membership/holdings resolvers** (model:'chosen', source:'chosen_draft', is_chosen sync). *(cult-generate-daily-seal/route.ts:46-88; cult-verify-membership/route.ts:104-110; holdings.ts:140,188)*
- **P3 — naka-cult-resolver/entitlements lowercase EVM addresses inline** instead of addressNormalize — safe today (EVM-guarded) but a convention violation. *(naka-cult-resolver/route.ts:51; entitlements.ts:23,26,29,50,67; holdings.ts:120)*
- **P3 — naka_prompts is REAL, correct seed config** (positive finding, no action). *(naka_prompts; vtx/prompts/route.ts)*

### Cross-cutting (design/branding/mobile/dead-code)
- **P1 — 'Chosen' load-bearing in ~12 cult API routes** (vote 2x weight, leaderboard pinning, gated writes) — retiring it is a real migration epic, not scattered deletes. *(access.ts:44-120; vote/route.ts:57,68; ape/hall/conviction/sanctum/oracle/annals/daily-seal-draft routes)*
- **P2 — ~200 lines of dead CSS** for a CultPlayer bar UI that no longer renders. *(vault.css:643-843,908-929)*
- **P2 — CultPlayer orb has no safe-area-inset** — collision risk with bottom nav / home indicator on ≤520px. *(vault.css:832-837,931-934)*
- **P2 — entitlements.ts lowercases addresses directly** (EVM-guarded, safe, rule violation). *(entitlements.ts:23,26,29,50,67)*
- **P3 — CultPlayer playlist-override fetch has no abort** (minor; component is otherwise correct and data-honest). *(CultPlayer.tsx:52-65)*

---

## Data reality map — every cult table

| Table | Verdict | Rows / detail |
|---|---|---|
| profiles (cult_member=true) | **REAL** | 3 of 16; all `cult_source='legacy'`, bulk-inserted 2026-06-21 12:47:30 |
| profiles.is_chosen | **REAL (but retired)** | 3 of 16 — a live, populated retired concept |
| cult_treasury_snapshots | **EMPTY / STALE** | 1 row; balance_naka & balance_usd = NULL; source='manual'; captured 2026-05-04 (52 days stale) |
| cult_ambient_tracks | **FABRICATED** | 8 active rows; distinct titles/artists/durations all sharing one identical `spotify:playlist:2tuf8ddMY5YPMlqzNWsVyC` |
| cult_proposals | **EMPTY** | 0 |
| cult_proposal_votes | **EMPTY** | 0 (weight column written as hardcoded 1/2) |
| cult_proposal_comments | **EMPTY** | 0 |
| cult_daily_seals | **STALE** | 1 row; real Anthropic gen (185/251 tokens) but 2026-05-13, 43 days old; model='claude-opus-4-7' (invalid id) |
| cult_daily_seal_drafts | **EMPTY** | 0 (Chosen-draft branch is dead code) |
| cult_sage_messages | **EMPTY** | 0 — never used |
| cult_whispers | **EMPTY** | 0 |
| cult_whisper_votes | **EMPTY** | 0 |
| cult_echo_wallets | **EMPTY** | 0 |
| cult_ape_rounds | **EMPTY** | 0 — opener cron never ran |
| cult_ape_votes | **EMPTY** | 0 |
| cult_convictions | **EMPTY** | 0 |
| cult_offerings | **EMPTY** | 0 |
| cult_offering_entries | **EMPTY** | 0 |
| cult_signals | **EMPTY** | 0 |
| cult_hall_messages | **EMPTY** | 0 |
| cult_member_achievements | **EMPTY** | 0 (no earn pipeline) |
| cult_member_loadouts | **EMPTY** | 0 (write-only) |
| cult_user_preferences | **EMPTY** | 0 |
| cult_achievements (catalog) | **REAL** | 6 seed rows; 5 action-based ones permanently unearnable |
| cult_cosmetics (catalog) | **REAL (placeholder assets)** | 17 rows; ALL asset_url=NULL, ALL requires_achievement_code=NULL |
| naka_prompts | **REAL** | 7 curated suggestion-chip config rows (correct) |
| naka_trust_scores | **FABRICATED (4/5)** | 5 rows; 4 symbol-keyed garbage (identical 41/100, null sources); 1 real (USDC address, 2026-06-23) |
| cult_stats (view) | **BROKEN** | active_members=0 (wrong column), total_naka_held=NULL (hardcoded), chosen_count=3 (retired), decrees_passed=0 |
| platform_settings | **REAL** | 1 row (id=1, naka_threshold=1227000) |
| cron_execution_log | **STALE** | 14,385 rows; max(started_at)=2026-05-13 19:34; 6 cult crons with 0 rows ever |

---

## Dead controls inventory

**Navigation / chambers**
- app/vault/page.tsx:59-66 — "The Conclave" tile: comingSoon, non-clickable, route fully built/live
- app/vault/page.tsx:67-74 — "The Oracle" tile: comingSoon, non-clickable, route fully built/live
- app/vault/page.tsx:75-82 — "The Sanctum" tile: comingSoon, non-clickable, route fully built/live

**Dead / broken stats & counters**
- app/vault/page.tsx:134 — "Active Cultists": always 0 (wrong-column view filter) while 3 exist
- app/vault/page.tsx:135 — "$NAKA Held": permanently "—" (view hardcodes NULL)
- app/vault/page.tsx:137 — "Chosen Seals": surfaces a retired concept (chosen_count=3)
- components/naka-cult/CultStatsStrip.tsx — Treasury cell: "…" over a NULL, 52-day-stale snapshot under "Live snapshot"
- app/vault/conclave/TreasuryPanel.tsx — always renders "—" (no non-null snapshot exists)

**Retired-Chosen render paths (controls/badges that must not exist)**
- components/vault/IdentityStrip.tsx:28 — "Chosen" rank pill
- app/vault/conclave/VoteOrbs.tsx:84,89 — gold-ring + "· Chosen" tooltip
- components/vault/oracle/ChosenSealDraftPanel.tsx (entire panel)
- components/vault/sanctum/ChosenLibraryCurator.tsx:128-145 — up/down reorder buttons (Chosen-only; also functionally inert, see below)
- components/vault/commons/ApePanel.tsx:200 — ◈ glyph
- components/vault/commons/{HallPanel.tsx:87-88, ConvictionPanel.tsx:143} — ◈ glyph

**Dead realtime subscriptions (tables not in publication)**
- app/vault/conclave/ConclaveClient.tsx:51-59 — cult_proposals/votes channel
- app/vault/conclave/VoteOrbs.tsx:43-48 — per-proposal orb refresh

**Cosmetic / non-functional inputs**
- app/vault/conclave/CreateProposalModal.tsx:122-131 — "Stake $NAKA": no balance check, no transfer
- app/vault/conclave/VoteOrbs.tsx (weight) — "weighted by holdings" is hardcoded 1/2
- components/vault/sanctum/ChosenLibraryCurator.tsx:128-145 — reorder persists display_order the player ignores

**Dead code paths**
- components/vault/sanctum/LibraryPlayer.tsx:75-86 — per-track `<audio>` branch unreachable (no storage_path starts with '/audio/')
- components/vault/sanctum/LibraryPlayer.tsx:68-73 — playlist-mode "player" has no interactive controls
- components/vault/CultPlayer.tsx:21 — DEFAULT_PLAYLIST hardcoded to an id matching no DB row
- components/vault/{oracle/OracleHubClient.tsx:49-61, sanctum/SanctumHubClient.tsx:47-59} — SubChamberPlaceholder defined, never rendered
- app/api/cult/sanctum/annals/route.ts:57-119 — POST grant: no UI caller, curl-only
- MantlePanel.tsx:84-88,144,181-184 — achievement-lock branch (0 gated cosmetics)
- app/vault/vault.css:643-843,908-929 — ~200 lines of dead CultPlayer bar CSS
- app/naka-cult/landing.css:660-680 — orphaned .nakacult-hero__logo styles

**Dead crons (scheduled, never executed)**
- naka-cult-resolver (vercel.json:36) — entitlement grants/revokes; 0 runs
- cult-ape-open / cult-ape-resolve (vercel.json:42-43) — 0 runs
- cult-offering-draw (vercel.json:39) — 0 runs
- cult-signal-feed (vercel.json:41) — 0 runs
- cult-conviction-score (vercel.json:40) — 0 runs
- cult-refresh-treasury — runs only hit env_unset short-circuit; NULL placeholder

**Non-dead controls (verified wired — for the record):** Conclave Active/Passed/Failed/All tabs; Whisper Echo/Silence + submit buttons; Ape APE/NOPE buttons; Hall send; Conviction long/short + Post; Offering Enter; Echo seat/remove (but Chosen-gated → hidden for every non-Chosen member).

---

## Institutional 2030 redesign plan — the "$300 feel for $27" build list

**Foundation (truth + reliability before polish — you cannot make a frozen, lying product feel premium)**
1. **Cron health rail / "Sanctum Heartbeat":** a Bloomberg-terminal status strip (member-facing minimal + a dense `/admin/cult/crons` grid) showing last Seal, last Treasury snapshot, next Ape round, last membership verify — red "STALE" chip when max(completed_at) > 2x cadence. This single surface would have caught the 43-day outage instantly.
2. **REAL/STALE/EMPTY data badges on every stat cell** with a last-updated timestamp, so nothing can silently rot like the 52-day treasury row again.
3. **Kill-switch transparency:** when CRONS_PAUSED is on, show a quiet "rituals paused" banner rather than silently serving frozen state.

**3D-icon + identity system (replace the retired Chosen gamification)**
4. **One clean institutional "Member" sigil** — holdings-tier accenting (NIPPO vs NAKA-threshold) shown subtly, Phantom-minimal, not gold-cape. A "Why am I in?" provenance chip ("NIPPO #042" or "1.4M $NAKA — 17% above floor").
5. **Real 3D cosmetic assets:** ship actual SVG/Lottie frames, animated glows, rendered sigils (Arc/Linear craft) to replace the 17 CSS color dots; populate asset_url. Wire the equipped loadout into IdentityStrip, Hall/Conviction author chips, and the members directory so worn identity appears everywhere.

**Ddergo-player build (the biggest single "premium" lever — kill the Spotify iframe)**
6. **First-party Web Audio engine** with a custom transport (play/pause, prev/next, seekable progress with buffered ranges, volume/mute), now-playing art, a live queue reflecting display_order, keyboard shortcuts (space/←/→), and persistent cross-chamber playback (keep CultPlayer's mount-once pattern, swap the iframe).
7. **Real per-track audio pipeline:** owner MP3/stems in Supabase Storage (signed URLs gated by getCultAccess), durations from ffprobe, precomputed waveform peaks (SoundCloud-grade). Delete the 8 fabricated rows.
8. **Audio-reactive orb:** drive the orb from a Web Audio AnalyserNode amplitude instead of a static spin; real drag-and-drop curation (dnd-kit) that actually drives playback order.

**Live members-club surfaces (Bloomberg / Friend.tech / Polymarket feel)**
9. **Realtime everywhere it's expected:** publish cult_proposals/votes, cult_whispers/votes, cult_signals, cult_hall_messages, cult_ape_votes, cult_treasury_snapshots; subscribe via Supabase channels. Hall → sub-second chat with presence + typing; Pulse → instant "signal fired"; Ape → live sentiment orb; Conclave → optimistic vote orbs reconciled from the realtime payload.
10. **Live stats ticker** to replace the dead/zero strip: real treasury value (CoinGecko × on-chain balance) with freshness timestamp + sparkline, live member count, threshold proximity meter for connected non-members ("you are 84% of the way to entry").
11. **Wallet-connect "Enter NakaCult" command** on the landing: `useAppKit().open()` → live on-chain read → inline verdict ("Sigil recognized — 1.42M $NAKA, NIPPO held") → /vault, no platform login required.

**Per-chamber institutional depth**
12. **Conclave:** holdings-weighted voting with a "your voting power" panel, a stacked yes/abstain/no conviction bar, a quorum meter vs MIN_VOTERS_FOR_PASS, countdown to resolution, threaded comments, and a real (or removed) non-custodial stake/slash.
13. **Conviction/Ape:** per-member track-record ledger + hit-rate, resolution-moment animations (% counting up, win/loss), ranked leaderboards with rank-delta arrows and time-window tabs.
14. **Offering:** Open vs History split, countdown to closes_at, **crypto.randomInt** draw with a persisted, verifiable seed/proof badge.
15. **Oracle:** true token-streaming Sage (SSE/ReadableStream), freshness-aware Daily Seal (relative age + dawn-UTC countdown, never serve >48h as "today"), and a seal grounded in real top-movers/whale-flow/sentiment.

**Accessibility / craft**
16. **WCAG AAA token system:** bump every sub-14px muted text to ≥0.72 opacity / solid tokens (kill rgba(200,214,255,0.55) and #6B779C/#7F8AA8/#8C9AC0 small-text uses); enforce via design tokens. Fixed background aurora layer decoupled from scroll. Safe-area-inset for the player orb on mobile.

---

## Prioritized fix sequence (exact rebuild order)

**Phase 0 — Resurrect the pipeline (nothing else matters until this is done)**
1. Diagnose & re-enable the Vercel cron scheduler: check CRONS_PAUSED, CRON_SECRET rotation, and the cron-count limit (54 crons in vercel.json exceeds Hobby/Pro). Confirm the deploy adding ape/offering/signal/conviction/resolver crons actually shipped to main.
2. Add a cron health-watch (Sentry alert when any cult cron's max(completed_at) > 2x cadence) and log skipped/error branches, not just success.
3. Manually invoke naka-cult-resolver once; verify it grants the wallets in user_wallets_v2 and that on-chain membership replaces the legacy bootstrap.
4. Fix the invalid `MODEL='claude-opus-4-7'` to a verified current Anthropic id (with 529 retry/backoff) so the Daily Seal can regenerate.

**Phase 1 — Stop lying (data honesty)**
5. `CREATE OR REPLACE VIEW cult_stats`: active_members := count cult_member=true; compute or null-honestly total_naka_held; drop chosen_count. Mirror to supabase/migrations.
6. Add a Daily-Seal freshness guard (never serve >48h old as "today").
7. Delete the 4 symbol-keyed naka_trust_scores rows; reject non-address inputs in the route.
8. Treasury: set NAKA_TOKEN_CONTRACT + NAKA_TREASURY_WALLET and verify a real snapshot lands, OR hide the panel/cell until $NAKA mints (no NULL under "Live").
9. De-Spotify the library: either ingest real per-track audio or collapse to one honest playlist row; delete the 8 fabricated rows; remove the DB-table-name leak in the empty state.

**Phase 2 — Purge "Chosen" (one epic, not scattered edits)**
10. Decide the post-Chosen gate model first (collapse vote weight to 1 + open curation/echo/seal-draft/annals writes to all cult_members, OR a holdings/role gate). Then strip isChosen from access.ts, /api/cult/me, all ~12 routes, IdentityStrip, all panels (◈/gold), the "Chosen Seals" stat; delete useChosenStatus, ChosenLibraryCurator, ChosenSealDraftPanel; rename gold_ring + chosen_seal_written; ship a migration dropping/zeroing profiles.is_chosen and is_chosen vote columns. Keep vote-weight aggregates consistent (weight is captured at insert).

**Phase 3 — Unbreak navigation & realtime**
11. Remove the comingSoon flags so Conclave/Oracle/Sanctum become live `<Link>` tiles.
12. `ALTER PUBLICATION supabase_realtime ADD TABLE` for proposals, votes, whispers, signals, hall, ape_votes, treasury; set REPLICA IDENTITY FULL where filtered.
13. Rewrite all RLS read policies to gate on `cult_member=true` (Conclave, Ape — which currently has RLS enabled with zero policies — etc.) so realtime works for non-tier members.

**Phase 4 — Make governance/economics real**
14. Wire vote weight to resolveHoldings().nakaBalance + server-side sqrt scaling; snapshot onto the vote row. Fix quorum-vs-loss slashing (no slash on low turnout). Remove or back the stake/slash with real escrow.
15. Build the achievement-earning grant hooks at each action site (idempotent); set requires_achievement_code on premium cosmetics. Wire the loadout into every identity-render site.
16. Fix Ape token resolution to verify by contract address; make the resolve cron atomic (single RPC/transaction). Use crypto.randomInt + persisted proof for offering draws.

**Phase 5 — Streaming, grounding, and seed**
17. Convert Sage to true token streaming; ground the Daily Seal in real market/whale/sentiment data.
18. Seed (via real admin routes, no mocks) a first Offering + a few Pulse signals + Ape round so the 3 members don't land on a ghost town.

**Phase 6 — Premium build-out**
19. First-party Ddergo Web Audio player + real audio pipeline + audio-reactive orb (Phase 0 must have de-Spotify'd the data).
20. Live stats ticker, cron-health/heartbeat rail, threshold proximity meter, per-chamber track records/leaderboards, resolution-moment animations.
21. Wallet-connect "Enter NakaCult" landing flow.

**Phase 7 — Craft & cleanup**
22. WCAG AAA token system (lift all sub-14px muted text ≥7:1); fixed-layer aurora decoupled from scroll; safe-area-inset orb.
23. Delete all dead code: ~200 lines vault.css player CSS, both SubChamberPlaceholders, orphaned hero-logo CSS, the curl-only annals POST (or build its console), the unreachable per-track `<audio>` branch.
24. Route all address handling through lib/utils/addressNormalize; populate ERC-20 decimals from metadata; pin getCultThreshold reads with `.eq('id',1)`; reconcile EVM-only vs Solana grant paths; replace empty catch blocks with real toasts.

---

## Appendix: raw structured findings (per-agent JSON)

```json
[
  {
    "area": "NakaCult Landing Page (app/naka-cult/page.tsx + app/naka-cult/landing.css)",
    "summary": "The landing is visually polished but functionally login-coupled and brand-stale. All three known bugs CONFIRMED: (1) the primary conversion CTAs route into the platform via Link href=\"/vault\" and Link href=\"/dashboard/pricing\" instead of a wallet-connect \"Enter NakaCult\" button — the page is a fully server component with zero AppKit/wagmi wiring even though useAppKit().open() is the established repo pattern (WalletAuthButton, AppKitBridge). (2) The animated aurora (::after 38s rotate+scale) and three floating orbs live INSIDE the scrolling .nakacult-shell container as absolutely-positioned children, not in a position:fixed layer — overflow-anchor:none is a band-aid, not a fix. (3) Branding: the retired \"Chosen\" lineage survives in markup (nakacult-entry--chosen) and CSS, and access.ts still carries is_chosen/isChosen. On data: the Treasury stat is effectively FABRICATED-by-omission — the single snapshot row has balance_usd = NULL and is 52 days stale; member count and track count are REAL but tiny (3 cultists, 8 tracks); the 1.227M threshold is a hardcoded constant.",
    "findings": [
      {
        "severity": "P0",
        "title": "Primary CTAs are login-coupled Links into the platform, not a wallet-connect 'Enter NakaCult' button",
        "location": "app/naka-cult/page.tsx:54, :238, :240 (and member/non-member branches at :52-62, :237-241)",
        "dataVerdict": "N/A",
        "evidence": "page.tsx is `export default async function NakaCultLanding()` — a pure RSC with `import Link from 'next/link'` and NO client directive, no useAppKit, no wagmi. isMember branches render `<Link href=\"/vault\">Enter the Vault →</Link>` (lines 54, 238); the non-member final CTA renders `<Link href=\"/dashboard/pricing\">See the path →</Link>` (line 240). Membership is resolved server-side via getCultAccess() reading a Supabase session cookie (lib/cult/access.ts:80 supabase.auth.getUser) — so a wallet holder who is NOT logged into the platform sees only '#enter' anchors and a pricing link, never an on-chain check. The canonical wallet-connect pattern already exists in-repo: components/auth/WalletAuthButton.tsx:40 `const { open } = useAppKit()` + useAccount() from wagmi. The landing uses none of it.",
        "recommendation": "Replace the routing CTAs with a client 'Enter NakaCult' button that calls useAppKit().open(), then on connect reads on-chain NIPPO ownership + $NAKA balance (Alchemy for ETH mainnet ERC-721/ERC-20 per access.ts:8-9) and resolves cult membership from the connected wallet — independent of a platform login. Keep /vault as the post-verification destination only. The dashboard/pricing link must go entirely (cult is explicitly NOT a platform tier per the page's own FAQ at lines 209, 216)."
      },
      {
        "severity": "P1",
        "title": "Treasury stat renders a placeholder over NULL, 52-day-stale snapshot — not a live number",
        "location": "components/naka-cult/CultStatsStrip.tsx:59-66, :84-87; table cult_treasury_snapshots",
        "dataVerdict": "STALE",
        "evidence": "SQL `SELECT count(*), latest balance_usd, captured_at FROM cult_treasury_snapshots` returned exactly 1 row: captured_at = 2026-05-04 07:20:09Z (today is 2026-06-25 → ~52 days old) with balance_usd = NULL (column type numeric). The component coalesces null/0 to the '…' em-dash (line 84-86), so the UI shows '…' under a 'Live snapshot' sub-label — a live claim backed by a single null, never-refreshed row. The 'Treasury panel — real-time, on-chain' pillar copy (page.tsx:91) and 'on-chain treasury panel' FAQ (line 208) overpromise against this.",
        "recommendation": "Wire a real treasury read (Alchemy/CoinGecko price × on-chain balance) on a cron that writes fresh cult_treasury_snapshots rows, or remove the 'Live snapshot' label until it is genuinely live. Never present a 52-day-old NULL under a 'real-time' label."
      },
      {
        "severity": "P1",
        "title": "Animated aurora + floating orbs run inside the scroll container (not a fixed layer); overflow-anchor:none is a workaround",
        "location": "app/naka-cult/landing.css:6-19 (.nakacult-shell position:relative, overflow-anchor:none), :37-53 (::after 38s rotate+scale 1→1.12), :513-556 (.nakacult-orb-layer position:absolute + 22s/28s/26s orb drifts); page.tsx:33-37 orb layer markup",
        "dataVerdict": "N/A",
        "evidence": ".nakacult-shell is `position: relative; min-height:100vh` (not fixed). The aurora is its ::after pseudo at inset:-50% animating `transform: rotate()+scale(1.12)` for 38s (lines 37-60), and .nakacult-orb-layer is `position:absolute; inset:0` (line 513-519) — both paint within the same scrolling box as content (.nakacult-shell > * { z-index:1 }, line 54). The dev's own comment (lines 13-18) admits scroll-anchoring 'yanks the page upward mid-scroll' and disables it with overflow-anchor:none + history.scrollRestoration='manual' (confirmed in app/layout.tsx:127). That treats the symptom: a constantly-repainting transformed background inside scroll flow still forces composite/paint work tied to the scroll box and the will-change:transform layers stay tall for the full page height.",
        "recommendation": "Move the aurora ::after and the orb layer into a single `position: fixed; inset:0; z-index:-1; pointer-events:none` backdrop element rendered once behind the scroll content, so the background is decoupled from scroll geometry. Then overflow-anchor can stay default and scroll-anchoring works normally. Constrain animated transforms to a fixed viewport-sized layer rather than a 100vh+ growing container."
      },
      {
        "severity": "P1",
        "title": "Retired 'Chosen' lineage remnants in markup, CSS, and access types",
        "location": "app/naka-cult/page.tsx:169 (className nakacult-entry--chosen); landing.css:432-441; lib/cult/access.ts:44 (isChosen), :94 (select is_chosen), :117 (isChosen mapping)",
        "dataVerdict": "N/A",
        "evidence": "The NIPPO entry card hardcodes `className=\"nakacult-entry nakacult-entry--chosen\"` (line 169) and landing.css:433-441 defines `.nakacult-entry--chosen` gold styling. The 'Chosen' badge/lineage is retired per audit rules. access.ts still defines CultAccess.isChosen (line 44, comment 'Development NFT path → Chosen Seal benefits'), selects profiles.is_chosen (line 94), and maps it (line 117) — dead lineage plumbing feeding a landing that no longer should reference 'Chosen'.",
        "recommendation": "Rename the CSS modifier to a neutral emphasis class (e.g. nakacult-entry--primary or --nippo) and strip the --chosen naming. Remove isChosen from CultAccess and the is_chosen select in access.ts unless an active feature consumes it (grep shows the landing is the visible surface). Purge 'Chosen Seal' comments."
      },
      {
        "severity": "P2",
        "title": "Cultist and Soundtrack stats are REAL but trivially small; threshold is a hardcoded constant",
        "location": "CultStatsStrip.tsx:10 (NAKA_THRESHOLD=1_227_000), :52-56 (profiles cult_member), :68-74 (cult_ambient_tracks)",
        "dataVerdict": "REAL",
        "evidence": "SQL: profiles WHERE cult_member=true → 3 (of 16 total profiles); cult_ambient_tracks WHERE is_active=true → 8 (8 total). Both render real counts ('3', '8 tracks'). The 'Entry threshold' value 1.23M is derived from the hardcoded NAKA_THRESHOLD constant (line 10/91), not a DB/chain read — acceptable as a published rule, but it is a constant, not live config.",
        "recommendation": "Stats wiring is correct (em-dash on absence, no fabrication) — say so. But '3 Cultists' broadcasts an almost-empty club on a public landing; consider gating the member count until it is presentable, or framing it differently. Source NAKA_THRESHOLD from shared on-chain config (same constant access.ts references at line 9) to avoid drift between gate and marketing."
      },
      {
        "severity": "P2",
        "title": "Low-opacity body text fails WCAG AAA contrast on the dark navy canvas",
        "location": "landing.css:352 (rgba(200,214,255,0.55) stats__sub), :450 (entry__foot 0.55), :371/:422/:501 (rgba(200,214,255,0.78) body/faq), :790 vs bg #050816",
        "dataVerdict": "N/A",
        "evidence": "Background is #050816 (near-black navy, landing.css:9). Sub-labels and footers use rgba(200,214,255,0.55) — alpha-blended over #050816 this lands roughly mid-grey-blue, well under the 7:1 AAA threshold for normal text (and under 4.5:1 AA for the smallest 10-11px text at :352/:450). Body/FAQ text at 0.78 alpha and 13.5px is borderline at best for AAA. The audit mandate is WCAG AAA.",
        "recommendation": "Raise muted text to solid tokens with measured ≥7:1 contrast on #050816 (e.g. lighten to ~#9FB0D8 fully opaque for subs, ~#C8D6FF opaque for body) and avoid alpha on small type. Verify each with a contrast tool against #050816, not the lighter card gradients."
      },
      {
        "severity": "P3",
        "title": "Dead self-contained styling debt and a non-member CTA that contradicts the page's own copy",
        "location": "landing.css:1-4 / :660-680 (orphaned .nakacult-hero__logo JPG styles for an asset no longer used after LivingSigil rebrand); page.tsx:240",
        "dataVerdict": "N/A",
        "evidence": "landing.css:723 zeroes the old hero filter for the LivingSigil rebrand, yet :670-680 still ships .nakacult-hero__logo (mix-blend-mode JPG mask) for a mascot the rebrand replaced (no .nakacult-hero__logo element exists in page.tsx). The non-member final CTA 'See the path →' links to /dashboard/pricing (line 240) while FAQ lines 209 and 216 explicitly state the cult is NOT a platform tier and the pricing/Founder Pass is a different door — the CTA undercuts the page's own positioning.",
        "recommendation": "Delete the orphaned .nakacult-hero__logo block and the stale top-of-file 'merges independently of brand-foundation' comment debt. Point the non-member CTA at the wallet-connect flow (see P0), not pricing."
      }
    ],
    "deadControls": [
      "app/naka-cult/page.tsx:54 — 'Enter the Vault →' is a plain route Link, performs no on-chain verification (login-coupled)",
      "app/naka-cult/page.tsx:240 — non-member 'See the path →' routes to /dashboard/pricing, contradicting the cult-is-not-a-tier copy; should be wallet-connect",
      "app/naka-cult/page.tsx:59 — 'How to enter →' is only a #enter anchor; there is no actual connect action anywhere on the page",
      "CultStatsStrip Treasury cell — renders '…' over a NULL, 52-day-stale snapshot under a 'Live snapshot' label (effectively a dead/non-live stat)"
    ],
    "designUpgrades": [
      "Build a client 'Enter NakaCult' command — Phantom/AppKit-grade connect: useAppKit().open() → on connect, live-read NIPPO (ERC-721) + $NAKA balance via Alchemy, show an inline on-chain verdict ('Sigil recognized — 1.42M $NAKA, NIPPO held') before routing to /vault. No login required.",
      "Replace the static stats strip with a Bloomberg-Terminal-style live ticker: real treasury value (CoinGecko price × on-chain balance) with a freshness timestamp and sparkline, member count, and threshold — each cell badged REAL/STALE with last-updated time so nothing can silently rot like the 52-day treasury row.",
      "Promote the background aurora/orbs to a single fixed GPU-composited backdrop layer (decoupled from scroll), enabling buttery scroll with default overflow-anchor — match Arc/Linear's rock-steady animated backgrounds that never fight the scroll position.",
      "Members-club gating signal (Friend.tech/Bloomberg feel): when a connected wallet qualifies, morph the hero into a personalized state ('The Vault remembers you, <mantle>') driven by the live on-chain read, not a server cookie — make the door itself feel exclusive and instantaneous.",
      "Raise the entire muted-text palette to measured WCAG AAA on #050816 and ship a Linear-grade typographic scale; drop alpha on all sub-10-11px labels so the 'institutional 2030' surface reads crisp on OLED."
    ]
  },
  {
    "area": "NakaCult Access / Membership (gate logic, on-chain holdings, entitlements, daily resolvers)",
    "summary": "The gate itself is real and correctly wired: app/vault/layout.tsx server-side redirects non-members based on profiles.cult_member, and the on-chain reads are genuine Alchemy SDK + Helius DAS calls (no mocks). BUT the membership pipeline is effectively dead in production: the naka-cult-resolver cron has NEVER logged a single execution, cult-verify-membership ran only twice (last 2026-05-13), and ALL cron logging platform-wide stopped on 2026-05-13 — 6+ weeks stale vs today. Every one of the 3 current cult members is cult_source='legacy' (hand-granted via SQL), so zero members have ever been resolved on-chain. On top of that the public cult_stats view is broken against the decoupled model (counts a retired tier='naka_cult'), the threshold the live resolver uses is NOT the DB-editable one admins think they control, and the RETIRED \"Chosen\" concept is still load-bearing across 60+ files and the access gate's own return shape.",
    "findings": [
      {
        "severity": "P0",
        "title": "naka-cult-resolver cron has NEVER run — the daily on-chain entitlement sweep is non-functional",
        "location": "app/api/cron/naka-cult-resolver/route.ts:27; cron_execution_log",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT cron_name,count(*) ... WHERE cron_name ILIKE '%resolver%' OR ILIKE '%naka%' → [] (zero rows). The grouped cult-% query returns rows for cult-generate-daily-seal, cult-refresh-treasury, cult-resolve-proposals, cult-verify-membership — but naka-cult-resolver is entirely absent from 14,385 log rows. It IS wired in vercel.json:36 (13 3 * * *). So either it has thrown before logCronExecution on every single invocation, or Vercel never scheduled it / deployment predates it.",
        "recommendation": "This is the cron that actually persists NIPPO/NAKA/Founder entitlements via applyWalletEntitlements. Confirm it is deployed and authorized (verifyCron), add a startup log row, and backfill: run it manually once and confirm cultGranted/maxGranted reflect the 5 wallets in user_wallets_v2. Until it runs, no wallet can ever earn cult access on-chain — only manual SQL grants work."
      },
      {
        "severity": "P0",
        "title": "Entire cron subsystem stopped logging on 2026-05-13 — membership is frozen/stale in prod",
        "location": "cron_execution_log (whole table); app/api/cron/cult-verify-membership/route.ts",
        "dataVerdict": "STALE",
        "evidence": "SELECT count(*),max(started_at) FROM cron_execution_log → {total:14385, latest:'2026-05-13 19:34:24Z'}. Today is 2026-06-25. cult-verify-membership: runs=2, last=2026-05-13 03:00. No cron of any kind has logged in 6+ weeks. Membership re-verification (revoke on balance drop / NFT sale) has not executed since mid-May.",
        "recommendation": "Investigate why all Vercel crons stopped (deploy paused, CRON_SECRET rotated, plan/cron-limit hit — vercel.json lists 54 crons which exceeds Hobby/Pro limits). Without this, a member who sells their NIPPO or drops below 1,227,000 NAKA retains Vault access indefinitely. Treat membership as security-relevant and alert on cron staleness."
      },
      {
        "severity": "P1",
        "title": "Zero members resolved on-chain — all cult members are manually-granted 'legacy'",
        "location": "profiles table; lib/cult/entitlements.ts:96",
        "dataVerdict": "STALE",
        "evidence": "SELECT ... FROM profiles → 3 cult_member=true rows, ALL with cult_source='legacy', is_chosen=true, cult_member_since=2026-06-21 12:47:30 (identical timestamp = bulk SQL insert). count FILTER (cult_member AND cult_source='legacy')=3 of 3. No row has cult_source IN ('nippo_nft','naka_holdings'). The real gate criterion (NIPPO NFT OR >=1,227,000 NAKA) has never produced a member.",
        "recommendation": "Acceptable ONLY as a pre-mint bootstrap, but the resolver (P0) must run before launch or the 'access iff holds NIPPO/NAKA' invariant is fiction. Document that legacy grants are intentional and add an admin view distinguishing legacy vs on-chain members."
      },
      {
        "severity": "P1",
        "title": "cult_stats.active_members is hardwired to a retired tier model → public counter permanently shows 0",
        "location": "DB view cult_stats; app/vault/page.tsx:134",
        "dataVerdict": "FABRICATED",
        "evidence": "pg_views definition: active_members = (SELECT count(*) FROM profiles WHERE tier='naka_cult'). The model was decoupled — cult membership is now profiles.cult_member, and no profile has tier='naka_cult' (all are 'max'/'free'). Live: SELECT * FROM cult_stats → {active_members:0, chosen_count:3, total_naka_held:null}. Truth: count FILTER(cult_member)=3. So /vault renders 'Active Cultists: 0' while 3 members exist.",
        "recommendation": "Rewrite the view: active_members = count(*) FILTER (WHERE cult_member). The 'THE CULT IS ALIVE' counter is the hero social-proof element and it is lying. P1 not P0 only because it's display, not access."
      },
      {
        "severity": "P1",
        "title": "total_naka_held is hardcoded NULL — '$NAKA Held' stat is permanently empty, never computed",
        "location": "DB view cult_stats (total_naka_held NULL::numeric); app/vault/page.tsx:135",
        "dataVerdict": "EMPTY",
        "evidence": "View definition literally selects 'NULL::numeric AS total_naka_held'. Live query confirms total_naka_held=null. The vault page passes this to CultStatsCounter as '$NAKA Held'. There is no aggregation of on-chain NAKA balances anywhere feeding this.",
        "recommendation": "Either compute it (sum resolved nakaBalance per member, persisted by the resolver cron once it runs) or remove the stat. Showing a blank '$NAKA Held' on a members-only flex screen reads as broken."
      },
      {
        "severity": "P1",
        "title": "Live resolver ignores the DB-editable threshold admins think they control",
        "location": "lib/cult/entitlements.ts:30; lib/cult/holdings.ts:35-54",
        "dataVerdict": "REAL",
        "evidence": "entitlements.ts (used by the daily naka-cult-resolver) sets NAKA_THRESHOLD = Number(process.env.NAKA_CULT_THRESHOLD ?? '1227000') — a module-load constant, never reads platform_settings.naka_threshold. holdings.ts (used by cult-verify-membership) DOES read platform_settings via getCultThreshold(). DB has platform_settings.naka_threshold=1227000 (verified). The two pipelines use different sources; /admin/cult edits hit the DB which only the verify cron honors, not the grant cron.",
        "recommendation": "Unify on getCultThreshold() (DB-driven) in entitlements.ts so admin threshold changes actually affect who gets granted. Right now the two crons can disagree on who qualifies."
      },
      {
        "severity": "P1",
        "title": "'Chosen' is RETIRED but still load-bearing across the access surface (column, hook, gate return type, vault stat, dedicated components)",
        "location": "lib/cult/access.ts:44,120; lib/hooks/useChosenStatus.ts; app/vault/page.tsx:137; app/vault/layout.tsx:30; components/vault/sanctum/ChosenLibraryCurator.tsx; components/vault/oracle/ChosenSealDraftPanel.tsx",
        "dataVerdict": "STALE",
        "evidence": "Grep for is_chosen|isChosen|Chosen returns 60+ files including the access gate (CultAccess.isChosen, holdings.isChosen, entitlements set is_chosen on Dev NFT path), a live API contract (/api/cult/me returns isChosen), useChosenStatus hook, IdentityStrip isChosen prop, and the vault 'Chosen Seals' counter. profiles.is_chosen=true on all 3 members. Per audit rules the Chosen badge/lineage is retired.",
        "recommendation": "Decide explicitly: if retired, strip isChosen from CultAccess/holdings/entitlements/api/cult/me, drop the 'Chosen Seals' stat, retire useChosenStatus and the Chosen* components, and migrate/zero profiles.is_chosen. If NOT actually retired for NakaCult, get that exception documented — but currently it contradicts the stated retirement and adds dead surface area."
      },
      {
        "severity": "P2",
        "title": "ERC-20 decimals never populated by getTokenBalances → resolver assumes 18 decimals for NAKA",
        "location": "lib/services/alchemy.ts:114-117; lib/cult/holdings.ts:122-123; lib/cult/entitlements.ts:69",
        "dataVerdict": "REAL",
        "evidence": "getTokenBalances maps only {contractAddress, tokenBalance} — it never sets decimals. holdings.ts does match.decimals ?? 18 (always 18). entitlements.ts hardcodes /1e18. If $NAKA mints with non-18 decimals, the balance and the 1,227,000 threshold comparison are wrong by orders of magnitude (could wrongly grant or deny access).",
        "recommendation": "Fetch token metadata (alchemy.core.getTokenMetadata) for NAKA_TOKEN once and use its real decimals, or assert NAKA is 18-decimals in a comment with the on-chain reference. Latent until mint, but it's an access-control correctness bug."
      },
      {
        "severity": "P2",
        "title": "holdings.ts getCultThreshold queries platform_settings without ordering/row-key → relies on single-row assumption",
        "location": "lib/cult/holdings.ts:41",
        "dataVerdict": "REAL",
        "evidence": ".from('platform_settings').select('naka_threshold').limit(1).maybeSingle() with no .eq('id',1) / no order. platform_settings currently has exactly 1 row (id=1, naka_threshold=1227000, verified), so it works today, but limit(1) without ORDER BY is non-deterministic if a second settings row ever appears.",
        "recommendation": "Pin the read with .eq('id', 1) or .order('id') so the threshold is deterministic. Minor given the singleton invariant, but cheap to harden."
      },
      {
        "severity": "P2",
        "title": "cult-verify-membership reads default_address but never normalizes; Solana members silently unsupported in entitlements path",
        "location": "app/api/cron/cult-verify-membership/route.ts:77; app/api/cron/naka-cult-resolver/route.ts:49,51",
        "dataVerdict": "REAL",
        "evidence": "naka-cult-resolver filters to EVM-only (/^0x.../ at :49) and lowercases at :51 — correct for EVM, and it explicitly excludes Solana, so a member whose only qualifying holding is a Solana NAKA mint (holdings.ts resolveSolana exists!) can never be granted by the daily resolver. The two code paths disagree on whether Solana counts. One wallet row (c7e14c76) has a solanaAddress that the resolver ignores.",
        "recommendation": "Reconcile: holdings.ts implements full Solana NAKA + Helius NFT resolution, but the authoritative grant cron (entitlements.ts/naka-cult-resolver) is EVM-only. Either wire Solana through applyWalletEntitlements or document that NakaCult is EVM-only and remove the dead Solana branch in holdings.ts."
      },
      {
        "severity": "P3",
        "title": "holdingsResolverEnabled gates cult-verify off env that the grant cron ignores → inconsistent enablement",
        "location": "lib/cult/holdings.ts:79-85; app/api/cron/cult-verify-membership/route.ts:37",
        "dataVerdict": "REAL",
        "evidence": "cult-verify-membership no-ops entirely unless NAKA_TOKEN_CONTRACT/GEM/DEV_NFT env is set (holdingsResolverEnabled). But naka-cult-resolver/entitlements.ts has hardcoded contract defaults (0x6941... NIPPO, 0x6967... NAKA) and runs regardless. So verification (revocation) can be OFF while granting is ON — members can be granted on-chain but never re-verified/revoked.",
        "recommendation": "Use one consistent enablement signal. If contracts are baked into entitlements.ts as live defaults, drive cult-verify off the same constants rather than separate NAKA_TOKEN_CONTRACT env, so grant and verify enable together."
      }
    ],
    "deadControls": [
      "app/vault/page.tsx:134 'Active Cultists' counter — wired to cult_stats.active_members which filters retired tier='naka_cult', permanently renders 0 despite 3 real members",
      "app/vault/page.tsx:135 '$NAKA Held' counter — cult_stats.total_naka_held is hardcoded NULL::numeric, always blank",
      "app/vault/page.tsx:137 'Chosen Seals' counter — surfaces a RETIRED concept (chosen_count=3)",
      "app/admin/cult threshold editor (platform_settings.naka_threshold) — honored by cult-verify but IGNORED by the actual grant resolver (entitlements.ts uses an env constant), so editing it does not change who gets granted",
      "naka-cult-resolver cron entry vercel.json:36 — scheduled but has zero execution history; effectively dead",
      "Solana resolution branch in holdings.ts:145 resolveSolana — never reached by the authoritative grant cron (EVM-only), and a member's solanaAddress in user_wallets_v2 is dropped"
    ],
    "designUpgrades": [
      "Live membership ledger panel in /admin/cult: per-member row showing wallet, resolved on-chain NAKA balance (real Alchemy read), NIPPO/Founder NFT booleans, cult_source (legacy vs nippo_nft vs naka_holdings), and last-verified timestamp — so an operator can see at a glance that 3/3 members are legacy and 0 are on-chain. Bloomberg-terminal density, monospaced figures.",
      "Realtime gate state via Supabase Realtime on profiles.cult_member: when the resolver flips a member, the Vault IdentityStrip and the public 'CULT IS ALIVE' counters update without reload (currently force-dynamic page reads a stale view).",
      "Cron health surface for the membership pipeline: a small SLA card (Linear-style) showing last successful run of cult-verify-membership and naka-cult-resolver with red/amber/green; today both would scream red (6+ weeks / never). Alert to Sentry when >26h since last success.",
      "Replace the broken cult_stats view with a materialized, on-chain-backed stats job that sums real resolved NAKA across members for '$NAKA Held', counts cult_member for 'Active Cultists', and drops 'Chosen Seals' entirely — Friend.tech-style flex numbers that are actually true.",
      "Member-facing 'Why am I in?' provenance chip in IdentityStrip: shows the exact qualifying condition (e.g. 'NIPPO #042' or '1.4M $NAKA — 17% above floor') sourced from the resolver, Phantom-style clarity, with WCAG AAA contrast on the gold/blue vault palette.",
      "Threshold proximity meter on /naka-cult for non-members who connected a wallet: real-time Alchemy read of their NAKA balance vs the live DB threshold, showing 'you are 84% of the way to entry' — converts near-qualifiers, an Arc-grade onboarding moment."
    ]
  },
  {
    "area": "Vault Shell & Navigation (app/vault/layout.tsx, app/vault/page.tsx, vault.css, ChamberPortal, VaultEntryAnimation, IdentityStrip, CultStatsCounter)",
    "summary": "The shell is visually polished and the entry cinematic, aurora, and player styling are genuinely strong, but the navigation is fundamentally broken: the three flagship chambers (Conclave, Oracle, Sanctum) are FULLY BUILT working routes yet hard-coded comingSoon on the index, so they render as dead non-clickable tiles — the Vault's core nav is unreachable from its own home. The \"THE CULT IS ALIVE\" stats counter is partly broken and partly stale: active_members reads 0 (the cult_stats view filters on tier='naka_cult' but real members are gated on profiles.cult_member, of which 3 exist), total_naka_held is HARDCODED NULL in the view so it can never show a real number, and the whole row leans on the RETIRED \"Chosen\" concept which still pervades the shell (IdentityStrip renders a literal \"Chosen\" badge). No fabricated numbers reach the UI (nulls render em-dashes), but the pipeline is disconnected from reality.",
    "findings": [
      {
        "severity": "P0",
        "title": "Three flagship chambers are fully built but marked comingSoon — dead, unclickable tiles; core nav unreachable",
        "location": "app/vault/page.tsx:59-82 (comingSoon on Conclave/Oracle/Sanctum) vs app/vault/conclave/page.tsx:1-39, app/vault/oracle/page.tsx:1-7, app/vault/sanctum/page.tsx",
        "dataVerdict": "N/A",
        "evidence": "ChamberPortal.tsx:59-61 renders comingSoon tiles as <div aria-disabled='true' className='cursor-not-allowed'> with NO Link — the href is discarded. Yet /vault/conclave renders <TreasuryPanel/> + <ConclaveClient/> (real voting), /vault/oracle renders <OracleHubClient/>, /vault/sanctum renders <SanctumHubClient/>. These routes are live and functional. So the three primary chambers cannot be reached from the Vault home at all.",
        "recommendation": "Remove the comingSoon flag from all three primary chambers in page.tsx:59-82 so they become live <Link> tiles. If any sub-feature is genuinely unfinished, gate that inside the chamber, not the whole portal. Dead 'cursor-not-allowed' tiles on a members-only product read as broken."
      },
      {
        "severity": "P0",
        "title": "active_members stat reads 0 while 3 real members exist — cult_stats view filters on the wrong column",
        "location": "view public.cult_stats (active_members subquery) consumed at app/vault/page.tsx:26,134",
        "dataVerdict": "STALE",
        "evidence": "pg_get_viewdef(cult_stats) shows: active_members = (SELECT count(*) FROM profiles WHERE tier='naka_cult'). But the access gate lib/cult/access.ts:105 uses profiles.cult_member=true. Live: SELECT count(*) FROM profiles WHERE cult_member=true = 3; SELECT count(*) FROM profiles WHERE tier='naka_cult' = 0 (the 3 members all have tier='max'). So the 'Active Cultists' counter animates to 0 while the cult demonstrably has 3 members.",
        "recommendation": "Redefine the view's active_members as count(*) FROM profiles WHERE cult_member=true to match the actual entitlement column. The tier ladder and cult membership are explicitly decoupled (per access.ts header comment), so keying the stat off tier is a guaranteed-zero bug."
      },
      {
        "severity": "P0",
        "title": "$NAKA Held counter is permanently dead — total_naka_held is hardcoded NULL in the view",
        "location": "view public.cult_stats: 'NULL::numeric AS total_naka_held'; rendered at app/vault/page.tsx:42,135 and CultStatsCounter.tsx:85",
        "dataVerdict": "EMPTY",
        "evidence": "View definition literally selects NULL::numeric AS total_naka_held. Live SELECT * FROM cult_stats returns total_naka_held: null. page.tsx:42 then sets totalNaka=null, and CultStatsCounter renders '—'. cult_treasury_snapshots has 0 rows, so there is no on-chain NAKA aggregation feeding this anywhere. The '$NAKA Held' tile will ALWAYS show an em-dash. This is not fabricated (good) but it is a permanently dead stat masquerading as a live one.",
        "recommendation": "Either wire total_naka_held to a real aggregation (sum of cult members' on-chain $NAKA balance via Helius/Alchemy, persisted to cult_treasury_snapshots by a cron) and have the view read the latest snapshot, or remove the tile entirely. Shipping a hardcoded-NULL stat in a 'THE CULT IS ALIVE' strip is dishonest UX."
      },
      {
        "severity": "P1",
        "title": "RETIRED 'Chosen' badge/lineage still rendered in the shell and surfaced as a live stat",
        "location": "components/vault/IdentityStrip.tsx:6,11,14,17,23,28; app/vault/layout.tsx:30; app/vault/page.tsx:137; cult_stats.chosen_count; plus ~10 components under components/vault/{oracle,sanctum,commons}",
        "dataVerdict": "REAL",
        "evidence": "Prompt states the Chosen badge/lineage is RETIRED. IdentityStrip.tsx:28 renders {isChosen ? 'Chosen' : 'Cultist'} and a gold .vault-identity--chosen trim (vault.css:96-100). layout.tsx:30 passes access.isChosen. page.tsx:137 surfaces 'Chosen Seals' = chosen_count. Live: SELECT count(*) FROM profiles WHERE is_chosen=true = 3 — so a retired concept is being shown as a headline stat. Grep found Chosen remnants across IdentityStrip, ApePanel, ConvictionPanel, HallPanel, ChosenSealDraftPanel, EchoChamberPanel, ChosenLibraryCurator, AnnalsPanel.",
        "recommendation": "Strip the Chosen tier from the shell: drop isChosen from IdentityStrip/layout, remove the 'Chosen Seals' stat and the .vault-identity--chosen CSS. If a single member rank is still desired, base it on a current concept (NIPPO NFT vs NAKA-balance path) not the retired Chosen lineage. This is a cross-cutting cleanup beyond the shell but the shell is where it is most visible."
      },
      {
        "severity": "P1",
        "title": "Decrees Passed is honestly 0 but the entire governance pipeline is empty — stats strip looks dead",
        "location": "app/vault/page.tsx:136; cult_stats.decrees_passed; tables cult_proposals (0 rows)",
        "dataVerdict": "EMPTY",
        "evidence": "Live: SELECT count(*) FROM cult_proposals = 0; decree_rows = 0; cult_treasury_snapshots = 0 rows. cult_stats.decrees_passed = 0. So of the 4 counters, three (active_members, total_naka_held, decrees_passed) resolve to 0/null and only chosen_count (a retired concept) shows a number. The 'THE CULT IS ALIVE' strip currently reads: —, —/0, 0, 3. That is the opposite of 'alive'.",
        "recommendation": "Not a code bug — the data is genuinely empty. But shipping this strip now makes the Vault feel dead. Either seed real governance/treasury pipelines before exposing the strip, or hide individual tiles that have no data rather than animating them to zero (a 0 that count-ups from 0 is indistinguishable from a broken counter)."
      },
      {
        "severity": "P2",
        "title": "Ape page subtext #8C9AC0 fails WCAG AAA on the card background",
        "location": "app/vault/ape/page.tsx:12 (text-[#8C9AC0] at text-sm)",
        "dataVerdict": "N/A",
        "evidence": "Computed contrast: #8C9AC0 on #050816 = 7.12 (passes AAA on pure shell bg) but on the portal/card surface (~#0A0F2E) = 6.69, below the AAA 7.0 threshold for normal-size text. Other shell colors pass AAA: #B4C0E0=10.98, #D5DEFF=14.93, #00C8FF=10.17, #FFD86B=14.52, #9FB8FF=10.23.",
        "recommendation": "Lighten #8C9AC0 to >= #9AA8CC (or only use it on the darkest shell bg, never on the lighter glass cards). Audit all #8C9AC0 usages across vault subpages — it's the one shell color that dips under AAA."
      },
      {
        "severity": "P2",
        "title": "VaultEntryAnimation cinematic gates the whole Vault behind a fixed full-screen overlay with timer-only dismissal",
        "location": "components/vault/VaultEntryAnimation.tsx:42-52,75; vault.css:275-286 (.vault-entry z-index:9999 position:fixed inset:0)",
        "dataVerdict": "N/A",
        "evidence": "On first visit the overlay covers the viewport for 2.8s (z-index 9999, full inset) and only resolves via setTimeout or a click-to-skip. The page content (including the broken stats and dead tiles) is fully obscured until then. localStorage 'naka_vault_entered' persists, so it's once-per-device, but a 2.8s blocking gate on every cold load is heavy for a members tool. No keyboard-dismiss (Esc) — only pointer click on the button; the aria-label exists but there's no focus management/trap.",
        "recommendation": "Add Esc-to-skip and ensure the skip button receives focus on mount. Consider shortening the first-run to ~1.8s. The cinematic is well-built but it should never block interaction longer than necessary on a daily-use members product."
      },
      {
        "severity": "P3",
        "title": "Vault aurora uses a perpetual 30s conic-gradient rotation on a -50% inset layer — continuous compositor work",
        "location": "app/vault/vault.css:31-43 (.vault-shell::after, animation: vault-drift 30s linear infinite) + 144-147 portal-breathe + 879-882 orb spin",
        "dataVerdict": "N/A",
        "evidence": "The ::after layer is inset:-50% (so 4x viewport area) running an infinite transform: rotate+scale, plus every ChamberPortal runs vault-portal-breathe (infinite scale) and the player orb spins. These are transform/opacity (compositor-friendly) and reduced-motion is honored (vault.css:356-365), so it's not a correctness bug, but multiple always-on infinite animations on a 4x-oversized layer is needless battery/GPU draw on a page that is otherwise static.",
        "recommendation": "Cap the aurora layer to the viewport (inset:0 with overflow hidden already on shell), or pause vault-drift when the tab is hidden (document.hidden) / when the entry overlay is up. Low priority — verify on a low-end device before optimizing."
      }
    ],
    "deadControls": [
      "app/vault/page.tsx:59-66 — 'The Conclave' tile: comingSoon, non-clickable, but /vault/conclave is fully built and live (DEAD)",
      "app/vault/page.tsx:67-74 — 'The Oracle' tile: comingSoon, non-clickable, but /vault/oracle (OracleHubClient) is fully built (DEAD)",
      "app/vault/page.tsx:75-82 — 'The Sanctum' tile: comingSoon, non-clickable, but /vault/sanctum (SanctumHubClient) is fully built (DEAD)",
      "app/vault/page.tsx:135 — '$NAKA Held' stat: permanently '—' (view hardcodes total_naka_held NULL) (DEAD COUNTER)",
      "app/vault/page.tsx:134 — 'Active Cultists' stat: always 0 due to wrong-column filter in cult_stats view while 3 members exist (BROKEN COUNTER)",
      "components/vault/IdentityStrip.tsx:28 — 'Chosen' rank badge: renders a RETIRED concept (should be removed)"
    ],
    "designUpgrades": [
      "Make the three chamber portals live links with a real lock state only for genuinely unbuilt sub-features; add a subtle 'last activity' line per chamber (e.g. 'Conclave — 2 open Decrees', 'Oracle — Seal posted 3h ago') pulled live, Linear/Bloomberg-style, so the home is a status surface not a static menu.",
      "Replace the dead/zero stats strip with a real-time members ticker: live active-member count (from cult_member=true), treasury $NAKA value from an on-chain snapshot cron, and a sparkline of member growth — animate only when the underlying number actually changes (Phantom/Bloomberg pattern), never count-up from 0 on a 0 value.",
      "Add a persistent left rail or command-K palette (Linear/Arc) for cross-chamber navigation so members aren't forced back to /vault to switch chambers; the current model is home -> chamber -> back-link only.",
      "Tighten the IdentityStrip into a real identity HUD: avatar/ENS-style handle, current rank tied to a live entitlement (NIPPO NFT vs NAKA balance), and presence ('142 cultists online') sourced from realtime — drop the retired Chosen gold-trim.",
      "Add realtime presence + unread indicators on the Commons tiles (Hall has messages, Offering has an active raffle) via Supabase realtime, so the Vault home breathes with live cult activity instead of static glass cards — the friend.tech/members-club expectation.",
      "Fix the $NAKA tile to show treasury value with a 24h delta and a 'verify on-chain' link to the actual wallet (non-custodial trust signal), instead of an em-dash."
    ]
  },
  {
    "area": "CONCLAVE governance (Decrees/proposals) — app/vault/conclave/* + app/api/cult/proposals/*",
    "summary": "Proposal creation and voting ARE wired end-to-end through real Supabase tables via the service-role admin client (cult_proposals, cult_proposal_votes), and the GET/POST/vote/votes routes, the create modal, the vote buttons, the resolver cron (every 10 min, registered in vercel.json), and tab filters all function. BUT the entire feature is unused: live DB shows 0 proposals, 0 votes, 0 comments, and the single treasury snapshot has NULL balances (source 'manual'). The headline claims are false: vote weight is NOT computed from real holdings — it is a hardcoded 1 (or 2 for \"Chosen\"), which is also a RETIRED-badge remnant that must be ripped out. The advertised \"realtime\" is DEAD: neither cult_proposals nor cult_proposal_votes is in the supabase_realtime publication, and the RLS read policy keys off profiles.tier='naka_cult' while the access gate grants membership via profiles.cult_member — a column mismatch that would silently block anon-client reads/realtime for legitimate members even if the publication were fixed.",
    "findings": [
      {
        "severity": "P0",
        "title": "Vote weight is FABRICATED — hardcoded 1/2, not real $NAKA holdings",
        "location": "app/api/cult/proposals/[id]/vote/route.ts:55-57",
        "dataVerdict": "FABRICATED",
        "evidence": "Line 57: `const weight = access.isChosen ? 2 : 1;` with comment 'Until the on-chain holdings read lands, weight is 1 per cultist'. No call to Alchemy/Helius balance read, no wallet_identities lookup. The UI (VoteOrbs.tsx:18 'sqrt-scaled so a whale's vote doesn't bury everyone', ProposalCard yes/no weight totals) and votes/route.ts:11 ('sized by sqrt(weight)') all advertise holdings-weighted governance that does not exist. DB cult_proposal_votes.weight is numeric but every cast write is literally 1 or 2.",
        "recommendation": "Read the voter's real $NAKA balance at cast time via Helius/Alchemy through lib/utils/addressNormalize (Solana case-sensitive — never .toLowerCase the mint/wallet), snapshot it onto the vote row, and apply the spec's sqrt scaling server-side. Until that is wired, the feature must not claim holdings-weighted voting in copy or orb sizing."
      },
      {
        "severity": "P0",
        "title": "'Chosen' badge/lineage is RETIRED but still drives vote weight and UI",
        "location": "app/api/cult/proposals/[id]/vote/route.ts:57,66,68; app/vault/conclave/VoteOrbs.tsx:8,84,89; lib/cult/access.ts:44,116 (isChosen)",
        "dataVerdict": "N/A",
        "evidence": "vote/route.ts grants double weight to access.isChosen and writes is_chosen to the vote row (DB column cult_proposal_votes.is_chosen boolean confirmed live). VoteOrbs.tsx:84 renders ` · Chosen` in the orb tooltip and :89 paints a gold `0 0 0 1.5px #FFD700` ring for is_chosen. The audit mandate states the Chosen badge/lineage is RETIRED.",
        "recommendation": "Remove isChosen from CultAccess, drop the double-weight rule, stop writing is_chosen, and strip the gold-ring/'· Chosen' rendering from VoteOrbs. Consider dropping the cult_proposal_votes.is_chosen column once code references are gone."
      },
      {
        "severity": "P0",
        "title": "\"Realtime\" subscriptions are DEAD — tables not in supabase_realtime publication",
        "location": "app/vault/conclave/ConclaveClient.tsx:51-59; app/vault/conclave/VoteOrbs.tsx:43-48",
        "dataVerdict": "N/A",
        "evidence": "SELECT schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('cult_proposals','cult_proposal_votes') returned [] (zero rows). Both client components subscribe to postgres_changes on these tables and the code comments claim realtime 'replaces the previous 10s polling loop' — but with neither table published, no change event ever arrives. Updates only appear on manual re-fetch (load on mount, visibilitychange, or onVoted callback).",
        "recommendation": "Add both tables to the supabase_realtime publication (ALTER PUBLICATION supabase_realtime ADD TABLE ...), or restore a polling fallback. Do not ship copy claiming realtime until the publication is verified live."
      },
      {
        "severity": "P0",
        "title": "RLS read policy keyed off wrong column (tier='naka_cult') vs access gate (cult_member) — silently breaks anon-client reads/realtime",
        "location": "DB policy cult_proposals_read / cult_votes_read; lib/cult/access.ts:92-105",
        "dataVerdict": "N/A",
        "evidence": "Live pg_policies qual: `auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.tier='naka_cult')`. But access.ts:105 grants membership via `profile.cult_member` and the file's own docstring says cult membership is 'fully decoupled from the platform tier ladder.' A member with cult_member=true but tier='pro'/'max'/'free' passes the API gate (admin client bypasses RLS) yet their browser anon-key client gets ZERO rows from the realtime payload and any direct client read. Inconsistent source of truth.",
        "recommendation": "Rewrite both RLS policies to gate on profiles.cult_member = true (matching the access gate), not tier='naka_cult'. This is required before realtime can work for non-tier members."
      },
      {
        "severity": "P1",
        "title": "Treasury panel data is EMPTY/placeholder — NULL balances, manual source, 7+ weeks stale",
        "location": "app/vault/conclave/TreasuryPanel.tsx:11-37; table cult_treasury_snapshots",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT * FROM cult_treasury_snapshots: single row {balance_naka:null, balance_usd:null, source:'manual', captured_at:'2026-05-04'}. Because balance_naka is null, fmtNum returns null and the panel renders the '—' em-dash; but since a snapshot row DOES exist, the '!snap' helper-text branch never shows, so the owner sees a silent '—' with no guidance. No on-chain treasury read pipeline (Helius/Alchemy) is connected.",
        "recommendation": "Wire a cron that reads the on-chain treasury wallet balance via Helius (SPL $NAKA) + price via CoinGecko/Jupiter and inserts real snapshots. Treat NULL-balance snapshots as 'no data' in the UI so the guidance text shows."
      },
      {
        "severity": "P1",
        "title": "Proposal/vote tables are completely EMPTY in production",
        "location": "cult_proposals, cult_proposal_votes",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT counts returned proposals:0, votes:0, comments:0. The pipeline is functional but has never been exercised in prod; the entire Conclave renders the 'The Conclave is silent' empty state for every member.",
        "recommendation": "Not a code defect per se, but governance is dead on arrival. Seed via real member activity (no mock rows — forbidden by CLAUDE.md) and verify the create→vote→resolve loop against a real member account before launch."
      },
      {
        "severity": "P2",
        "title": "stake_naka / slashing is cosmetic — no real $NAKA is staked or slashed",
        "location": "app/vault/conclave/CreateProposalModal.tsx:122-131; app/api/cult/proposals/route.ts:66; cron cult-resolve-proposals/route.ts:50",
        "dataVerdict": "FABRICATED",
        "evidence": "The modal lets the author type any stakeNaka number (0..1e9) with no balance check and no on-chain transfer; route.ts:66 stores it verbatim. Resolver:50 computes slashed_naka on a failed decree but only writes a number to a column — no tokens move, no escrow. This violates the non-custodial real-money mandate by presenting a fake economic stake.",
        "recommendation": "Either remove the stake/slash UI until a real non-custodial escrow (on-chain program / signed transfer) backs it, or label it explicitly as a non-binding reputation number. Do not present a fabricated token stake."
      },
      {
        "severity": "P2",
        "title": "Vote failures are silently swallowed — no user feedback",
        "location": "app/vault/conclave/ProposalCard.tsx:61-63",
        "dataVerdict": "N/A",
        "evidence": "catch block is empty with comment 'Swallow — toast can be added later.' A 409 'expired'/'closed' or 500 from the vote API leaves the button spinner reset with zero indication the vote failed. CLAUDE.md forbids empty catch blocks.",
        "recommendation": "Surface errors via a toast/inline message; map 409 expired/closed to a clear 'voting has ended' state and refresh the card status."
      },
      {
        "severity": "P3",
        "title": "Cinematic proposal-pass/fail sounds will never fire client-side due to dead realtime + resolver timing",
        "location": "app/vault/conclave/ConclaveClient.tsx:26-31",
        "dataVerdict": "N/A",
        "evidence": "Status-flip detection compares prevStatusRef across fetches and fires playSound on active→passed/failed. Resolution happens in a 10-min cron; with realtime dead (finding above), a flip is only observed if the user happens to re-fetch (visibilitychange/manual) in the window after resolution. In practice users rarely witness the transition, so the cinematic cue almost never plays.",
        "recommendation": "After fixing realtime, this becomes reliable. Optionally also detect newly-resolved proposals on the 'passed'/'failed' tabs, not just 'active'."
      }
    ],
    "deadControls": [
      "app/vault/conclave/ConclaveClient.tsx:51-59 — realtime channel on cult_proposals/cult_proposal_votes: DEAD (tables absent from supabase_realtime publication; verified via pg_publication_tables empty result)",
      "app/vault/conclave/VoteOrbs.tsx:43-48 — per-proposal realtime orb refresh: DEAD (same publication gap)",
      "app/vault/conclave/CreateProposalModal.tsx:122-131 — 'Stake $NAKA' input: COSMETIC (no balance check, no on-chain transfer; number is stored but no tokens move)",
      "app/vault/conclave/VoteOrbs.tsx:84,89 — 'Chosen' gold-ring/tooltip rendering: RETIRED remnant that should not exist",
      "app/vault/conclave/TreasuryPanel.tsx — Treasury figure: shows '—' from a NULL-balance manual snapshot; no on-chain pipeline feeds it",
      "app/vault/conclave/ConclaveClient.tsx:70-75 — Active/Passed/Failed/All tabs: WIRED and functional (status maps to API query), no dead tabs here"
    ],
    "designUpgrades": [
      "Replace fabricated weight=1/2 with a live holdings panel: at vote time fetch the member's real $NAKA balance (Helius) + voting power (sqrt-scaled) and show 'Your voting power: N $NAKA → W weight' before they cast — Bloomberg-terminal-grade transparency, no hidden math.",
      "Make the result bar a live quorum/threshold tracker: show MIN_VOTERS_FOR_PASS (5) progress, current yes>no margin, and a countdown to resolution with the exact resolver tick — Linear-style precision instead of a static percentage.",
      "Add an optimistic+realtime vote experience (after fixing the publication + RLS): orbs animate in instantly on cast and reconcile from the realtime payload, Phantom-grade snappiness; surface vote-change ('you can change your mind while active') as an explicit affordance.",
      "Treasury: build an on-chain treasury card with sparkline of snapshot history, $NAKA + USD via Jupiter/CoinGecko, holder/flow stats, and 'last synced N min ago' freshness — institutional members-club feel; gate behind cult_member, not tier.",
      "Proposal detail view with threaded cult_proposal_comments (table exists, 0 rows, currently unused in this UI) for deliberation — Friend.tech/members-club discussion depth rather than fire-and-forget cards.",
      "Stake/slash: either remove or back it with a real non-custodial escrow flow (signed transfer to a program/multisig) and show the locked stake + slash-risk explicitly; never present a fake economic commitment in a real-money product.",
      "WCAG AAA pass: #B4C0E0 secondary text on the dark portal background and the #FF6E8A 'no' label must be contrast-audited against AAA (7:1 body) — several muted labels (text-white/40 char counters, #B4C0E0/60 'No votes cast') will fail AAA."
    ]
  },
  {
    "area": "CONCLAVE — Treasury Panel, Weighted Voting, Conviction Scoring (app/vault/conclave + cult crons)",
    "summary": "The CONCLAVE is scaffolding, not a live product. The Treasury balance is NOT a real on-chain read in practice: the only DB row is a manual placeholder with NULL balance, the refresh cron is hard-gated off because NAKA_TOKEN_CONTRACT/NAKA_TREASURY_WALLET are unset, so the panel renders \"—\". Weighted voting is FABRICATED math: the vote endpoint hardcodes weight=1 (or 2 for \"Chosen\"), explicitly ignoring the on-chain $NAKA holdings resolver that already exists in lib/cult/holdings.ts — so \"weighted by holdings\" is a lie. Conviction scoring code is genuinely real (DexScreener entry + re-price, signed by direction), but the table is EMPTY (0 rows), so nothing is proven in production. On top of that the RETIRED \"Chosen\" badge is alive everywhere (is_chosen column, double-weight rule, gold-ring orb), and VoteOrbs' realtime subscription is dead because cult_proposal_votes isn't in the realtime publication.",
    "findings": [
      {
        "severity": "P0",
        "title": "Treasury balance is NOT a real on-chain read — only a NULL manual placeholder exists; refresh cron is hard-gated off",
        "location": "app/vault/conclave/TreasuryPanel.tsx:11-37; app/api/cron/cult-refresh-treasury/route.ts:33-45",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT count(*) FROM cult_treasury_snapshots = 1. SELECT balance_naka, balance_usd, source, notes FROM cult_treasury_snapshots => {balance_naka:null, balance_usd:null, source:'manual', notes:'Initial placeholder — to be replaced by treasury auto-refresh cron once NAKA_TREASURY_WALLET is set', captured_at:2026-05-04}. The cron (lines 36-45) returns skipped='env_unset' whenever NAKA_TOKEN_CONTRACT or NAKA_TREASURY_WALLET is missing — grep shows NAKA_TREASURY_WALLET is referenced only in the cron + handoff docs, never set. So the Alchemy/Helius read path (lines 51-67) has never executed in prod; the panel renders '—' (TreasuryPanel.tsx:55).",
        "recommendation": "This is not fabricated (it shows '—'), so it is honest-empty — but it is non-functional. Set NAKA_TOKEN_CONTRACT + NAKA_TREASURY_WALLET and let the cron populate real Alchemy/Helius balances, OR if $NAKA hasn't minted, gate the whole Treasury Panel behind holdingsResolverEnabled() so members don't see a permanent dash on a flagship 'Treasury' card. The DexScreener USD enrichment (route.ts:74-86) is correct and keyless — keep it."
      },
      {
        "severity": "P0",
        "title": "Weighted voting is FABRICATED — weight is hardcoded 1/2, NOT derived from live $NAKA holdings, despite the resolver existing",
        "location": "app/api/cult/proposals/[id]/vote/route.ts:55-71",
        "dataVerdict": "FABRICATED",
        "evidence": "Line 57: `const weight = access.isChosen ? 2 : 1;`. The comment (lines 16-19, 55-56) claims 'Until wallet_identities + on-chain balance reads are wired' weight is 1 — but lib/cult/holdings.ts:95-191 ALREADY resolves nakaBalance per wallet via Alchemy/Helius. So the spec's sqrt-scaled-by-holdings rule is unimplemented and the stored weight is a placeholder constant. VoteOrbs.tsx:20-23 then sqrt-scales this fake weight for orb size, and cult-resolve-proposals/route.ts:46-48 decides pass/fail on sum(fake weight). 0 votes and 0 proposals exist in the DB (SELECT count(*) FROM cult_proposal_votes = 0, cult_proposals = 0), so this has never produced a real outcome.",
        "recommendation": "Wire vote weight to resolveHoldings(wallet).nakaBalance (lib/cult/holdings.ts) using the user's verified wallet, then apply sqrt scaling server-side as the spec demands. Until that lands, the 'weighted voting' label in the UI is false advertising — either implement it or label votes as 1-member-1-vote. Remove the isChosen?2:1 branch entirely (see Chosen-retirement finding)."
      },
      {
        "severity": "P0",
        "title": "RETIRED 'Chosen' badge/lineage is alive across the voting + conviction pipeline",
        "location": "app/api/cult/proposals/[id]/vote/route.ts:57,68; app/vault/conclave/VoteOrbs.tsx:7,84,89; app/api/cult/conviction/route.ts:34-41; lib/cult/access.ts:44-45,120; cult_proposal_votes.is_chosen column",
        "dataVerdict": "REAL",
        "evidence": "Per the audit rules the 'Chosen' badge/lineage is RETIRED. Live remnants: cult_proposal_votes has an is_chosen boolean column (information_schema confirms), 3 of 16 profiles still have is_chosen=true (SELECT count(*) FILTER (WHERE is_chosen) FROM profiles = 3). Vote route writes is_chosen (line 68) and grants double weight to Chosen (line 57). VoteOrbs renders a gold ring + 'Chosen' tooltip for is_chosen votes (lines 84, 89). Conviction GET returns isChosen per author (route.ts:39-41). access.ts still exposes isChosen (line 45, 120).",
        "recommendation": "Purge the Chosen system: drop the isChosen?2 weight branch, stop writing is_chosen in the vote upsert, remove the gold-ring/`· Chosen` rendering in VoteOrbs (lines 84, 89), drop isChosen from the conviction author payload, and plan a migration to drop the is_chosen columns once no code reads them. Reset the 3 profiles.is_chosen=true."
      },
      {
        "severity": "P1",
        "title": "VoteOrbs realtime subscription is DEAD — cult_proposal_votes is not in the supabase_realtime publication",
        "location": "app/vault/conclave/VoteOrbs.tsx:42-48",
        "dataVerdict": "N/A",
        "evidence": "VoteOrbs subscribes to postgres_changes on table cult_proposal_votes (lines 45-47) and the comment promises 'refresh this proposal's orbs the instant a vote lands'. But SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('cult_proposal_votes',...) returned [] — the table is NOT published. The channel subscribes but will never receive events; orbs only update on mount-time fetch. Not realtime.",
        "recommendation": "ALTER PUBLICATION supabase_realtime ADD TABLE cult_proposal_votes (and set REPLICA IDENTITY FULL if filtering on proposal_id). Verify the same for any other Conclave table expected to be live. Until then, remove the misleading 'realtime' comment."
      },
      {
        "severity": "P2",
        "title": "Conviction scoring is REAL code but UNPROVEN — table is empty, leaderboard always blank",
        "location": "app/api/cron/cult-conviction-score/route.ts:31-55; lib/cult/convictionPrice.ts:24-52; app/api/cult/conviction/route.ts:56-71",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT count(*) FROM cult_convictions = 0, conv_scored = 0. The scoring logic is legitimately real: entry price captured via DexScreener resolveAssetPrice (convictionPrice.ts:24-42, uses getBestPair/searchPairs/deepestLiquidity — real keyless API), re-priced via currentPairPrice (getPair), score = signed move% (route.ts:47-48), only scores rows with a captured pair (never fake-scored, line 45 leaves unreachable pairs open). No mock data, no hardcoded numbers. But with 0 rows the GET leaderboard (status='scored' order by score) is permanently empty.",
        "recommendation": "No code fix needed — the pipeline is correct and DexScreener-backed. This is a cold-start/adoption problem: the feature has zero usage. If launching, seed nothing (correctly) but ensure the empty-state UI on the board/leaderboard reads as intentional, not broken."
      },
      {
        "severity": "P2",
        "title": "cult-resolve-proposals scheduled every 10 min but vercel.json comment in code says 'every 10 minutes' — fine; however MIN_VOTERS_FOR_PASS=5 will silently fail-and-slash low-turnout decrees",
        "location": "app/api/cron/cult-resolve-proposals/route.ts:10,46-50; vercel.json:38",
        "dataVerdict": "N/A",
        "evidence": "Line 48: passes requires voter_count >= 5 AND yes>no. Line 50: a failed 'decree' slashes the full stake_naka. With the current 16-profile member base and 0 proposals ever created, any real decree that gets <5 voters auto-fails AND slashes the proposer's stake purely for low turnout — a quorum failure punished as if the proposal lost. The math itself (yes>no on weight sums) is correct given the weights, but the weights are fake (see weighted-voting finding), so the slash would be based on fabricated weight totals.",
        "recommendation": "Distinguish 'failed quorum' (no slash) from 'voted down' (slash). Only slash when voter_count>=MIN AND no>=yes. Do not slash on quorum failure. Revisit once vote weights are real on-chain values."
      }
    ],
    "deadControls": [
      "VoteOrbs.tsx:42-48 — realtime subscription to cult_proposal_votes is dead (table not in supabase_realtime publication); orbs never live-update",
      "TreasuryPanel.tsx:34-67 — entire panel renders '—' permanently; cult-refresh-treasury cron no-ops (env_unset) so the on-chain read never runs",
      "vote/route.ts:57 — 'weighted by holdings' is non-functional; weight is a hardcoded 1/2 constant, holdings resolver in lib/cult/holdings.ts is never called from the vote path",
      "VoteOrbs.tsx:84,89 — 'Chosen' gold-ring + tooltip render path is a retired-system remnant"
    ],
    "designUpgrades": [
      "Treasury Panel (Bloomberg-Terminal grade): replace the single static snapshot with a live sparkline of cult_treasury_snapshots over 30/90d, a 6h-delta chip (▲/▼ since last snapshot), and a 'last verified on-chain' link to the treasury wallet on the relevant explorer. Show data provenance inline (Alchemy/Helius + DexScreener) per the source column. Never show a bare '—' on a flagship card — render a 'Treasury activating at $NAKA mint' state with the threshold.",
      "Voting (Linear/Phantom precision): once weights are real, show a stacked horizontal conviction bar (yes/abstain/no) with live weight totals, a quorum meter (voter_count vs MIN_VOTERS_FOR_PASS), and a countdown to ends_at. Surface each voter's sqrt-scaled weight on hover with their actual $NAKA holdings — that is the members-club flex.",
      "Conviction Board (Friend.tech/Bloomberg leaderboard): real-time P&L cards per open call (live move% vs captured entry via DexScreener), a reputation leaderboard ranked by realized score with win-rate and avg-move, and a 7-day 'resolving soon' rail. Add a per-member track record page — institutional members want accountability, not vibes.",
      "Realtime everywhere: publish cult_proposal_votes, cult_proposals, cult_treasury_snapshots to supabase_realtime so orbs, bars, and the treasury delta animate the instant state changes — the 2030 members-only feel is sub-second reactivity, not on-mount fetches.",
      "WCAG AAA: the #B4C0E0 on dark labels (TreasuryPanel '≈ $ USD', VoteOrbs 'No votes' at /60 opacity) likely fail AAA 7:1 — audit and lift contrast; the abstain orb (#B4C0E0) on the panel background is the worst offender."
    ]
  },
  {
    "area": "ORACLE Daily Seal + Sage AI (app/vault/oracle, components/vault/oracle, app/api/cult/oracle/*, cron cult-generate-daily-seal)",
    "summary": "The pipeline is genuinely wired to real Anthropic — the Daily Seal cron calls Opus 4.7 and persisted exactly ONE real row (2026-05-13, 185/251 tokens, authentic cinematic prose), and the Sage route calls Sonnet 4.6 with real per-message token accounting. No fabricated/hardcoded content anywhere. BUT it is effectively dead in production: the seal cron has not executed since 2026-05-13 (43 days stale as of 2026-06-25) so the Oracle is showing a six-week-old briefing, and cult_sage_messages is completely EMPTY (zero conversations ever). The retired \"Chosen\" lineage is also fully alive across the draft pipeline (ChosenSealDraftPanel, draft route, cron chosen-draft branch, is_chosen plumbing) in direct violation of the retirement rule, and the Sage is sold as \"streaming\" in the UI/persona but is actually a blocking single-shot call.",
    "findings": [
      {
        "severity": "P0",
        "title": "Daily Seal cron stopped running 43 days ago — Oracle shows stale six-week-old briefing",
        "location": "app/api/cron/cult-generate-daily-seal/route.ts:24-152; vercel.json:34 (schedule '0 7 * * *')",
        "dataVerdict": "STALE",
        "evidence": "SELECT ... FROM cult_daily_seals returned exactly 1 row: seal_date 2026-05-13, title 'The Wednesday That Walks With Wet Footprints', model claude-opus-4-7, input_tokens 185, output_tokens 251 — a REAL Anthropic generation. But today is 2026-06-25, so the seal is 43 days old. cron_execution_log for 'cult-generate-daily-seal' has only TWO entries ever: success 2026-05-13 07:00 (1 item) and failure 2026-05-12 (Anthropic 529 overloaded). Zero executions for the 43 days since. The GET /api/cult/oracle/daily-seal route returns the most-recent seal regardless of age, so DailySeal.tsx renders the 2026-05-13 briefing as if it were today's 'Daily Seal'. The cron is scheduled daily but the scheduler has clearly stopped firing (likely CRONS_PAUSED=true on Vercel, or crons disabled).",
        "recommendation": "Investigate why the Vercel cron stopped (check CRONS_PAUSED env, Vercel cron dashboard, and CRON_SECRET). Add a freshness guard: the daily-seal GET route should not silently serve a seal older than ~48h as 'today's' — either show the empty 'Oracle is silent' state or label the date prominently with relative age. Add a Sentry alert / monitor when no seal exists for today by 08:00 UTC. The 2026-05-12 529 failure also shows there is no retry/backoff on Anthropic overload — add one."
      },
      {
        "severity": "P0",
        "title": "Retired 'Chosen' lineage is fully live across the Daily Seal draft pipeline",
        "location": "components/vault/oracle/ChosenSealDraftPanel.tsx (whole file); app/api/cult/oracle/daily-seal/draft/route.ts:74-76 (chosen_only gate); app/api/cron/cult-generate-daily-seal/route.ts:44-88 (chosen_draft branch, model:'chosen'); lib/cult/access.ts:94,120 (is_chosen)",
        "dataVerdict": "REAL",
        "evidence": "Audit rule states the 'Chosen' badge/lineage is RETIRED and any remnant must be flagged. It is not retired in code: OracleHubClient.tsx:39 mounts <ChosenSealDraftPanel/>, which renders a gold-outlined 'Chosen path' panel gated on state.isChosen, posts to the draft route which rejects non-chosen with error 'chosen_only', and the cron consumes pending chosen drafts and writes them with model:'chosen' and context_json.source:'chosen_draft'. access.ts selects is_chosen from profiles and exposes access.isChosen. Live DB confirms the plumbing is active and not dead config: SELECT count(*) FILTER (WHERE is_chosen) FROM profiles = 3 chosen of 16 total profiles. So 3 real users currently see the retired Chosen authoring surface.",
        "recommendation": "Remove the entire Chosen draft pathway from the Oracle: delete ChosenSealDraftPanel.tsx and its mount in OracleHubClient.tsx, remove the chosen_draft branch (lines 44-88) from the cron, and remove the chosen_only gate + isChosen from the draft route and access.ts (or replace with the current non-lineage role model). If member-authored seals are still a desired feature, re-introduce them under the current (non-Chosen) membership semantics, not the retired lineage."
      },
      {
        "severity": "P1",
        "title": "Sage AI is sold as 'streaming'/'the oracle's voice' but is a blocking single-shot call — and has never been used",
        "location": "app/api/cult/oracle/sage/route.ts:123-128 (client.messages.create, non-streaming); components/vault/oracle/VtxSagePanel.tsx:128-132 ('The Sage listens…' fake stream affordance)",
        "dataVerdict": "EMPTY",
        "evidence": "The Sage route does a real but NON-streaming Anthropic call (claude-sonnet-4-6, max_tokens 800) and persists both turns with real token counts. The assignment asks whether Sage streams a real model or is stubbed: it is a real model, but NOT streamed — it is a single blocking messages.create, so the whole reply lands at once after a multi-second pause while VtxSagePanel shows a static 'The Sage listens…' line. SELECT role,count(*),model FROM cult_sage_messages returned [] — the table is completely EMPTY: zero user messages, zero assistant replies, zero tokens ever recorded. The feature is wired and reachable but has never been exercised in production.",
        "recommendation": "Either (a) convert to true streaming with client.messages.stream() + an SSE/ReadableStream response and render tokens incrementally in VtxSagePanel (matches the 'oracle voice' UX and the per-skill streaming guidance), or (b) drop the 'listens…'/streaming framing and show an honest pending state. Given it is non-custodial members-only product polish, real token streaming is the 2030-tier expectation. Also confirm the feature is discoverable — an empty table after weeks live suggests the entry point is buried or the panel is being hidden by the messages===null early-return."
      },
      {
        "severity": "P2",
        "title": "Optimistic Sage UI desyncs from server on error (user turn persisted server-side but rolled back in UI)",
        "location": "components/vault/oracle/VtxSagePanel.tsx:67-73",
        "dataVerdict": "N/A",
        "evidence": "On a failed POST the panel comments that it rolls back the optimistic user turn 'so the user can retry; the server already persisted it' — but the code only returns early without removing the optimistically appended userMsg, so the message stays in the list. Meanwhile the route (sage/route.ts:102-107) DID insert the user turn before the Anthropic call. On reload, GET returns that orphaned user turn with no assistant reply, producing an incoherent history (a user message followed by nothing, or by the next attempt). The comment and the code disagree.",
        "recommendation": "Decide one contract: either do NOT persist the user turn until the assistant reply succeeds (move the insert after a successful Anthropic call, accepting the documented input-loss risk), or keep persisting but make the UI reload-consistent by not rolling back and instead surfacing a retry affordance on the orphaned turn. Reconcile the comment with the actual behavior."
      },
      {
        "severity": "P3",
        "title": "Daily Seal cron context is a hardcoded placeholder prompt — no real market/narrative data injected",
        "location": "app/api/cron/cult-generate-daily-seal/route.ts:18-20 (comment), 96-104 (userPrompt)",
        "dataVerdict": "REAL",
        "evidence": "The generation is real Anthropic, but the prompt is a generic 'generate a cinematic morning briefing' with only the date — the cron's own docstring admits 'curated context (placeholder for now — future revision will inject top-tickers / narrative / sentiment from the existing analytics endpoints)'. So the seal is genuine model output but ungrounded in any live on-chain/market data (CoinGecko, DexScreener, sentiment). This is not fabricated data, but it is a thin, context-free briefing for a product that has real analytics pipelines available.",
        "recommendation": "Inject real context into the prompt: top movers from CoinGecko/DexScreener, cult whale activity, and sentiment from the existing analytics endpoints, so the Daily Seal is grounded rather than free-floating poetry. This is the difference between a horoscope and a Bloomberg-tier morning note."
      },
      {
        "severity": "P3",
        "title": "Dead SubChamberPlaceholder component left in OracleHubClient",
        "location": "components/vault/oracle/OracleHubClient.tsx:49-61",
        "dataVerdict": "N/A",
        "evidence": "SubChamberPlaceholder is defined but never rendered (all real panels — VtxSagePanel, WhisperNetworkPanel, EchoChamberPanel — are now mounted directly at lines 41-43). The function and the stale header comment ('three styled placeholder cards') are leftover scaffolding.",
        "recommendation": "Delete the unused SubChamberPlaceholder function and update the component docstring to reflect that all sub-chambers now ship real panels."
      }
    ],
    "deadControls": [
      "components/vault/oracle/DailySeal.tsx:57-63 — 'Re-seal' button works but only toggles local cosmetic state; combined with the 43-day-stale seal it lets users 're-seal' a six-week-old briefing as if it were today's",
      "components/vault/oracle/VtxSagePanel.tsx:128-132 — 'The Sage listens…' is a static label implying streaming; no tokens stream (single blocking call), so it is a misleading affordance",
      "components/vault/oracle/OracleHubClient.tsx:49-61 — SubChamberPlaceholder defined but never invoked (dead code)",
      "components/vault/oracle/ChosenSealDraftPanel.tsx (entire panel) — functional but is a RETIRED-lineage surface that should not exist; effectively a control that must be removed"
    ],
    "designUpgrades": [
      "Real token streaming for the Sage: convert sage/route.ts to client.messages.stream() over an SSE/ReadableStream and render incremental tokens in VtxSagePanel — an institutional members-club 'oracle voice' should type out, not freeze on 'listens…' then dump a paragraph.",
      "Freshness-aware Daily Seal: surface the seal's age (relative time + UTC date), and when no seal exists for today render the existing 'Oracle is silent' state instead of silently serving a 43-day-old seal as 'Daily'. Add a dawn-UTC countdown to the next seal (Linear/Arc-grade temporal clarity).",
      "Ground the seal in live data: inject top movers (CoinGecko/DexScreener), cult whale flow, and sentiment into the Opus prompt so the briefing reads like a Bloomberg Terminal morning note rather than a context-free horoscope.",
      "Operational reliability: Sentry monitor when today's seal is missing by 08:00 UTC, plus retry/backoff on the Anthropic 529 path (the 2026-05-12 run already failed once on overload with no retry).",
      "WCAG AAA contrast pass on the Oracle palette: secondary text #B4C0E0 and #7F8AA8 on the dark #0b1022 surfaces (DailySeal.tsx, VtxSagePanel.tsx) should be re-checked against AAA (7:1) — the muted #7F8AA8 timestamps/counters in particular risk failing.",
      "Persisted, multi-device Sage history with a real conversation list (Phantom/Friend.tech-tier): the table supports it but the UI only shows a single rolling thread — add session framing and the empty-state 'speak first' as an intentional ritual, not a fallback."
    ]
  },
  {
    "area": "ORACLE Whisper Network (claimed \"E2E DMs\") + Echo Chamber — components/vault/oracle/{WhisperNetworkPanel,EchoChamberPanel}.tsx + app/api/cult/oracle/{whispers,echo} routes",
    "summary": "The \"E2E encrypted DMs\" framing is fiction: there is no encryption, no key material, no crypto primitive, and no direct-message/recipient concept anywhere in the oracle code — `cult_whispers.body` is a plain `text` column and the whole feature is a PUBLIC anonymous broadcast board with echo/silence voting. The backend constraints (composite vote PK, partial unique index on echo-wallet position, recount-from-source tallying, server-side self-vote block) are genuinely well-built and correct. BUT: both live tables are 100% EMPTY (0 whispers, 0 votes, 0 echo wallets), nothing is realtime (no Supabase realtime publication on any of the three tables; the UI only re-fetches after your own action — no interval poll, no channel, so other members' whispers/votes never appear until you reload), and the Echo Chamber is built entirely around the RETIRED \"Chosen\" badge — it literally renders \"Chosen path — seat a new wallet\" and gates all writes on `isChosen`. Vote buttons themselves are wired and functional, not dead.",
    "findings": [
      {
        "severity": "P0",
        "title": "\"E2E encryption\" is a pure label — zero crypto, plaintext storage, no DM concept",
        "location": "app/api/cult/oracle/whispers/route.ts:84-94 (insert body plaintext); cult_whispers.body is data_type text",
        "dataVerdict": "FABRICATED",
        "evidence": "Grep for encrypt|decrypt|cipher|nonce|publicKey|crypto.subtle|nacl|libsodium|e2e across components/vault/oracle returned 'No matches found'. information_schema shows cult_whispers columns = id,author_id,body(text),status,echo_count,silence_count,created_at,resolved_at — no ciphertext/nonce/sender_pubkey/recipient column exists. The route stores `body` exactly as typed (route.ts:92 insert({author_id, body})). There is no recipient/DM field at all — it is a 1-to-many public board, not a message between two parties. Calling this 'E2E DMs' is a fabricated security claim.",
        "recommendation": "Stop describing this as E2E or DMs anywhere in product/marketing. If real member-to-member E2E DMs are wanted, build a separate feature: client-side X25519 keypair (store only public key server-side), libsodium/crypto.subtle sealed-box per recipient, server stores ciphertext+nonce only, keys never leave the device. The current feature should be honestly named 'Anonymous Signal Board'."
      },
      {
        "severity": "P1",
        "title": "Whisper & Echo tables completely empty — feature ships dead-on-arrival",
        "location": "cult_whispers, cult_whisper_votes, cult_echo_wallets (live DB)",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT count(*): cult_whispers=0, cult_whisper_votes=0, cult_echo_wallets=0, echo_active=0. Sample SELECT of latest 10 whispers returned []. The thresholds (5 to echo / 3 to silence) are also unreachable with the current member cohort — nothing has ever been posted or voted.",
        "recommendation": "Empty is correct per no-mock-data policy (do NOT seed fake whispers). But the UX must earn the first post: the empty state 'No live whispers. Send the first.' is fine; the real gap is discoverability and realtime so the first whisper is actually seen by others (see realtime finding)."
      },
      {
        "severity": "P1",
        "title": "Not realtime — no Supabase realtime publication, no polling; other members' activity is invisible until reload",
        "location": "WhisperNetworkPanel.tsx:54-76 (fetch once on mount, refresh only after own submit/vote); EchoChamberPanel.tsx:45-67 (same); OracleHubClient.tsx:42-43",
        "dataVerdict": "N/A",
        "evidence": "pg_publication_tables WHERE pubname='supabase_realtime' for the three tables returned [] — realtime is NOT enabled on any of them. Component grep for setInterval|realtime|channel( returned no matches. refresh() is only invoked inside submit() and vote() success paths, so a member sees a new whisper or a vote tally change made by someone else ONLY after manually reloading the page. For a 'members club' live intel feed this is the opposite of realtime.",
        "recommendation": "Add cult_whispers + cult_whisper_votes + cult_echo_wallets to the supabase_realtime publication and subscribe via supabase.channel() with postgres_changes (INSERT/UPDATE) to live-prepend new whispers, animate vote tallies, and crossing-threshold transitions. This is the single biggest 'Bloomberg-terminal / Friend.tech live room' upgrade."
      },
      {
        "severity": "P1",
        "title": "RETIRED \"Chosen\" badge is alive and load-bearing across Echo Chamber + access layer",
        "location": "EchoChamberPanel.tsx:18,155,173,175-177 ('Chosen path — seat a new wallet'), 219; echo/route.ts:38,52-53; echo/[id]/route.ts:23-25; lib/cult/access.ts:44-45,94,102,120",
        "dataVerdict": "N/A",
        "evidence": "Audit rules state the Chosen badge/lineage is RETIRED — flag any remnant. EchoChamberPanel renders literal 'Chosen path — seat a new wallet' (line 175) and 'Only the Chosen may seat wallets.' (line 219), gated on state.isChosen. The entire Echo Chamber write path (POST/DELETE) is gated by access.isChosen, which access.ts derives from profiles.is_chosen ('Development NFT path → Chosen Seal benefits', line 44). This is a live remnant of the retired concept driving real authorization.",
        "recommendation": "Replace the Chosen gate with the current role model (e.g. tier/cult_member or a dedicated curator role). Remove all 'Chosen path'/'Chosen Seal'/'Only the Chosen' copy and the isChosen field, or rename to the non-retired authorization concept. Do not ship retired-feature language in a 2030 members product."
      },
      {
        "severity": "P2",
        "title": "Vote/threshold transition is not atomic — race window under concurrent voting",
        "location": "app/api/cult/oracle/whispers/[id]/vote/route.ts:61-97",
        "dataVerdict": "N/A",
        "evidence": "Insert vote, then a separate SELECT recount, then a separate UPDATE guarded by .eq('status','pending'). The recount-from-source is good (avoids stale increments), and the status guard prevents double-resolution, but two concurrent voters can both compute counts and the echo_count/silence_count written can momentarily reflect a stale tally (last-writer-wins on the count columns). Functionally low-risk at threshold 5/3 but not transactional.",
        "recommendation": "Move the insert+recount+conditional-transition into a single SECURITY DEFINER plpgsql function / RPC so the count and status transition are one atomic statement. Also lets RLS see author_id for self-vote enforcement instead of doing it in the route."
      },
      {
        "severity": "P2",
        "title": "Echo Chamber advertises live holdings but renders only static rows (no enrichment pipeline connected)",
        "location": "EchoChamberPanel.tsx:28-34 (own TODO comment), 134-135 tagline 'Watch what they hold', 140-168 rows show only address+chain+label",
        "dataVerdict": "EMPTY",
        "evidence": "The tagline promises 'Watch what they hold; the noise hears nothing' but the slot row renders only shortAddr+chain+label — no USD total, no positions. The component's own docstring admits 'Live holdings enrichment (USD totals, top positions) is the obvious next pass'. No Alchemy/Helius call is wired. So the headline value prop (watch stealth-wallet holdings) is not implemented; rows are inert.",
        "recommendation": "Wire each slot to the existing portfolio/holdings pipeline (Alchemy for EVM, Helius for Solana) to show real USD total + top positions per wallet, refreshed on an interval or realtime. Until then the tagline overstates the feature."
      },
      {
        "severity": "P3",
        "title": "Whisper anonymity is server-trust only (author_id stored) — fine, but not 'anonymous to the cult' cryptographically",
        "location": "whispers/route.ts:22-28,92; UI copy WhisperNetworkPanel.tsx:157 'You stay anonymous to the cult.'",
        "dataVerdict": "REAL",
        "evidence": "author_id (uuid) is stored on every whisper and is correctly never projected in GET (select list omits author_id, line 43/49). Anonymity therefore depends entirely on the server never leaking author_id — there is no cryptographic unlinkability. This is acceptable and honestly the right design for moderation, but the UI's absolute 'anonymous' promise overstates the guarantee.",
        "recommendation": "Soften copy to 'anonymous to other members' and ensure no admin/debug endpoint ever returns author_id to clients. Confirm RLS on cult_whispers blocks direct client reads of author_id (route uses service-role admin, so verify no client-side select path exists)."
      },
      {
        "severity": "P3",
        "title": "WCAG AAA contrast risk on muted/secondary text",
        "location": "WhisperNetworkPanel.tsx:161,197,233 (#7F8AA8 on #0b1022/dark); EchoChamberPanel.tsx:145,150,170",
        "dataVerdict": "N/A",
        "evidence": "#7F8AA8 muted text on the near-black panel background is roughly a 4–5:1 ratio — passes AA but fails AAA (7:1 for normal text) at the 10–11px sizes used for timestamps, counts, and the empty-state line. Audit mandates WCAG AAA.",
        "recommendation": "Lift muted text to ~#A9B4D0+ or increase size/weight to meet AAA 7:1 (4.5:1 for large). Audit the #7F8AA8 token globally."
      }
    ],
    "deadControls": [
      "No truly dead buttons found: Echo/Silence vote buttons (WhisperNetworkPanel.tsx:202-225) are wired to POST /vote and correctly disable on already-voted (mine) or in-flight — functional",
      "Whisper submit button (WhisperNetworkPanel.tsx:162-169) functional",
      "Echo Chamber Seat wallet / Remove (✕) buttons (EchoChamberPanel.tsx:156-164,228-235) functional but ONLY rendered for isChosen users — effectively hidden/dead for every non-Chosen member",
      "Chain <select> (EchoChamberPanel.tsx:186-199) functional but only reachable by Chosen"
    ],
    "designUpgrades": [
      "Realtime-first: subscribe to postgres_changes on cult_whispers/votes so whispers stream in and tallies animate live (Friend.tech room / Bloomberg ticker feel) instead of reload-to-see",
      "Whisper resolution drama: animate the 5-to-echo / 3-to-silence progress as a live filling meter; broadcast a subtle chamber-wide pulse when a whisper crosses threshold (echoed=green ascend, silenced=red fade)",
      "Echo Chamber holdings enrichment: real per-wallet USD total + top-3 positions via Alchemy/Helius, sparkline of 24h change, sorted by movement — turn inert address rows into a live stealth-wallet leaderboard",
      "Kill all 'Chosen' language; introduce a clean curator/role chip with a single accent, Linear-style, and a permission tooltip instead of hiding controls outright",
      "Composer polish: Arc/Linear-grade textarea with live char ring, ⌘+Enter to send, optimistic insert of your own whisper with a 'pending verification' shimmer",
      "If real E2E DMs are desired as a separate members feature: Phantom-style device-keypair onboarding, sealed-box per recipient, 'verified device' badges — and only then use the E2E label",
      "AAA contrast pass on all #7F8AA8 muted tokens; add focus-visible rings on vote/seat buttons for keyboard members"
    ]
  },
  {
    "area": "SANCTUM Mantle + Annals (components/vault/sanctum/{MantlePanel,AnnalsPanel,SanctumHubClient}.tsx, app/api/cult/sanctum/{mantle,annals}/route.ts)",
    "summary": "Mantle is a cosmetic \"dressing room\" (6 slots: avatar/frame/glow/banner/title/sigil) and Annals is an achievement ledger (bronze..mythic). Both read REAL persisted catalog data from Supabase (17 cosmetics, 6 achievements, all verified live) and the empty states are honest (0 loadouts, 0 member-achievements is the true DB state). BUT both features are functionally hollow: (1) NO pipeline ever grants achievements automatically — the 5 action-based achievements (read seal, vote, listen, whisper echoed, founding year) are permanently unearnable through normal use; the only writer is a Chosen-only manual API grant with zero UI. (2) Every cosmetic's requires_achievement_code is NULL, so the entire lock/gating UI in MantlePanel is dead code. (3) The equipped loadout is write-only — nothing outside MantlePanel reads it, so the doc's promise \"what carries forward when the cult sees you\" is false. (4) The \"Chosen\" system (retired per audit rules) is pervasive here as a live remnant.",
    "deadControls": [
      "MantlePanel.tsx:84-88,144,181-184 — the entire achievement-lock/gating branch (locked badge, 'Requires X', achievement_required error) is unreachable: live DB shows 0 cosmetics with a non-null requires_achievement_code (SELECT count(*) WHERE requires_achievement_code IS NOT NULL = 0)",
      "SanctumHubClient.tsx:47-59 — SubChamberPlaceholder function is defined but never rendered anywhere (dead code)",
      "app/api/cult/sanctum/annals/route.ts:57-119 — POST grant endpoint has NO UI caller in any sanctum component; only invokable via curl. Achievements can never be granted through the product UI",
      "MantlePanel equip button (line 147-190) writes to cult_member_loadouts but the result is invisible: grep confirms only MantlePanel + its own route read the table, so equipping changes nothing the cult actually sees"
    ],
    "designUpgrades": [
      "Build the achievement-earning pipeline: emit grants into cult_member_achievements from the real action sites — Daily Seal read (first_seal_read), Conclave vote (conclave_voter), full track listen (sanctum_listener), echoed whisper (whisper_echoed), and a founding-year backfill (vault_year_one). Until this exists the Annals is a museum no one can enter.",
      "Wire the loadout to a real mirror: render the equipped avatar/frame/glow/title/sigil in IdentityStrip, Hall author chips, Conclave/Conviction author tags and the members directory. A 2030 members-club identity (Friend.tech / Phantom) must show your worn identity everywhere, not in an isolated panel.",
      "Replace color-swatch placeholders with real assets: all 17 cosmetics have asset_url=NULL. Ship actual SVG/Lottie frames, animated glows, and rendered sigils (Arc/Linear-grade craft) instead of CSS dots.",
      "Gate premium cosmetics on achievements once the earn pipeline is live (e.g. gold_ring/'Chosen Ring', mythic sigils) so the lock UI in MantlePanel actually activates and the climb has payoff.",
      "Add an Annals progress surface: tier rollups, % climbed, next-nearest unlock, and a public 'forged record' view (Bloomberg-terminal density) so members can compare standing — the panel currently shows only a raw N/M count.",
      "Build a Chosen-only grant console UI for the Annals POST (with member search, code picker, note) or retire the endpoint; today it is an orphaned write path.",
      "Resolve the retired-Chosen contradiction across the Sanctum: either fully reinstate or fully excise is_chosen/isChosen — currently it is a live, cron-maintained, vote-weighting remnant that conflicts with the 'Chosen is RETIRED' directive."
    ],
    "findings": [
      {
        "severity": "P0",
        "title": "No achievement-earning pipeline exists — Annals achievements are permanently unearnable through normal use",
        "location": "app/api/cult/sanctum/annals/route.ts:101-118 (only writer); cult_member_achievements",
        "dataVerdict": "REAL",
        "evidence": "Grep for every insert into cult_member_achievements across the repo returns ONLY annals/route.ts (the Chosen-only manual POST) and read paths in mantle/route.ts. No code in the Daily Seal, Conclave vote, Sanctum listen, or Echo/whisper flows grants the matching codes (first_seal_read, conclave_voter, sanctum_listener, whisper_echoed, vault_year_one) — confirmed by grep on those code strings: they appear only in the seed migration. Live DB: SELECT count(*) FROM cult_member_achievements = 0 despite 3 cult members. The 6 catalog rows are REAL and active, but no member can ever earn the 5 action-based ones.",
        "recommendation": "Build server-side grant hooks at each real action site that insert (user_id, achievement_id) on first occurrence, idempotent on the PK. Without this, the Annals is decorative."
      },
      {
        "severity": "P0",
        "title": "Equipped loadout is write-only — 'what carries forward when the cult sees you' is a false promise",
        "location": "components/vault/sanctum/MantlePanel.tsx:119; cult_member_loadouts",
        "dataVerdict": "EMPTY",
        "evidence": "Glob/grep for cult_member_loadouts and 'loadout' across all .ts/.tsx returns exactly 2 files: MantlePanel.tsx and its own route.ts. Nothing else (IdentityStrip, Hall, Conviction, Ape, directory) reads the equipped cosmetics. Live DB: SELECT count(*) FROM cult_member_loadouts = 0. So equipping mutates a table no other surface renders — the tagline at line 119 ('Pick what carries forward when the cult sees you') describes behavior that does not exist.",
        "recommendation": "Read cult_member_loadouts in every place a member identity renders and apply the worn avatar/frame/glow/title/sigil, or rewrite the copy to stop promising visibility that isn't wired."
      },
      {
        "severity": "P1",
        "title": "Cosmetic achievement-gating UI is dead code — no cosmetic is gated",
        "location": "components/vault/sanctum/MantlePanel.tsx:84-88,144,181-184",
        "dataVerdict": "REAL",
        "evidence": "Live DB: SELECT count(*) FROM cult_cosmetics WHERE requires_achievement_code IS NOT NULL = 0 (all 17 rows have NULL). The earned-codes fetch (mantle/route.ts:41-54), the equip-time gate (route.ts:108-121), and the client lock branch (locked badge, 'Requires X' label, achievement_required toast) therefore never execute. The gating machinery is fully built but inert.",
        "recommendation": "Once the earn pipeline lands, set requires_achievement_code on premium cosmetics (e.g. gold_ring 'Chosen Ring', mythic sigils) so the lock path activates; until then it is untested dead code."
      },
      {
        "severity": "P1",
        "title": "'Chosen' system is a live remnant despite being retired",
        "location": "app/api/cult/sanctum/annals/route.ts:49,62; lib/cult/access.ts:44-48,120; app/api/cron/cult-verify-membership/route.ts:104-107",
        "dataVerdict": "REAL",
        "evidence": "Audit rule states the Chosen badge/lineage is RETIRED. Yet the Annals route returns isChosen and hard-gates POST on access.isChosen; getCultAccess reads profiles.is_chosen; a cron actively maintains it; it drives 2x Conclave vote weight and gold badges. Live DB: profiles has is_chosen column, SELECT count(*) WHERE is_chosen = 3 (all 3 cult members). This is not a dead remnant — it is an active, populated subsystem that contradicts the retirement directive.",
        "recommendation": "Decide explicitly: reinstate Chosen as a first-class tier, or excise is_chosen end-to-end. The current half-state is the worst case for an institutional product."
      },
      {
        "severity": "P2",
        "title": "Annals POST grant endpoint has no UI — orphaned write path",
        "location": "app/api/cult/sanctum/annals/route.ts:57-119; components/vault/sanctum/AnnalsPanel.tsx",
        "dataVerdict": "N/A",
        "evidence": "AnnalsPanel.tsx is read-only (single GET in useEffect, no POST, no grant form). Grep for a POST to /api/cult/sanctum/annals across components returns nothing. The Chosen-only manual-grant endpoint can only be hit via curl, which is why member_ach = 0.",
        "recommendation": "Either build a Chosen grant console (member search + code + note) or remove the endpoint; an API with no caller is attack surface, not a feature."
      },
      {
        "severity": "P2",
        "title": "SubChamberPlaceholder is unused dead code",
        "location": "components/vault/sanctum/SanctumHubClient.tsx:47-59",
        "dataVerdict": "N/A",
        "evidence": "Function SubChamberPlaceholder is declared but never referenced in the JSX (the hub renders MantlePanel/AnnalsPanel/ForgePanel directly at lines 39-41). CLAUDE.md forbids commented-out/dead code; this is leftover scaffolding.",
        "recommendation": "Delete it."
      },
      {
        "severity": "P3",
        "title": "All cosmetic assets are placeholder color swatches (asset_url NULL)",
        "location": "cult_cosmetics; MantlePanel.tsx:160-178",
        "dataVerdict": "STALE",
        "evidence": "Live DB: every one of the 17 cosmetics has asset_url=NULL; the panel falls back to a CSS preview_color dot. This fallback is honest (not fabricated), but for a members-only 2030 product the 'cosmetics' are literally colored circles — no rendered frames/glows/sigils exist yet.",
        "recommendation": "Ship real SVG/Lottie assets and populate asset_url; the swatch fallback should be the exception, not the entire catalog."
      }
    ]
  },
  {
    "area": "SANCTUM Library / Ddergo Player + Forge (components/vault/sanctum/LibraryPlayer.tsx, CultPlayer.tsx, ForgePanel.tsx, ChosenLibraryCurator.tsx; app/api/cult/sanctum/library + [id] + reorder; app/api/cult/sanctum/forge)",
    "summary": "The \"Ddergo Library audio player\" is not a player — it is a Spotify iframe with a fabricated track list bolted on top. All 8 rows in cult_ambient_tracks carry hand-invented titles, artists and durations, yet every single one points to the identical storage_path 'spotify:playlist:2tuf8ddMY5YPMlqzNWsVyC' — there is zero per-track audio, no storage/CDN MP3s, and the durations are made-up numbers that violate the no-fabricated-data rule. Playback \"works\" only in the sense that the Spotify embed loads; the on-page LibraryPlayer renders NO controls at all in playlist mode (just a sentence telling you to use a floating orb), and the Chosen reorder API persists an order that the player then completely ignores. The Forge is the one genuinely real, well-built surface (live Alchemy NFT fan-out, honest offline/empty states) but it lowercases EVM addresses against the repo rule. The \"Chosen\" lineage is supposed to be RETIRED but is alive and load-bearing here: an entire is_chosen-gated curator component ships and is wired into the hub.",
    "findings": [
      {
        "severity": "P0",
        "title": "Track catalog is fabricated metadata over a single Spotify playlist — no real per-track audio exists",
        "location": "cult_ambient_tracks (DB) + components/vault/sanctum/LibraryPlayer.tsx:54-56 + app/api/cult/sanctum/library/route.ts:21-26",
        "dataVerdict": "FABRICATED",
        "evidence": "SELECT id,title,artist,storage_path,duration_seconds,display_order FROM cult_ambient_tracks ORDER BY display_order returned 8 active rows with DISTINCT titles ('Shiba Spirit','Midnight Mutation','Ice Cream Dreams','Akaishi Sunrise','Cookie Cult','Pulse Cycle','NIPPO Anthem','Born 1948'), distinct artists ('Ddergo','Naka Collective','VoV','n4kaishi8a','Naka Go Records','Ddergo feat. VoV') and distinct duration_seconds (222,251,178,303,207,374,285,235) — yet ALL 8 share the IDENTICAL storage_path 'spotify:playlist:2tuf8ddMY5YPMlqzNWsVyC'. A track cannot have its own title/artist/3:42 runtime while its audio source is a whole-playlist marker shared with 7 other 'tracks'. These are invented rows, not a catalog. LibraryPlayer's own comment (lines 13-18) admits 'every track shares the same spotify:playlist:<id> source (current state)'.",
        "recommendation": "Either (a) ingest real per-track audio: upload owner-provided MP3/stems to a Supabase Storage bucket or CDN, set storage_path to the real object path, and backfill duration_seconds from the actual file (ffprobe) — never hand-typed; or (b) if Spotify is the real source, collapse to ONE honest row (or a dedicated config) and pull real per-track title/artist/duration from the Spotify Web API for that playlist. Delete the 8 fabricated rows. Until real audio or real Spotify metadata exists, the on-page list must not present invented durations."
      },
      {
        "severity": "P0",
        "title": "On-page LibraryPlayer has zero playback controls — it is a static notice in playlist mode",
        "location": "components/vault/sanctum/LibraryPlayer.tsx:68-73",
        "dataVerdict": "N/A",
        "evidence": "When allSpotify is true (the only real state — all 8 rows are spotify:playlist), the component renders a single <div> with the text 'The Library plays everywhere in the Vault. Tap the floating bar in the lower right to begin or expand.' There is no play/pause, no scrubber, no track selection, no now-playing, no waveform — nothing. The actual audio lives entirely in CultPlayer.tsx's Spotify <iframe> (lines 114-124), an off-the-shelf Spotify widget. The branch that would render a real per-track list (lines 75-86) is dead because storage_path never starts with '/audio/'.",
        "recommendation": "For a premium members-only feel this cannot be a Spotify iframe. Build a first-party player: <audio> (or Web Audio API) driving a custom transport (play/pause, prev/next, seekable progress with buffered ranges), now-playing art, a synced queue/track list that reflects display_order, keyboard shortcuts (space/←/→), and persistent playback across chamber nav (the CultPlayer mount-once pattern is right — keep that, swap the iframe for the real engine). Benchmark: Phantom's in-app surfaces and Linear's command-driven polish, not an embedded third-party widget."
      },
      {
        "severity": "P1",
        "title": "Reorder API persists an order the player never honors — dead control loop",
        "location": "app/api/cult/sanctum/library/reorder/route.ts:53-65 + components/vault/sanctum/ChosenLibraryCurator.tsx:51-79 + components/vault/CultPlayer.tsx:60-61",
        "dataVerdict": "REAL",
        "evidence": "reorder/route.ts genuinely writes display_order per row (one UPDATE each, with curated_by/curated_at) — persistence is real. BUT the audio comes from CultPlayer, which only does .find((t) => t.storage_path.startsWith('spotify:playlist:')) and takes the FIRST match's playlist id (CultPlayer.tsx:60-61); track order is irrelevant to what plays. And LibraryPlayer hides the list entirely in playlist mode (line 68 branch). So a Chosen user can spend effort reordering tracks that (a) all point to the same playlist and (b) are never surfaced in playback order anywhere. The up/down buttons are functionally dead with respect to listener experience.",
        "recommendation": "Make order meaningful: once a real per-track engine exists (finding above), the queue must read display_order and play in that sequence. Until then the curator is theater. Also consider: the reorder does N sequential round-trips (Promise.all of single-row UPDATEs) — fine at 8 rows but replace with a single upsert/RPC if the catalog grows."
      },
      {
        "severity": "P1",
        "title": "'Chosen' lineage is NOT retired — full is_chosen-gated curator ships and is hub-wired",
        "location": "components/vault/sanctum/ChosenLibraryCurator.tsx:1-172 + components/vault/sanctum/SanctumHubClient.tsx:7,37 + lib/cult/access.ts:44,120 + app/api/cult/sanctum/library/[id]/route.ts:24 + reorder/route.ts:27",
        "dataVerdict": "REAL",
        "evidence": "The audit rule states the Chosen badge/lineage is RETIRED and any remnant is a defect. Grep found 14 'Chosen' occurrences across this chamber. ChosenLibraryCurator.tsx renders 'Chosen path' eyebrow (line 107), a gold 'Chosen' outline, and gates entirely on me.isChosen. access.ts still selects is_chosen and exposes isChosen (lines 94,120) with a comment 'Chosen Seal benefits'. Both write routes hard-gate on access.isChosen and return error 'chosen_only' ([id]/route.ts:24, reorder/route.ts:27). DB: SELECT count(*) FILTER(WHERE is_chosen) FROM profiles = 3 of 16 — actively populated, so this is live, not dormant.",
        "recommendation": "Decide ownership model without the retired 'Chosen' concept: gate curation on a neutral capability (e.g. cult_member + an explicit owner/curator role, or profiles.is_owner) and rename the component/labels/error codes ('chosen_only' -> 'curator_only'). Strip the 'Chosen path'/gold-seal copy and outline. If the lineage is truly retired product-wide, this whole curator must be re-gated and re-skinned, not left as a Chosen remnant."
      },
      {
        "severity": "P1",
        "title": "EVM addresses lowercased in the Forge — violates addressNormalize rule",
        "location": "app/api/cult/sanctum/forge/route.ts:37 and :102",
        "dataVerdict": "REAL",
        "evidence": "forge/route.ts:37 `return /^0x.../.test(addr) ? addr.toLowerCase() : null;` and :102 `const contract = nft.contract?.address?.toLowerCase() ?? '';`. The repo rule and CLAUDE.md forbid calling .toLowerCase() directly on wallet/token addresses and require lib/utils/addressNormalize. For EVM this is low real-world risk (EVM is case-insensitive/checksummed), but it is a direct rule violation and the addresses are echoed back to the client (response.addresses) and used to build Etherscan links, so checksum casing is lost. The underlying NFT data IS real Alchemy (getNftsForOwner across 5 chains, honest offline/empty states) — that part is correct.",
        "recommendation": "Route both the owner address and the contract address through lib/utils/addressNormalize instead of .toLowerCase(). Keep the EVM regex validation, but normalize via the shared util so the codebase has one address policy and Solana-style case-sensitivity is never accidentally broken when Solana/Helius support lands (already noted as a follow-up in the file's comment)."
      },
      {
        "severity": "P2",
        "title": "CultPlayer default playlist id is stale / different from the DB playlist",
        "location": "components/vault/CultPlayer.tsx:21",
        "dataVerdict": "STALE",
        "evidence": "CultPlayer.tsx:21 `const DEFAULT_PLAYLIST = '4ZjnNBKs9x7XdHPLQJmsiK';` but every active row in cult_ambient_tracks uses playlist id '2tuf8ddMY5YPMlqzNWsVyC' (DB query above). The runtime override useEffect (lines 53-65) fetches the library and replaces the id, so the correct playlist usually wins — but on first paint, on any library fetch failure (the catch keeps the default, line 62), or before the async resolves, the player embeds a DIFFERENT hardcoded playlist than the catalog declares. Two sources of truth for 'which playlist is the Library'.",
        "recommendation": "Single source of truth: drive the playlist id only from the library API (or a typed config row) and render a loading/empty state until it resolves, rather than embedding a hardcoded fallback playlist that may not be the real one. If a fallback must exist, it must equal the DB value."
      },
      {
        "severity": "P2",
        "title": "Dead code: SubChamberPlaceholder defined but unused",
        "location": "components/vault/sanctum/SanctumHubClient.tsx:47-59",
        "dataVerdict": "N/A",
        "evidence": "Grep for SubChamberPlaceholder in SanctumHubClient.tsx returns exactly 1 occurrence — its own definition. It is never instantiated (the hub renders LibraryPlayer/ChosenLibraryCurator/Mantle/Annals/Forge directly). CLAUDE.md forbids leaving dead/commented-out code. The component's docstring (lines 9-15) also still says 'three styled placeholder cards' which no longer matches the real layout.",
        "recommendation": "Delete SubChamberPlaceholder and fix the stale hub docstring."
      },
      {
        "severity": "P2",
        "title": "LibraryPlayer empty-state copy leaks internal table name to members",
        "location": "components/vault/sanctum/LibraryPlayer.tsx:48; also :71 floating-bar instruction",
        "dataVerdict": "N/A",
        "evidence": "Empty state tells the end user 'Drop ambient tracks via cult_ambient_tracks.' (line 48) — exposing a DB table name in a members-facing premium product. Line 71 instructs users to 'Tap the floating bar in the lower right', which is fragile coupling between two components and reads like dev scaffolding, not institutional copy.",
        "recommendation": "Replace with member-appropriate copy (e.g. 'The Library is being scored. Check back soon.') and remove implementation references. Make the on-page surface self-sufficient instead of pointing at a separate floating orb."
      }
    ],
    "deadControls": [
      "components/vault/sanctum/ChosenLibraryCurator.tsx:128-145 — up/down reorder buttons: persist display_order to DB but the playlist-embed player ignores order entirely, so they change nothing a listener can hear",
      "components/vault/sanctum/LibraryPlayer.tsx:75-86 — per-track <audio> list branch is unreachable (no storage_path ever starts with '/audio/'); dead code path",
      "components/vault/sanctum/LibraryPlayer.tsx:68-73 — playlist-mode 'player' has no interactive controls at all (no play/pause/seek/track-select); it is static text",
      "components/vault/CultPlayer.tsx:21 — DEFAULT_PLAYLIST hardcoded to a playlist id that does not match any DB row",
      "components/vault/sanctum/SanctumHubClient.tsx:47-59 — SubChamberPlaceholder component defined but never rendered (dead)"
    ],
    "designUpgrades": [
      "Replace the Spotify iframe with a first-party Ddergo player: Web Audio API engine + custom transport (play/pause, prev/next, seekable progress bar with buffered ranges, volume, mute), now-playing artwork, and a live queue that visually reflects display_order. This is the single biggest lever for the 'premium' ask — an embedded third-party widget will never feel members-only.",
      "Real per-track audio pipeline: Supabase Storage (or CDN) bucket of owner MP3/stems, signed URLs gated by getCultAccess, duration_seconds backfilled by ffprobe at upload — never hand-entered. Show real waveform peaks (precomputed) like SoundCloud/Bloomberg-grade audio surfaces.",
      "Persistent, cross-chamber mini-player (keep CultPlayer's mount-once pattern) with a tasteful expand-to-full takeover; animated orb that reacts to actual audio amplitude (Web Audio AnalyserNode) instead of a static spinning Disc3 icon.",
      "Make the Chosen-replacement curator a real drag-and-drop reorder (dnd-kit) with optimistic UI + the existing keyboard up/down as a fallback, and surface 'last curated by / at' from curated_by/curated_at so ordering feels accountable and live — but only once order actually drives playback.",
      "Forge: upgrade the CSS rotateY tilt to a proper card hover with depth/parallax and lazy hi-res art, group by collection with counts, add per-chain pill counts and a 'floor/last-sale' enrichment (Alchemy/Reservoir) so the gallery reads like a Phantom/OpenSea-grade vault, not a thumbnail grid.",
      "Realtime: subscribe LibraryPlayer/curator to Supabase Realtime on cult_ambient_tracks so reorder/soft-delete by a curator updates every member's surface live, instead of fetch-once-on-mount.",
      "Enforce WCAG AAA contrast on the muted text tokens used throughout (#7F8AA8 on dark, #B4C0E0) — several labels/taglines sit below AAA on the dark vault background; audit and lift to compliant pairs."
    ]
  },
  {
    "area": "NakaCult — APE chamber (\"Ape or Nope\" daily prediction game)",
    "summary": "The assignment's premise is wrong: \"Ape\" is NOT a group buy / conviction bet / real-money product. It is a free, points-only daily prediction game — members tap APE/NOPE on a trending coin, 24h later a cron re-prices it on a real DEX and awards cult points + streaks. There is zero money, zero custody, zero wallet path, so \"non-custodial real-money safety\" is N/A by design (and that is fine — but nobody should ship this believing it's a conviction-bet vault). The code is wired end-to-end against REAL data sources (CoinGecko trending → DexScreener pricing, no mock data) and the schema/crons exist in prod — BUT the entire feature is stone-cold EMPTY: 0 rounds, 0 votes, 0 points, 0 signals, and the open/resolve crons have NEVER executed once (no cron_execution_log rows). It also still renders the RETIRED \"Chosen\" badge, isn't truly realtime (10s poll), and the token-matching resolver can silently grade the wrong coin.",
    "findings": [
      {
        "severity": "P0",
        "title": "Entire feature is EMPTY and the opening cron has never run — the page shows 'No round live' to every member",
        "location": "DB tables cult_ape_rounds / cult_ape_votes; cron app/api/cron/cult-ape-open/route.ts",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT counts → total_rounds:0, open_rounds:0, resolved_rounds:0, total_votes:0, profiles_with_points:0, ape_signals:0. SELECT * FROM cron_execution_log WHERE cron_name LIKE 'cult-ape%' → [] (zero executions ever). Schema IS applied (information_schema confirms all 15 cols on cult_ape_rounds, 7 on cult_ape_votes, plus profiles.cult_points/cult_streak/cult_best_streak) and vercel.json L42-43 schedules cult-ape-open '0 8 * * *' and cult-ape-resolve '*/15 * * * *' — yet nothing has fired. Either the crons were added to vercel.json after the last deploy, or open-cron keeps hitting skipped:'no_priceable_token'/error and never logs (it logs success only on the happy path). Net: every cult member sees the empty state in ApePanel.tsx L104-108.",
        "recommendation": "Manually invoke /api/cron/cult-ape-open with the cron secret to seed round #1 and confirm it inserts. Verify the deploy that added L42-43 to vercel.json actually shipped to main. Add a cron_execution_log write on the skipped/error branches too (currently only success path at L41/L55/L70 logs) so silent no-ops are observable."
      },
      {
        "severity": "P1",
        "title": "RETIRED 'Chosen' badge still rendered and threaded through the API — explicit audit violation",
        "location": "components/vault/commons/ApePanel.tsx:200 (◈ + p.isChosen); app/api/cult/ape/route.ts:63,80 (selects is_chosen, maps isChosen); interface field ApePanel.tsx:22",
        "dataVerdict": "REAL",
        "evidence": "Chosen is RETIRED per audit rules. ApePanel L200 renders `{p.isChosen && '◈ '}{p.name}` in the leaderboard; route.ts L63 selects is_chosen, L80 emits isChosen. Live DB still has 3 profiles with is_chosen=true (SELECT count(*) FROM profiles WHERE is_chosen=true → 3), so the ◈ glyph WILL render for those users once the leaderboard populates. is_chosen is referenced across 49 source files repo-wide.",
        "recommendation": "Strip the ◈ render at ApePanel.tsx:200, drop is_chosen from the route select (L63) and the isChosen mapping (L80), and remove isChosen from the Round/leaderboard interface (L22). Track the broader 49-file is_chosen retirement as a separate cleanup."
      },
      {
        "severity": "P1",
        "title": "Token resolver can grade the WRONG coin — free-text symbol search with no identity verification",
        "location": "lib/cult/convictionPrice.ts:30-38 (resolveAssetPrice); app/api/cron/cult-ape-open/route.ts:48-50",
        "dataVerdict": "REAL",
        "evidence": "Open-cron passes only the CoinGecko symbol (e.g. 'PEPE','TRUMP') to resolveAssetPrice, which does searchPairs(q) then picks deepestLiquidity with NO chain scope (chain is null at the call site) and NO check that the matched pair's base token is the trending token. Many memecoin tickers collide across chains/scams; the deepest-liquidity pair for a ticker is frequently an unrelated token. The captured pair_ref is then re-priced verbatim by cult-ape-resolve.ts:49, so a mismatched pair silently produces a fabricated-looking move_pct and grades real members' votes against the wrong asset.",
        "recommendation": "Resolve trending tokens by contract address, not ticker. getTrendingTokens returns CoinGecko coin ids — fetch the token's on-chain contract(s) (CoinGecko /coins/{id} contract_address per platform) and call getBestPair(address) / a chain-scoped lookup, verifying the matched pair's baseToken address equals the trending token's address via lib/utils/addressNormalize. Skip the token if no verified pair (the cron already supports skipped:'no_priceable_token')."
      },
      {
        "severity": "P2",
        "title": "Not realtime — 10s full-refetch poll, and RLS-enabled tables have zero policies so client realtime is impossible",
        "location": "components/vault/commons/ApePanel.tsx:52-56 (setInterval 10_000); DB RLS on cult_ape_rounds/cult_ape_votes",
        "dataVerdict": "REAL",
        "evidence": "ApePanel re-fetches the whole /api/cult/ape payload every 10s (L54). Sentiment/countdown therefore lag up to 10s and there is no live vote ticker. cult_ape_rounds and cult_ape_votes have RLS ENABLED but ZERO policies (pg_policies returned no rows for either table), so even if you wanted Supabase Realtime subscriptions for clients, authenticated users cannot SELECT — only the service_role API can. For a '2030 members-only' feel this is a chat-bot poll, not a live trading floor.",
        "recommendation": "Add an authenticated SELECT RLS policy on cult_ape_rounds (status='open') and on cult_ape_votes aggregates, then drive sentiment via a Supabase Realtime channel on cult_ape_votes so the APE/NOPE bar animates as calls land. Keep the countdown client-side (already L25-31) and only refetch round metadata on resolve."
      },
      {
        "severity": "P2",
        "title": "Resolve cron does N+1 sequential profile read+write per vote — no transaction, partial-failure leaves votes graded but points unawarded",
        "location": "app/api/cron/cult-ape-resolve/route.ts:69-90",
        "dataVerdict": "N/A",
        "evidence": "For each vote the cron does a separate profiles SELECT (L79) then UPDATE (L87) of points/streak/best — no atomicity. If the function times out (maxDuration 120s) or errors mid-loop after L75 marked a vote correct but before L87 updated the profile, points are lost and re-running double-counts (votes already have correct set, but the loop re-grades from scratch each run — though resolved rounds are excluded by the status='open' filter at L37, so a round half-graded then marked resolved at L56 strands the rest). Read-modify-write on cult_points is also racy against any concurrent path.",
        "recommendation": "Move grading into a single Postgres RPC/transaction: update votes and increment profiles.cult_points/streak atomically (UPDATE ... SET cult_points = cult_points + x) so re-runs are idempotent and a mid-loop failure can't strand awards. Mark the round resolved only after all votes are graded inside the same tx."
      },
      {
        "severity": "P3",
        "title": "'flat' deadband outcome fires no Signal Pulse and leaves last-result UI inconsistent",
        "location": "app/api/cron/cult-ape-resolve/route.ts:53,92-100; ApePanel.tsx:178-187",
        "dataVerdict": "N/A",
        "evidence": "Outcome 'flat' (|move|<=0.5%) sets the round resolved with outcome='flat' but the Signal Pulse insert is gated by `if (outcome !== 'flat')` (L92), so a flat day produces no cult-feed event. The 'last result' card (ApePanel L182-184) does render flat ('text-[#8C9AC0]'), so flat rounds appear in the panel but vanish from the signal feed — minor inconsistency, not a data defect.",
        "recommendation": "Either emit a low-severity 'info' pulse for flat resolutions ($SYM held flat ±0.x%) for feed continuity, or document that flat is intentionally feed-silent. Low priority."
      }
    ],
    "deadControls": [
      "No dead buttons found: APE button ApePanel.tsx:129-141 and NOPE button :142-154 both POST /api/cult/ape and are correctly disabled when locked/voting (L131,144). They are UNTESTABLE in practice right now only because there is no open round to vote on (0 rounds in DB), not because they are wired wrong.",
      "No filters/toggles exist on this page to be dead — the panel has no filter/sort/search controls at all (a gap for the institutional feel, not a dead control)."
    ],
    "designUpgrades": [
      "Live vote ticker: replace 10s poll with a Supabase Realtime channel on cult_ape_votes so the APE/NOPE sentiment bar (ApePanel.tsx:163-165) animates in real time as calls land — Friend.tech / Polymarket style live order-flow feel.",
      "Resolution drama: build a 'resolution moment' — when a round's 24h window closes, animate the entry→resolve price delta with the % move counting up, win/loss confetti for correct callers, and a shareable 'I called it' card. Currently the result is a one-line text row (L178-187).",
      "Round history / track record: there is no history view. Add a per-member call ledger (every past APE/NOPE, correct/wrong, points) and a hit-rate stat (e.g. '7/10 calls, 70%') — Bloomberg-terminal-style P&L for predictions. Data already exists in cult_ape_votes.correct.",
      "Leaderboard depth: current leaderboard (L190-208) is top-10 by raw points with no time window. Add 'this week' / 'all time' tabs, rank-delta arrows, and hit-rate alongside points so it reads like a real ranked ladder, not a static list.",
      "Countdown urgency: the countdown is plain text (L119, countdown()). Make it a live ring/progress arc that turns amber/red in the final hour with a 'voting closes soon' nudge — Linear/Arc-grade micro-interaction.",
      "WCAG AAA contrast pass: muted greys #6B779C (L166,198) and #8C9AC0 on the #070A16 background fall short of AAA for small text — re-tune the muted palette to meet 7:1 for the institutional, accessible standard the brief demands."
    ]
  },
  {
    "area": "NakaCult Commons — HALL + CONVICTION + OFFERING + PULSE (pages, panels, /api/cult/*, crons cult-offering-draw + cult-signal-feed + cult-conviction-score)",
    "summary": "The code is honest and well-built — no fabricated numbers anywhere. Conviction pricing/scoring uses real DexScreener pairs, the offering draw is a real uniform raffle, the signal feeder derives genuinely cult-native consensus signals, and every table column the routes reference exists in the live DB. BUT all four feature tables are EMPTY (0 rows) and the three crons that drive Offering/Conviction/Pulse have NEVER executed (zero rows in cron_execution_log; the cult crons that did run last fired 2026-05-13, ~6 weeks stale vs today 2026-06-25). So every panel ships its empty-state to real members: the Hall is silent, the board is blank, no offerings, the Pulse is quiet. The pipelines are wired correctly but not connected to a running scheduler, and the retired \"Chosen\" badge (◈/is_chosen) still renders in Hall + Conviction — both are remnant defects per the audit ruling. Nothing is realtime (Hall/Pulse poll; Conviction never refreshes).",
    "findings": [
      {
        "severity": "P0",
        "title": "Assigned crons have NEVER run — Offering/Conviction/Pulse pipelines are dead in production",
        "location": "app/api/cron/cult-offering-draw/route.ts, app/api/cron/cult-signal-feed/route.ts, app/api/cron/cult-conviction-score/route.ts; vercel.json:39-41",
        "dataVerdict": "EMPTY",
        "evidence": "SQL: SELECT cron_name,count(*),max(started_at) FROM cron_execution_log WHERE cron_name LIKE 'cult-%' GROUP BY cron_name → returns ONLY cult-generate-daily-seal, cult-refresh-treasury, cult-resolve-proposals, cult-verify-membership. The three crons in my assignment (cult-offering-draw, cult-signal-feed, cult-conviction-score) have ZERO log rows despite being registered in vercel.json:39-41. Even the crons that DID run last fired 2026-05-13; today is 2026-06-25 (~6 weeks stale). The whole scheduler appears halted.",
        "recommendation": "This is the headline issue. Verify Vercel Cron is actually enabled on the deployment and that these three paths are on the cron plan; the offering auto-draw, the 7-day conviction scoring, and the consensus signal emitter cannot function without them. Add a heartbeat/alert (Sentry) when any cult cron misses its window. Without these running, the Conviction leaderboard never fills, offerings never draw a winner, and the Pulse never gets a single auto-signal."
      },
      {
        "severity": "P0",
        "title": "All four feature tables are EMPTY — every panel renders its empty-state to real members",
        "location": "cult_hall_messages, cult_convictions, cult_offerings, cult_signals",
        "dataVerdict": "EMPTY",
        "evidence": "SQL counts: hall_msgs=0, convictions=0 (scored=0, priced=0), offerings=0 (open=0), offering_entries=0, signals=0. Meanwhile 3 real cult_member profiles exist (SELECT count(*) FILTER(WHERE cult_member=true)=3 of 16 total), so the gate is NOT the blocker — there is simply no content and no seeding has ever happened. Admin seed routes exist and are real (app/api/admin/cult/offerings/route.ts, app/api/admin/cult/signals/route.ts, properly permissioned via requirePermission('research.publish')) but have never been used.",
        "recommendation": "Seed at least one live Offering and curate a few real Pulse signals via the admin routes so the 3 members see a populated, premium surface instead of 'The Hall is silent' / 'No offerings open' / 'The Pulse is quiet'. For a members-only product launching to a tiny cohort, an empty club reads as broken. Conviction will self-populate once members post AND the scoring cron runs."
      },
      {
        "severity": "P1",
        "title": "Retired 'Chosen' badge still rendered in Hall and Conviction panels",
        "location": "components/vault/commons/HallPanel.tsx:11,87-88; components/vault/commons/ConvictionPanel.tsx:15,143; API: app/api/cult/hall/route.ts:34-50, app/api/cult/conviction/route.ts:31-44",
        "dataVerdict": "REAL",
        "evidence": "HallPanel renders `{m.author.isChosen && '◈ '}` with gold text-[#FFD86B] (line 87-88); ConvictionPanel renders `{c.author.isChosen && '◈ '}` (line 143). Both APIs SELECT is_chosen from profiles and map it to author.isChosen. Live DB: 3 profiles have is_chosen=true, so the gold ◈ WILL actually display. Per the audit ruling the Chosen badge/lineage is RETIRED, making this a live remnant, not dead code.",
        "recommendation": "Strip isChosen from the Msg/Conviction interfaces, the API selects, and the JSX in both panels (and the matching ◈/gold styling). If a distinction is still desired, replace with a non-retired construct (e.g. Mantle/rank) rather than the Chosen seal."
      },
      {
        "severity": "P1",
        "title": "Nothing is realtime — Hall and Pulse poll, Conviction never refreshes",
        "location": "HallPanel.tsx:46 (setInterval 5000), PulsePanel.tsx:50 (setInterval 15000), ConvictionPanel.tsx:55 (load once, no interval)",
        "dataVerdict": "N/A",
        "evidence": "HallPanel polls GET /api/cult/hall every 5s; PulsePanel polls every 15s; ConvictionPanel calls load() once on mount with no interval and only re-fetches after the user posts. The Hall page header claims 'Where the cult speaks in real time' — but it is 5s polling, not realtime. A 5s poll on a chat is visibly laggy and bursts DB reads.",
        "recommendation": "Move Hall to Supabase Realtime (postgres_changes on cult_hall_messages) for true sub-second delivery — benchmark Phantom/Linear-grade chat. Add at least a 15-20s poll to Conviction so new calls and freshly-scored results appear without a manual post. Pulse can stay polled but should also subscribe to cult_signals inserts for instant 'signal fired' delivery, which is the entire selling point ('Members see them before the public feed')."
      },
      {
        "severity": "P2",
        "title": "Offering winner is decided by Math.random() — not provably fair for a real-money raffle",
        "location": "app/api/cron/cult-offering-draw/route.ts:52-53",
        "dataVerdict": "REAL",
        "evidence": "`const winner = entries[Math.floor(Math.random()*entries.length)].user_id`. The inline comment defends it ('Math.random is fine here'), and the double-draw race is correctly guarded with .eq('status','open'). For a treasury-funded raffle with real value, Math.random is non-auditable and members cannot verify fairness.",
        "recommendation": "Use crypto.randomInt (Node crypto) and persist the draw seed/proof on the offering row so the selection is auditable. For an institutional members-club feel, surface a 'verifiably random' badge with the seed and entrant snapshot — this is exactly the trust signal Friend.tech/members clubs get wrong and Bloomberg-grade products get right."
      },
      {
        "severity": "P2",
        "title": "WCAG AAA contrast fails on muted timestamp/meta text",
        "location": "HallPanel.tsx:90 (#6B779C), PulsePanel.tsx:77 (#6B779C), ConvictionPanel.tsx:136,142,157,162 (#6B779C), OfferingPanel.tsx:89,111 (#6B779C)",
        "dataVerdict": "N/A",
        "evidence": "#6B779C on the panel bg #070A16 yields roughly 4.2:1 contrast — below WCAG AAA (7:1 for normal text) and these are 10-11px (timestamps, entry counts, author lines, 'No scored calls yet'). The audit standard is WCAG AAA. #8C9AC0 (~6:1) is borderline; #6B779C clearly fails.",
        "recommendation": "Lift the muted token to at least #9AA7C8 (~7:1) for any text carrying information (timestamps, entry counts, author names, empty-state copy). Reserve the dimmest tone only for purely decorative glyphs."
      },
      {
        "severity": "P2",
        "title": "Conviction asset resolver only recognizes EVM addresses; Solana token addresses fall through to symbol search",
        "location": "lib/cult/convictionPrice.ts:11,29-33",
        "dataVerdict": "REAL",
        "evidence": "isEvmAddress = /^0x[a-fA-F0-9]{40}$/. A Solana mint (base58, case-sensitive) never matches, so it always goes through searchPairs() free-text — less precise and can mis-resolve to the wrong pair, capturing a wrong entry_price_usd that later mis-scores the call. Note: the .toLowerCase() calls in this file are on chainId (line 32) and the symbol query, NOT on a wallet/token address, so the addressNormalize rule is NOT violated here — confirmed correct.",
        "recommendation": "Add Solana mint detection (base58, 32-44 chars) and resolve via a direct token lookup (DexScreener token endpoint / Jupiter) before falling back to symbol search, preserving case via lib/utils/addressNormalize for any comparison. Otherwise a chunk of cross-chain convictions get scored against the wrong pair."
      },
      {
        "severity": "P3",
        "title": "Panels are control-sparse for an 'institutional 2030 members-only' bar — no filtering, sorting, or status views",
        "location": "OfferingPanel.tsx (no filters), PulsePanel.tsx (no severity/kind filter), ConvictionPanel.tsx (no open/scored filter)",
        "dataVerdict": "N/A",
        "evidence": "No dead filters/toggles were found (good — there are none to be dead). But there are almost no controls at all: Pulse has no filter by severity (info/watch/alert) or kind; Conviction has no toggle between open vs scored vs mine; Offering has no separation of open vs drawn/closed. Everything is a single undifferentiated list.",
        "recommendation": "Build Bloomberg-Terminal-grade affordances: Pulse severity/kind segmented filter + per-signal expand showing the underlying detail JSON (currently only detail.message is read at PulsePanel.tsx:70, the rest of the payload is discarded); Conviction tabs (Live / Scored / Mine) and a member's running hit-rate; Offering split into Open vs History with a countdown timer to closes_at. These are the institutional touches that separate a members club from a Discord."
      }
    ],
    "deadControls": [
      "No dead filters/toggles/buttons found — Hall send button, Conviction long/short toggle + Post, Offering Enter, all wire to real handlers. The gap is the OPPOSITE: too few controls (no Pulse severity filter, no Conviction status tabs, no Offering open/history split) — see P3 finding.",
      "PulsePanel.tsx:70 — only detail.message is rendered; the rest of the cult_signals.detail JSONB (asset, direction, members) is fetched but silently dropped (effectively dead data on the client)."
    ],
    "designUpgrades": [
      "Hall: replace 5s polling with Supabase Realtime (postgres_changes on cult_hall_messages) for true sub-second chat; add presence ('N cultists in the Hall'), optimistic send, and typing indicators — Phantom/Linear-grade.",
      "Pulse: subscribe to cult_signals inserts for instant delivery (the product promise is 'before the public feed'); add severity/kind segmented filter, an expandable detail card rendering the full detail JSON, and a subtle 'new signal' pulse animation — Bloomberg alert-tape feel.",
      "Conviction: add Live/Scored/Mine tabs, a per-member hit-rate and rank, a sparkline of the asset's move since entry on each scored call, and a sticky leaderboard with rank deltas — turn it into a real reputation ledger.",
      "Offering: split Open vs History, add a live countdown to closes_at, show the entrant snapshot, and after a draw display a verifiable-randomness proof (crypto seed) — members-club trust signal done right.",
      "Global: replace muted #6B779C info text with a >=7:1 token for WCAG AAA; add cinematic empty-states (the current copy is good, but pair with a seeded first offering/signal so members never land on a blank club)."
    ]
  },
  {
    "area": "NakaCult — Data Freshness & Fabrication (all cult_/naka_ tables)",
    "summary": "NakaCult is a richly-built shell sitting on top of a DEAD data pipeline. The platform-wide Vercel cron scheduler stopped firing on 2026-05-13 (verified: most_recent_any_cron = 2026-05-13 19:34 UTC across all 20 crons; today is 2026-06-25 — 43 days dark), which kills every NakaCult freshness mechanism: the \"Daily\" Seal hasn't regenerated since May 13 (1 row, stale 6 weeks), the Treasury snapshot is a literal placeholder with NULL balances, membership verification, proposal resolution, and the entire \"Ape or Nope\" game (cult-ape-open cron has NEVER run — 0 executions). Almost no code FABRICATES numbers — empty states are mostly honest (em-dash, \"the Oracle is silent\") and the treasury cron honestly gates on env_unset — but naka_trust_scores is polluted with garbage rows keyed by token SYMBOLS (\"usdc\",\"pepe\") not addresses, returning identical graceful-default layer scores (security 40 / liq 30 / holders 50 / market 40 / social 50 → 41) with null source details. The RETIRED \"Chosen\" lineage is NOT retired: profiles.is_chosen column is live with 3 chosen rows, useChosenStatus hook, ChosenLibraryCurator/ChosenSealDraftPanel components, gold_ring \"Chosen Ring\" cosmetic, and \"chosen_seal_written\" achievement all remain.",
    "findings": [
      {
        "severity": "P0",
        "title": "Entire NakaCult cron pipeline dead 43 days — Daily Seal, Treasury, Ape rounds, membership all frozen",
        "location": "vercel.json:34-43; cron_execution_log",
        "dataVerdict": "STALE",
        "evidence": "SQL: SELECT max(started_at), count(DISTINCT cron_name) FROM cron_execution_log → most_recent_any_cron='2026-05-13 19:34:24Z', 20 distinct crons. Per-cron: cult-generate-daily-seal last success 2026-05-13 07:00; cult-refresh-treasury last 2026-05-13 18:00; cult-verify-membership last 2026-05-13 03:00; cult-resolve-proposals last 2026-05-13 19:30. Daily counts: 555-705/day through 2026-05-13 then ZERO. Today is 2026-06-25. The on-demand trust-score route DID run 2026-06-23, so the app server is alive — only the Vercel cron scheduler is dead (likely disabled/disconnected project).",
        "recommendation": "Re-enable Vercel Cron (or external scheduler hitting these paths with CRON_SECRET). Add a health cron + alert if any cron hasn't logged a success in 2x its interval. Until fixed, every 'live/daily/snapshot' label in NakaCult is a lie."
      },
      {
        "severity": "P0",
        "title": "'Chosen' lineage is RETIRED but fully alive across DB + code (audit rule violation)",
        "location": "profiles.is_chosen column; lib/hooks/useChosenStatus.ts:18; components/vault/sanctum/ChosenLibraryCurator.tsx; components/vault/oracle/ChosenSealDraftPanel.tsx; app/api/cult/oracle/daily-seal/draft/route.ts; app/api/cron/cult-generate-daily-seal/route.ts:44,60,68; cult_cosmetics(gold_ring 'Chosen Ring'); cult_achievements(chosen_seal_written 'Hand of the Oracle')",
        "dataVerdict": "REAL",
        "evidence": "SQL: SELECT count(*) FILTER(WHERE is_chosen) FROM profiles → 3 chosen of 16. information_schema confirms profiles.is_chosen exists. cult_cosmetics row code='gold_ring' label='Chosen Ring'. cult_achievements code='chosen_seal_written'. daily-seal cron literally inserts model='chosen', context source='chosen_draft' and comment 'a Chosen member may have authored'. ApePanel + ape route still map is_chosen into leaderboard.",
        "recommendation": "Purge the Chosen concept: drop/rename profiles.is_chosen, delete useChosenStatus + ChosenLibraryCurator + ChosenSealDraftPanel, rename gold_ring cosmetic + chosen_seal_written achievement, strip is_chosen from every cult route payload and leaderboard. This is an explicit retired-feature remnant."
      },
      {
        "severity": "P1",
        "title": "naka_trust_scores polluted with symbol-keyed garbage rows + null-flood graceful-default pattern",
        "location": "naka_trust_scores table; lib/trust/calculate.ts:66,92,109,149,179 (default fallbacks)",
        "dataVerdict": "FABRICATED",
        "evidence": "SQL SELECT * FROM naka_trust_scores: 5 rows. 4/5 keyed by token SYMBOL not address ('usdc'/bsc, 'USDC'/solana, 'pepe'/ethereum, 'usdc'/avalanche) with details.security=null, details.liquidity=null and IDENTICAL layers 40/30/50/40/50 → score 41 (the exact graceful-default constants from calculate.ts when GoPlus+DexScreener return nothing for a non-address). Only the 5th row (real address 0xa0b8...eb48 USDC, computed 2026-06-23) has real DexScreener liquidity. These symbol rows are leftover test/demo lookups — a token can never resolve from a symbol, so the score is a constant placeholder masquerading as a computed score.",
        "recommendation": "Delete the 4 symbol-keyed rows; reject non-address inputs in the route (validate base58/0x before compute). Consider storing a 'partial=true' flag when a layer falls back to default so the UI can show 'insufficient data' instead of a confident 41/100."
      },
      {
        "severity": "P1",
        "title": "Treasury is a permanent placeholder — NULL balances, NAKA_TREASURY_WALLET never set, cron dead",
        "location": "cult_treasury_snapshots (1 row); app/api/cron/cult-refresh-treasury/route.ts:36-45; app/vault/conclave/TreasuryPanel.tsx; components/naka-cult/CultStatsStrip.tsx:84",
        "dataVerdict": "EMPTY",
        "evidence": "SQL SELECT * FROM cult_treasury_snapshots → single row balance_naka=NULL, balance_usd=NULL, source='manual', notes='Initial placeholder — to be replaced by treasury auto-refresh cron once NAKA_TREASURY_WALLET is set', captured_at 2026-05-04. Cron returns skipped='env_unset' when NAKA_TOKEN_CONTRACT/NAKA_TREASURY_WALLET unset (only 9 lifetime runs, all before May 13). UI is HONEST: TreasuryPanel renders '—' + owner hint; CultStatsStrip renders '…' for treasury. So no fabrication, but the headline Treasury number on the public /naka-cult landing has been blank since launch.",
        "recommendation": "Set NAKA_TOKEN_CONTRACT + NAKA_TREASURY_WALLET and revive the cron. The honest empty state is correct — but a members-only product showing a perpetually blank treasury reads as abandoned. Either wire real on-chain balance or hide the cell."
      },
      {
        "severity": "P1",
        "title": "'Ape or Nope' game has never had a single round — opener cron never executed",
        "location": "cult_ape_rounds (0 rows), cult_ape_votes (0 rows); app/api/cron/cult-ape-open/route.ts; vercel.json:42",
        "dataVerdict": "EMPTY",
        "evidence": "SQL counts: cult_ape_rounds=0, cult_ape_votes=0. SQL on cron log filtered '%ape%' → [] (zero executions ever). cult-ape-open is scheduled '0 8 * * *' in vercel.json but was added after the scheduler died 2026-05-13, so no round has ever opened. GET /api/cult/ape honestly returns round:null. The whole feature (ApePanel polling every 10s) renders an empty/no-round state indefinitely.",
        "recommendation": "Revive scheduler so cult-ape-open fires; or manually open the first round. Verify cult-ape-resolve (*/15) and the points/streak accounting once rounds exist. Until then the panel is a dead toy."
      },
      {
        "severity": "P2",
        "title": "cult_ambient_tracks: 8 tracks all point to ONE identical Spotify playlist with fabricated per-track durations",
        "location": "cult_ambient_tracks table; components/vault/CultPlayer.tsx",
        "dataVerdict": "FABRICATED",
        "evidence": "SQL SELECT * FROM cult_ambient_tracks: 8 rows, every storage_path='spotify:playlist:2tuf8ddMY5YPMlqzNWsVyC' (same playlist for all 8), distinct titles/artists (Ddergo, Naka Collective, VoV) and per-track duration_seconds (222,251,178,303,207,374,285,235) that cannot be real because all 8 resolve to the same playlist URI, not individual tracks. curated_by/curated_at NULL. This is seed/demo content presented as a curated 8-track soundtrack ('Soundtrack: 8 tracks · Curated by Ddergo' on the landing).",
        "recommendation": "Replace storage_path with real per-track Spotify track URIs (or real audio asset URLs) and real durations, or collapse to a single honest 'playlist' entry. As-is it is fabricated track metadata."
      },
      {
        "severity": "P2",
        "title": "All interactive cult tables empty — features built, never populated (no fabrication, but no life)",
        "location": "cult_proposals/votes/comments, cult_whispers/votes, cult_offerings/entries, cult_convictions, cult_signals, cult_hall_messages, cult_sage_messages, cult_echo_wallets, cult_member_achievements, cult_member_loadouts, cult_user_preferences, cult_daily_seal_drafts (all 0 rows)",
        "dataVerdict": "EMPTY",
        "evidence": "SQL count(*) across all cult_ tables: proposals 0, proposal_votes 0, proposal_comments 0, whispers 0, whisper_votes 0, offerings 0, offering_entries 0, convictions 0, signals 0, hall_messages 0, sage_messages 0, echo_wallets 0, member_achievements 0, member_loadouts 0, user_preferences 0, ape_rounds/votes 0, daily_seal_drafts 0. Routes (ape, daily-seal) verified to return null/empty honestly. Seed-only tables ARE populated: cult_achievements 6, cult_cosmetics 17, naka_prompts 7.",
        "recommendation": "With 3 cult members and zero activity in 6 weeks of dead crons, every interactive surface is a ghost town. Reviving the scheduler + seeding a first proposal/seal/ape-round is the unlock. Honest empty states are fine; what's missing is any real member-generated data."
      },
      {
        "severity": "P3",
        "title": "naka_prompts is REAL seed config and correctly wired (positive finding)",
        "location": "naka_prompts (7 rows); app/api/vtx/prompts/route.ts",
        "dataVerdict": "REAL",
        "evidence": "SQL SELECT * FROM naka_prompts: 7 curated suggestion prompts (Whale activity, Rug check, Smart money, etc.) with is_featured=true, sort_order 10-70, sane created_at 2026-04-17. These are intentional UI seed config (suggestion chips), not fabricated metrics, and are read by app/api/vtx/prompts/route.ts. Correct.",
        "recommendation": "No action. This is legitimate static config, not fake data."
      }
    ],
    "deadControls": [
      "app/api/cron/cult-ape-open/route.ts — scheduled but 0 executions ever; Ape/Nope game cannot start",
      "app/api/cron/cult-generate-daily-seal/route.ts — last fired 2026-05-13; 'Daily' Seal frozen 43 days",
      "app/api/cron/cult-refresh-treasury/route.ts — last fired 2026-05-13 + gated on unset NAKA_TREASURY_WALLET; Treasury permanently blank",
      "app/api/cron/cult-verify-membership/route.ts — last fired 2026-05-13; membership not re-verified for 43 days",
      "app/vault/conclave/TreasuryPanel.tsx — always renders '—' (no non-null snapshot exists)",
      "components/naka-cult/CultStatsStrip.tsx:84 — Treasury cell always '…'",
      "ApePanel.tsx — polls /api/cult/ape every 10s, perpetually round:null"
    ],
    "designUpgrades": [
      "Cron health rail: a members-only 'Sanctum Heartbeat' strip showing last Seal time, last Treasury snapshot, next Ape round — turn the (currently invisible) freshness into a Bloomberg-terminal-style status bar so staleness is impossible to hide.",
      "Trust Score confidence UI: when calculate.ts falls back to defaults, render a Linear-style 'insufficient data' chip instead of a confident 41/100 — institutional users distrust a score that can't show its sources.",
      "Treasury: replace the blank em-dash with a live on-chain balance card (Alchemy/Helius) + sparkline of cult_treasury_snapshots over time, Phantom-wallet aesthetic, once the wallet env is set.",
      "Daily Seal: add a true real-time reveal (SSE/websocket) at 07:00 UTC with the cinematic wax-seal animation, plus an archive timeline (Annals) — currently a single 6-week-old row.",
      "Ape/Nope: build a real-time sentiment orb (live vote tally via Supabase Realtime, not 10s polling) with a members leaderboard styled like Friend.tech keys.",
      "Purge Chosen end-to-end and replace any lineage cue with a single clean tier system; ship a migration that drops profiles.is_chosen so the retired concept can't resurface."
    ]
  },
  {
    "area": "NakaCult cron suite (10 crons) — function and cost audit",
    "summary": "The cult cron suite is architecturally sound on cost: every cron is auth/kill-switch gated via verifyCron (CRONS_PAUSED short-circuits in <50ms) and each does a cheap DB \"is there work?\" query before touching any external API. On a near-empty platform (verified: 0 ape rounds, 0 votes, 0 convictions, 0 offerings, 0 proposals, 0 signals, 3 cult members, 1 NULL placeholder treasury row, 1 stale seal) almost all of them exit with zero external calls. BUT two real problems: (1) the whole suite is DEAD IN PROD — cron_execution_log shows the last cult-cron run was 2026-05-13, ~6 weeks before today (2026-06-25), and 6 of the 10 crons (ape-open, ape-resolve, conviction-score, offering-draw, signal-feed, naka-cult-resolver) have NEVER logged a single run; (2) cult-ape-open is the one cron that does NOT short-circuit — every daily run fans out CoinGecko trending + up to ~15 sequential DexScreener price resolutions even though no human ever votes, and it carries a retired-\"Chosen\" remnant plus an invalid model id elsewhere in the suite. The treasury panel and daily seal render stale/placeholder data.",
    "findings": [
      {
        "severity": "P1",
        "title": "Entire cult cron suite is dead in production — last run 2026-05-13 (~6 weeks stale); 6 of 10 crons never logged a single execution",
        "location": "cron_execution_log (live DB); vercel.json:34-43",
        "dataVerdict": "STALE",
        "evidence": "SELECT cron_name,count(*),max(completed_at) FROM cron_execution_log WHERE cron_name LIKE 'cult%' OR cron_name LIKE 'naka-cult%' GROUP BY 1 → only 4 names ever logged: cult-generate-daily-seal (last 2026-05-13 07:00), cult-refresh-treasury (last 2026-05-13 18:00), cult-resolve-proposals (last 2026-05-13 19:30), cult-verify-membership (last 2026-05-13 03:00). Today is 2026-06-25. cult-ape-open, cult-ape-resolve, cult-conviction-score, cult-offering-draw, cult-signal-feed and naka-cult-resolver have ZERO rows in the log despite being present in vercel.json:34-43. Either CRONS_PAUSED=true was set (kill switch in _shared.ts:10) or the project stopped deploying/the Vercel cron schedule is detached. A members-only product whose seal, treasury, proposals and ape game silently froze 6 weeks ago is broken UX.",
        "recommendation": "Confirm CRONS_PAUSED env on Vercel and the deployed cron list. If paused intentionally, the product is mothballed — say so. If not, re-enable and verify each cron emits a cron_execution_log row. Add a health-watch assertion that pages when any cult cron's max(completed_at) is older than 2x its cadence."
      },
      {
        "severity": "P2",
        "title": "cult-ape-open is the only cult cron with NO empty-work short-circuit — every daily run hits CoinGecko + up to ~15 sequential DexScreener calls regardless of engagement",
        "location": "app/api/cron/cult-ape-open/route.ts:45-53",
        "dataVerdict": "N/A",
        "evidence": "The only guard is 'one active round at a time' (lines 33-43). With 0 rows in cult_ape_rounds (verified count=0) it always falls through to getTrendingTokens() then a for-loop calling resolveAssetPrice(t.symbol) per trending coin (coingecko.ts:396 trending is cached 1x/run; convictionPrice.ts:29-33 each resolveAssetPrice does getBestPair + searchPairs against DexScreener) until one prices — typically 1-15 DexScreener round-trips. It does this daily forever even though cult_ape_votes count=0 (nobody plays). Cost is bounded (daily cadence, DexScreener is free/keyless) so this is P2 not P1, but it is the single most expensive cult cron per run and it spins on a dead game.",
        "recommendation": "Gate ape-open behind real demand: only open a round if at least N cult members voted in the last week (or if an admin armed the game). Otherwise it manufactures rounds nobody sees. Also cap the resolveAssetPrice loop (e.g. break after 5 attempts) to bound worst-case DexScreener fan-out."
      },
      {
        "severity": "P1",
        "title": "cult-generate-daily-seal pins MODEL='claude-opus-4-7' — not a valid Anthropic model id; live seal row already used this fabricated id",
        "location": "app/api/cron/cult-generate-daily-seal/route.ts:11",
        "dataVerdict": "FABRICATED",
        "evidence": "const MODEL = 'claude-opus-4-7'. There is no Anthropic model named claude-opus-4-7. SELECT model,input_tokens,output_tokens FROM cult_daily_seals → {model:'claude-opus-4-7', in:185, out:251, seal_date:'2026-05-13'}. The one and only seal was produced ~6 weeks ago against a bogus model id; either the API silently accepted a deprecated alias then, or future runs 400 and the seal never regenerates (consistent with the cron being dead). The Daily Seal a member sees today is 6 weeks old.",
        "recommendation": "Set MODEL to a real current Anthropic id (e.g. a claude-opus-4.x / claude-sonnet-4.x id verified against the Anthropic model list). Add a fallback so a model 4xx logs to Sentry and retries with a known-good id rather than leaving the chamber on a stale seal."
      },
      {
        "severity": "P2",
        "title": "cult-refresh-treasury has only ever written nothing — env unset, so the Treasury Panel renders a NULL manual placeholder; the cron is decorative",
        "location": "app/api/cron/cult-refresh-treasury/route.ts:33-45; cult_treasury_snapshots (live)",
        "dataVerdict": "EMPTY",
        "evidence": "SELECT * FROM cult_treasury_snapshots → 1 row: {balance_naka:null, balance_usd:null, source:'manual', notes:'Initial placeholder — to be replaced by treasury auto-refresh cron once NAKA_TREASURY_WALLET is set', captured_at:'2026-05-04'}. cron logged 9 runs at avg 0ms = it hit the env_unset short-circuit (lines 36-45) every time because NAKA_TOKEN_CONTRACT/NAKA_TREASURY_WALLET are unset. Net: the Conclave Treasury Panel shows null/'—', not real money. Correctly costs $0 (good short-circuit), but the feature is non-functional. NOTE the cron's USD enrichment at line 77 calls getDexPrice(tokenContract) which is correct, and EVM .toLowerCase at line 54 is acceptable (EVM only).",
        "recommendation": "Either set the treasury envs and verify a real Alchemy/Helius balance + DexScreener USD row lands, or hide the Treasury Panel until $NAKA mints. Do not ship a panel backed by a NULL placeholder row to a paying members club."
      },
      {
        "severity": "P2",
        "title": "Retired 'Chosen' lineage still wired through the daily-seal draft path and the membership/holdings resolvers",
        "location": "app/api/cron/cult-generate-daily-seal/route.ts:46-88; app/api/cron/cult-verify-membership/route.ts:104-110; lib/cult/holdings.ts:140,188",
        "dataVerdict": "N/A",
        "evidence": "Per the brief the Chosen badge/lineage is RETIRED. Remnants: daily-seal route.ts:48-88 reads cult_daily_seal_drafts authored by 'a Chosen member', inserts the seal with model:'chosen' and context_json.source='chosen_draft' + author attribution. cult-verify-membership route.ts:104-110 actively syncs profiles.is_chosen from holdings.isChosen. holdings.ts:140 and :188 set isChosen = hasDevNft. cult_daily_seal_drafts is empty (count=0) so the Chosen draft branch is dead code, but it and the is_chosen writes are live remnants of a retired concept.",
        "recommendation": "Rip out the Chosen-draft branch in cult-generate-daily-seal (or repoint 'chosen' drafts to a neutral 'member_draft' concept if member-authored seals survive the retirement), and stop writing/reading profiles.is_chosen in cult-verify-membership and holdings.ts. Confirm with product whether member-authored seals are a kept feature before deleting the draft pipeline."
      },
      {
        "severity": "P3",
        "title": "naka-cult-resolver and entitlements lower-case EVM wallet addresses inline instead of using lib/utils/addressNormalize",
        "location": "app/api/cron/naka-cult-resolver/route.ts:51; lib/cult/entitlements.ts:50,67; lib/cult/holdings.ts:120",
        "dataVerdict": "N/A",
        "evidence": "naka-cult-resolver route.ts:51 does set.add(w.address.toLowerCase()) and entitlements.ts:50 does addresses.filter(isEvm).map(a=>a.toLowerCase()). These are guarded by an EVM regex first (/^0x[a-fA-F0-9]{40}$/) so they never touch a Solana address — functionally safe (EVM is case-insensitive). But CLAUDE.md and the audit rule say never call .toLowerCase() directly on an address; use lib/utils/addressNormalize. This is a convention violation, not a Solana-corruption bug.",
        "recommendation": "Route these through lib/utils/addressNormalize so a future refactor that removes the EVM-only guard can't silently lowercase a Solana wallet. Low priority because the current EVM regex makes it safe today."
      },
      {
        "severity": "P3",
        "title": "Six cult crons run on tight cadences (every 10-15m) against permanently-empty tables — cheap but pure invocation waste on a dead platform",
        "location": "vercel.json:38-43 (resolve-proposals */10, offering-draw */15, ape-resolve */15); cult-signal-feed hourly; cult-resolve-proposals/route.ts:39-43",
        "dataVerdict": "EMPTY",
        "evidence": "cult-resolve-proposals ran 303 times (avg 231ms) and every logged row has items_processed:0 (verified) because cult_proposals active count=0. ape-resolve (*/15) selects open rounds (0), offering-draw (*/15) selects open offerings (0), signal-feed (hourly) reads cult_convictions (0). Each short-circuits cheaply (the resolve-proposals select-then-return at lines 39-43 is one indexed query), so the cost is just the Vercel invocation, not external APIs. With CRONS_PAUSED these are already free. This is the correct pattern — flagging only that 6 sub-minute-to-15m crons are armed for a feature with zero activity.",
        "recommendation": "No code change needed for cost (short-circuits are correct). When relaunching, consider widening ape-resolve/offering-draw to */15 is fine but signal-feed and proposals could move to event-driven (resolve on the request that closes the last vote) instead of polling. Keep CRONS_PAUSED until the cult actually has members generating rows."
      }
    ],
    "deadControls": [
      "cult-ape-open / cult-ape-resolve — armed in vercel.json:42-43 but cult_ape_rounds + cult_ape_votes are empty (count=0) and neither has ever logged a run; the Ape-or-Nope game is effectively dead",
      "cult-offering-draw (vercel.json:39) — cult_offerings empty, never logged",
      "cult-signal-feed (vercel.json:41) — cult_signals empty (0 rows), never emitted a signal",
      "cult-conviction-score (vercel.json:40) — cult_convictions empty, never logged",
      "naka-cult-resolver (vercel.json:36) — never logged; grants/revokes entitlements but no run recorded",
      "cult-refresh-treasury — runs but only ever hits env_unset short-circuit; Treasury Panel backed by a NULL manual placeholder row",
      "cult-generate-daily-seal Chosen-draft branch (route.ts:48-88) — cult_daily_seal_drafts empty; dead code for a retired concept"
    ],
    "designUpgrades": [
      "Cron observability surface (Bloomberg-terminal style): an admin /admin/cult/crons grid showing each cult cron's last run, cadence, items_processed, and a red 'STALE' chip when max(completed_at) > 2x cadence — would have surfaced the 6-week outage immediately instead of a silent freeze.",
      "Demand-gated game engine: instead of cult-ape-open manufacturing a round daily into the void, drive round creation from real member activity (Linear-style 'nothing to do' empty states) and only spend CoinGecko/DexScreener calls when there is an audience.",
      "Treasury Panel realtime: once $NAKA mints, replace the 6h snapshot cron with a Supabase realtime channel on cult_treasury_snapshots + a live Phantom-style balance card; until then render an explicit 'Treasury goes live at mint' state, never a NULL placeholder.",
      "Daily Seal freshness guarantee: a member-facing 'sealed at <date>' stamp plus a self-healing regenerate-on-read fallback so a dead cron can never leave the chamber on a 6-week-old seal; pin a verified current Anthropic model id and prompt-cache the system context.",
      "Kill-switch transparency: when CRONS_PAUSED is on, the cult chamber should show a quiet 'rituals paused' banner to members rather than silently serving frozen state — members-only products lose trust fast when features just stop."
    ]
  },
  {
    "area": "NakaCult Design System and Branding",
    "summary": "Test minimal payload to isolate schema validation.",
    "findings": [
      {
        "severity": "P1",
        "title": "test",
        "location": "a:1",
        "dataVerdict": "N/A",
        "evidence": "e",
        "recommendation": "r"
      }
    ]
  },
  {
    "area": "NakaCult — cross-cutting audit (Chosen remnants, WCAG AAA, mobile, CultPlayer/CultStatsCounter, dead-code, entitlements)",
    "summary": "The \"Chosen\" badge/lineage that is supposed to be RETIRED is not retired — it is load-bearing across ~12 cult API routes, the Vault IdentityStrip (\"Chosen\" rank), the Vault landing (\"Chosen Seals\" live stat = 3), the /naka-cult landing (\"--chosen\" entry card), docs, and the cult_stats DB view. Worse, the Vault's own stats are wrong: cult_stats.active_members reads tier='naka_cult' (=0) while the gate and landing read cult_member=true (=3), so a member who just walked into the Vault sees \"Active Cultists: 0\". CultPlayer.tsx and CultStatsCounter.tsx are individually correct and honest about empty data, but vault.css carries ~200 lines of dead player styles and the three headline chambers are rendered as disabled \"Coming soon\" while their full routes exist and work. WCAG AAA has real small-text failures from rgba(200,214,255,0.55) (4.62:1). No console.log/any/empty-catch in the component layer — that part is clean.",
    "findings": [
      {
        "severity": "P0",
        "title": "cult_stats view is STALE — counts tier='naka_cult' (0) instead of cult_member=true (3); Vault shows 'Active Cultists: 0' to real members",
        "location": "DB view cult_stats; app/vault/page.tsx:23-31,134",
        "dataVerdict": "STALE",
        "evidence": "pg_get_viewdef(cult_stats) = active_members := count(*) WHERE profiles.tier='naka_cult'. SQL: SELECT count(*) FILTER(WHERE tier='naka_cult')=0, count(*) FILTER(WHERE cult_member=true)=3. cult_stats returns {active_members:0, chosen_count:3, total_naka_held:null, decrees_passed:0}. The gate getCultAccess (lib/cult/access.ts:105) and the landing CultStatsStrip (components/naka-cult/CultStatsStrip.tsx:55) both correctly use cult_member=true → 3. The view predates the cult/tier decouple migration and was never updated.",
        "recommendation": "Rewrite cult_stats: active_members := count(*) WHERE cult_member=true. Drop chosen_count entirely (Chosen is retired). Keep decrees_passed (real: 0 proposals) and total_naka_held NULL until on-chain resolver. One CREATE OR REPLACE VIEW; mirror into supabase/migrations for parity."
      },
      {
        "severity": "P0",
        "title": "RETIRED 'Chosen' badge/lineage still rendered live across Vault + landing + DB stat",
        "location": "components/vault/IdentityStrip.tsx:28; app/vault/page.tsx:137; app/naka-cult/page.tsx:169; app/naka-cult/landing.css:432-441; app/docs/vault/page.tsx:319-323,447; components/ui/TierBadge.tsx:58",
        "dataVerdict": "REAL",
        "evidence": "IdentityStrip.tsx:28 renders {isChosen?'Chosen':'Cultist'} as the Vault header rank pill. vault/page.tsx:137 ships a live stat {label:'Chosen Seals', value: stats?.chosen_count} — SQL confirms chosen_count=3 (is_chosen=true on 3/16 profiles), so the retired badge is showing real numbers to users. naka-cult/page.tsx:169 renders <article className='nakacult-entry nakacult-entry--chosen'> with gold CSS at landing.css:432-441. docs/vault/page.tsx:319 'The Chosen Seal' lineage section. The instruction says Chosen badge/lineage is RETIRED and any remnant is a defect.",
        "recommendation": "Remove the 'Chosen' rank from IdentityStrip (show only the cult sigil + name, or 'Member'). Delete the 'Chosen Seals' stat cell from vault/page.tsx. Rename .nakacult-entry--chosen to a neutral 'primary/featured' modifier. Strip the 'Chosen Seal / Lineage' section from docs/vault. Update TierBadge popover copy (remove 'the lineage')."
      },
      {
        "severity": "P1",
        "title": "'Chosen' is load-bearing in ~12 cult API routes (vote weight 2x, leaderboard pinning, gated writes) — retiring it is a real migration, not a delete",
        "location": "lib/cult/access.ts:44-45,120; app/api/cult/proposals/[id]/vote/route.ts:57,68; app/api/cult/ape|hall|conviction/route.ts; app/api/cult/sanctum/library/[id]&reorder, oracle/echo, annals, daily-seal/draft",
        "dataVerdict": "REAL",
        "evidence": "Grep is_chosen|isChosen across app/api/cult: vote/route.ts:57 `const weight = access.isChosen ? 2 : 1`; ape/hall/conviction return isChosen per author for leaderboard treatment; sanctum/library/[id]:24, reorder:27, oracle/echo:52, annals:62, daily-seal/draft:74 all gate writes on `if(!access.isChosen)`. access.ts:44 comment still says 'Development NFT path → Chosen Seal benefits'. is_chosen=true on exactly 3 profiles.",
        "recommendation": "Decide the post-Chosen governance model before ripping: either (a) collapse weight to 1 for everyone and open curation/echo/daily-seal writes to all cult_members, or (b) replace 'Chosen' with a holdings-weighted or role-based gate. Until decided, this is the single biggest cleanup blocker — track it as one epic, not scattered edits, so vote-weight aggregates stay consistent (cult_proposal_votes.weight is captured at insert)."
      },
      {
        "severity": "P1",
        "title": "Three headline chambers (Conclave/Oracle/Sanctum) are rendered as disabled 'Coming soon' although their routes are fully built and live",
        "location": "app/vault/page.tsx:59-83 (comingSoon flags); components/vault/ChamberPortal.tsx:59-61",
        "dataVerdict": "REAL",
        "evidence": "vault/page.tsx passes comingSoon to all three primary ChamberPortals; ChamberPortal.tsx:59-61 then renders them as <div aria-disabled='true' class='cursor-not-allowed'> with CTA text 'Coming soon' and NO Link. But the routes exist and are substantial: app/vault/conclave/ConclaveClient.tsx (128 lines, realtime), components/vault/oracle/OracleHubClient.tsx, components/vault/sanctum/SanctumHubClient.tsx, with page.tsx wrappers. Meanwhile the secondary 'Commons' chambers (ape/hall/offering/conviction/pulse) ARE clickable. The marquee chambers are dead links; the side features are live — backwards.",
        "recommendation": "Remove the comingSoon flag from the three primary portals so they link to their (already shipped) routes, or gate the flag on a real readiness check. A disabled primary CTA with a working route behind it is the worst of both worlds for an institutional product."
      },
      {
        "severity": "P1",
        "title": "WCAG AAA small-text failure: rgba(200,214,255,0.55) ≈ 4.62:1 on #050816 used for sub-14px text",
        "location": "app/naka-cult/landing.css:352 (.nakacult-stats__sub 10px), :422 via 0.78 ok but :409 feature__num, :450 entry__foot; app/vault/vault.css:829 (.cult-player__track-artist 10.5px), :813 (.cult-player__track 12px)",
        "dataVerdict": "N/A",
        "evidence": "Computed contrast (sRGB WCAG formula) on bg #050816: rgba(200,214,255,0.55) blended = #707996 → 4.62:1. AAA normal text needs 7.0:1; these uses are 10-12px (not large text), so they FAIL AAA (and only scrape AA). For reference 0.72 opacity = 7.32 (passes) and 0.78 = 8.53 (passes); the brand greys #B4C0E0 (10.98), #D5DEFF (14.93), #FFD86B (14.52), #00C8FF (10.17), #C8D6FF (13.79) all PASS AAA.",
        "recommendation": "Raise every sub-14px rgba(200,214,255,0.55) to at least 0.72 opacity (or solid #919CBE) to clear 7:1. Specifically: .cult-player__track / __track-artist, .nakacult-stats__sub, and any 0.55 small text. Larger 0.55 text (>=24px) is fine."
      },
      {
        "severity": "P2",
        "title": "~200 lines of dead CSS for a CultPlayer UI that no longer renders (Spotify-bar + self-hosted controls)",
        "location": "app/vault/vault.css:643-843 (__bar/__sigil/__meta/__cta/__pane) and :908-929 (__seek/__controls/__ctrl)",
        "dataVerdict": "N/A",
        "evidence": "vault.css:845-850 comment states the bar styles 'are no longer rendered' and the player was rebuilt as orb+panel. CultPlayer.tsx only emits .cult-player, __panel, __panel-head, __np-wrap, __eyebrow, __np, __artist, __icon-btn, __embed, __orb, __orb-ring, __orb-icon. The entire __bar block (643-731), the old __pane block (734-792 partially superseded), and the __seek/__seek-fill/__controls/__ctrl/__ctrl--play block (908-929) reference classes the component never outputs. CLAUDE.md forbids dead code.",
        "recommendation": "Delete the superseded __bar/__sigil(bar variant)/__meta/__cta/__pane and __seek/__controls/__ctrl blocks. Keep only the orb+panel rules actually rendered by CultPlayer.tsx."
      },
      {
        "severity": "P2",
        "title": "CultPlayer mobile: orb sits 80px above bottom but no guaranteed clearance from a member bottom-nav; collision risk on small screens",
        "location": "app/vault/vault.css:832-837 (@media max-width:520px) and :931-934",
        "dataVerdict": "N/A",
        "evidence": "At <=520px the player is pinned inset-block-end:80px / inset-inline-end:12px and the orb is 54px. There is no safe-area-inset-bottom padding and no awareness of a bottom tab bar; on iOS the 80px can overlap the home indicator + any sticky member nav. The panel is calc(100vw-24px) which is fine. No functional bug in CultPlayer.tsx logic (consent gating, localStorage persistence, library override fetch are all correct and degrade gracefully).",
        "recommendation": "Add env(safe-area-inset-bottom) to inset-block-end and verify against the actual mobile chrome. Confirm the orb doesn't cover the last Commons card CTA on a 360px viewport."
      },
      {
        "severity": "P3",
        "title": "CultPlayer playlist-override fetch has no abort and runs on every Vault mount; minor — but note it is REAL-data wired (no mock)",
        "location": "components/vault/CultPlayer.tsx:52-65",
        "dataVerdict": "REAL",
        "evidence": "On mount it fetches /api/cult/sanctum/library and looks for a 'spotify:playlist:' row to override the default Ddergo playlist (DEFAULT_PLAYLIST 4ZjnNBKs9x7XdHPLQJmsiK). cult_ambient_tracks has 8 active rows (SQL confirmed). The default playlist id is owner-provided real content, not mock. Cleanup uses a cancelled flag (no leak). CultStatsCounter.tsx is correct: null→em-dash (honors no-mock-data invariant), count-up via IntersectionObserver, RAF cleanup present.",
        "recommendation": "Optional: AbortController on the fetch and a short cache. Not a defect — flagged only to confirm CultPlayer/CultStatsCounter are correct and data-honest. entitlements.ts is also correct: idempotent, non-destructive, never re-extends Founder grant, and does NOT lowercase Solana addresses (only EVM, which is safe)."
      },
      {
        "severity": "P2",
        "title": "entitlements.ts lowercases addresses directly instead of using lib/utils/addressNormalize — safe today (EVM-only) but violates the project rule",
        "location": "lib/cult/entitlements.ts:23,26,29,50,67",
        "dataVerdict": "N/A",
        "evidence": "Lines 23/26/29 .toLowerCase() the NIPPO/Founder/NAKA EVM contract constants; :50 maps verified addrs `.map(a=>a.toLowerCase())` after filtering isEvm; :67 lowercases balance contractAddress. All guarded by isEvm (/^0x[a-fA-F0-9]{40}$/), so no Solana address is ever lowercased — functionally correct. But CLAUDE.md mandates lib/utils/addressNormalize for all address comparisons and forbids raw .toLowerCase on addresses.",
        "recommendation": "Route the EVM comparisons through addressNormalize (or its EVM-checksum helper) for rule-compliance and future-proofing if a non-EVM branch is ever added to this resolver. Low urgency since the isEvm guard makes it safe now."
      }
    ],
    "deadControls": [
      "app/vault/page.tsx:59-83 — three primary chamber portals (Conclave/Oracle/Sanctum) are flagged comingSoon and render as non-clickable disabled divs (ChamberPortal.tsx:59-61) despite live routes existing",
      "app/vault/vault.css:643-843,908-929 — dead CSS classes (__bar/__sigil bar-variant/__meta/__cta/__pane/__seek/__controls/__ctrl) for a player UI that CultPlayer.tsx no longer renders",
      "app/vault/page.tsx:137 — 'Chosen Seals' stat cell (retired badge) still shipped, fed by stale cult_stats.chosen_count",
      "components/vault/IdentityStrip.tsx:28 — 'Chosen' rank pill (retired badge) still rendered in Vault header"
    ],
    "designUpgrades": [
      "Fix the member-count truth source: one cult_stats rewrite so the Vault landing, the /naka-cult landing, and any future admin view all read cult_member=true. A members-club that tells a member 'Active Cultists: 0' the moment they walk in destroys the exclusivity illusion — Friend.tech/Bloomberg never show you a zero you know is wrong.",
      "Make the three headline chambers live and cinematic: remove comingSoon, add a real per-chamber readiness/health indicator (last Decree time, last Daily Seal time, treasury freshness) like a Bloomberg status line, instead of a flat 'Coming soon' on working routes.",
      "Replace the retired Chosen tier with a single clean institutional identity treatment: one 'Member' sigil, holdings-tier-derived accenting (NIPPO vs NAKA-threshold) shown subtly — Phantom-style minimal, not gold-cape gamification.",
      "Real-time everywhere members expect it: the Conclave already does Supabase realtime (ConclaveClient.tsx:40); extend live presence (who's in the Vault now) and a live treasury tick to the landing stats strip so 'Treasury' stops showing '…' — wire cult_treasury_snapshots to a real on-chain balance job (currently 1 snapshot row with balance_usd=null).",
      "AAA-clean typographic system: bump all sub-14px muted text to >=0.72 opacity / solid token, and codify a token scale (no ad-hoc rgba(...,0.55)) so contrast is enforced by design tokens, Linear/Arc-style.",
      "Mobile: respect safe-area insets for the CultPlayer orb and any bottom nav, and make the orb dockable so it never covers a chamber CTA on a 360px phone."
    ]
  }
]
```
