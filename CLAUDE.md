# Project Rules for Claude Code Sessions

Read this file top to bottom BEFORE writing code, and again before any commit.
These rules are not suggestions. The owner (Puffnutz / moderator29 /
Phantomfcalls@gmail.com) has repeated them many times. Breaking them wastes his
time and breaks his trust.

This is **nakalabs.xyz** (internal codename "steinzlabs"): a production,
non-custodial, multi-chain crypto intelligence + social + trading platform.
Next.js app-router + TypeScript + Tailwind + Supabase.

---

## 0. THE THREE RULES THAT MATTER MOST

1. **MOBILE FIRST, ALWAYS.** The owner tests on a phone. If it looks right on
   desktop but is scattered, half-rendered, drifting sideways, or cramped on
   mobile, it is BROKEN and the task is not done. Design for a 390px-wide
   screen first, then let it scale up. Never ship a screen you have not
   reasoned about at mobile width. This is the #1 recurring complaint. Do not
   repeat it.
2. **REAL DATA ONLY. NEVER FABRICATE.** No fake prices, odds, counts, logos,
   market caps, or on-chain results. If real data is unavailable, show a clean
   empty/error state, never invented numbers. (The one exception: seeded social
   content the owner explicitly asked for, e.g. the demo Wire post, which is a
   real DB row, not fabricated market data.)
3. **NON-CUSTODIAL, ALWAYS.** Reuse the existing audited signer / relayer.
   Never create new custody, never take control of user keys or funds. Every
   trade/gift/transfer is signed by the user's own wallet.

---

## 1. Where the project lives

- **On disk:** `/workspace/steinzlabs` (NOT `/home/user/Wegram-`, which some
  environments set as the default cwd). Always `cd /workspace/steinzlabs` first.
- **GitHub:** `github.com/moderator29/steinzlabs`
- **Deploy:** Vercel auto-deploys from `main`.

---

## 2. Brand + design system (the "2030 magnificent" bar)

The platform must feel professional, clean, fast, vast, and modern ("2030
standard"). It is a premium product, not a template.

### Visual language
- **Glass, not white boxes.** Use the brand glass surfaces (`nl-glass`,
  `nl-aurora-bg`, brand gradients). NEVER wrap content in a plain white/gray
  rectangle or a hard bordered container. If you see a big white line/box around
  a section (stats, compose input, watchlist chips), replace it with brand glass.
- **Full-page, not caged.** Primary surfaces (compose, chat, market detail)
  should feel full-page and native, like X/Robinhood, not a small card floating
  in the middle of the screen.
- **Flat lucide icons only.** No 3D / neon-blue / glossy gradient icons (that
  was the "slop" that got removed). Clean, flat, consistent line icons.
- **Keep the motion/glow.** The aurora background and soft glow ARE wanted. The
  slop was the 3D icons, not the ambient motion. Do not flatten the aurora.
- **Brand colors:** primary blue `#0066FF`, emerald `#10B981` (up/YES), rose for
  down/NO. Use the existing brand tokens in `globals.css` / `globals-brand.css`.
- **Token symbols pull real logos.** BTC/ETH/SOL/BNB etc. must render their real
  coin logo, not a lettered placeholder, wherever a real logo is available.

### Specific conventions the owner has called out
- **The "?" help icon:** small icon, with the ring/circle sitting CLOSE and tight
  around the "?" (small gap), and the icon itself roughly double its old size.
  This applies on mobile AND desktop. The distance from the circle to the "?" has
  been wrong for a long time. Get it tight.
- **Top tab bars must not shift the whole UI** to re-center the active tab. The
  active item highlights in place; the row does not slide the interface around.
- **No duplicate/persistent highlight box** bleeding across tabs (e.g. the VTX
  message tab highlight showing up on the messaging UI). Each surface owns its
  own active state.
- **Filter / option pickers** (New crypto, Memes, AI, AGI, etc.): lay options out
  as a vertical list behind a single "Options" button that expands inline (like
  the Context Feed "all chains" picker), each option with an icon. Selecting one
  should AUTO-APPLY and CLOSE the picker (do not force the user to hit "Clear" to
  escape). Keep the AI filter chips in the Wire message area; the owner likes
  those, do not remove them.
- **Market detail order (mobile especially):** chart FIRST, then the tabs below
  it, then the stats / buy-sell area. Never stack stats above the chart. No
  stray stuck buy/sell button pinned at the bottom.
- **Nothing renders "half" or sideways.** Every page must fit the mobile
  viewport with no horizontal drift and no half-painted panels.

### Naming
- The social feed / compose surface is called **"The Wire."** Never "Feed."
- Product is **Naka** / **nakalabs.xyz**.

---

## 3. Writing style

- **NO EM-DASHES anywhere** in user-facing copy, docs, commit messages, or code
  comments. Use a period, comma, colon, or parentheses instead. The ONLY allowed
  use of the `—` character is as a pure no-value placeholder in code (e.g.
  showing `—` when a number is null). This file itself contains none.
- Clean, confident, human copy. No AI-slop phrasing, no hedging filler.

---

## 4. Git commit rules (STRICT)

### Identity
- Author every commit as
  `moderator29 <101205446+moderator29@users.noreply.github.com>`.
- If git config differs, set it first:
  ```bash
  git config user.name "moderator29"
  git config user.email "101205446+moderator29@users.noreply.github.com"
  ```

### Forbidden in commit messages
Never include any AI attribution: no `Co-Authored-By: Claude`, no
`Generated with Claude Code`, no `Generated by Claude`, no `AI-assisted`, no
model identifiers (e.g. `claude-opus-*`), no variant of the above.

### Forbidden in code, comments, docs, READMEs, PR descriptions
No "Generated by Claude", "AI-generated", "Built with Claude Code", no comments
naming Claude/AI, no auto-generated AI attribution headers, no model IDs.

### Branching and merging
- Never commit to `main`. Only the owner merges to main (Vercel deploys from it).
- Prefer functional branch names: `feat/...`, `fix/...`, `refactor/...`,
  `chore/...`, `security/...`. (When a harness forces a `claude/...` branch for a
  managed session, that is the exception, not the norm.)
- Push the branch with `git push -u origin <branch>` (retry with backoff on
  network errors). Do NOT open a PR unless the owner explicitly asks.

### Commit message format (Conventional Commits)
`feat:` `fix:` `refactor:` `chore:` `docs:` `test:` `style:` `perf:` `security:`
```
feat: implement whale tracker live feed with SSE

Wires Alchemy webhooks to a Server-Sent Events endpoint so the frontend
receives whale activity in real time without polling.
```

---

## 5. Code style

- No `any` types unless truly necessary (document why).
- No `console.log` in production code (use proper logging).
- No commented-out code (delete it, git remembers).
- No empty `try/catch`.
- Functions over 50 lines get a brief docstring.
- Match existing patterns. Do not introduce new ones without reason.
- Use `lib/utils/addressNormalize.ts` for all address comparisons. Never call
  `.toLowerCase()` directly on a wallet/token address (Solana is case-sensitive).

---

## 6. Data + APIs (no mock data)

Wire to the real services: CoinGecko, Alchemy, Helius, GoPlus, Jupiter, 0x,
DexScreener, Pyth Hermes, alternative.me, Anthropic, Supabase, GoldRush/Covalent
(optional + fallback). If data is unavailable, return an empty state with an
honest error. Never hardcoded sample wallets, never stubbed prices.

---

## 7. Supabase

- Prefer `apply_migration` via MCP and mirror SQL into `supabase/migrations/` for
  repo parity.
- Never bypass RLS via `service_role` from a client-callable endpoint without
  explicit user-id binding.
- Verify columns against the LIVE db (`list_tables` / `execute_sql`), not stale
  migration files. Past audits produced false "missing column" claims from old
  migrations.
- Known gotchas: `whales.label` (not `name`); `price_alerts.price` (not
  `target_price`); `user_wallets_v2.wallets` is JSONB with `default_address`
  separate.

---

## 8. Security

- Never commit secrets/keys/credentials. `.gitignore` blocks `.env*` and
  `.vercel/`; do not work around it.
- Never log private keys, seed phrases, passwords, or raw JWTs.
- Server-side validate everything; never trust the client alone.
- See `SECURITY.md` for the full policy.

---

## 9. Documentation

- Update `/docs/` when a feature changes meaningfully.
- Update `README.md` for major features / setup changes.
- Update `CHANGELOG.md` per release.

---

## 10. Required reading before multi-section work

- `HANDOFF.md` (latest cross-session state, at repo root)
- `docs/sessions/HANDOFF-session-A.md`
- `docs/sessions/HANDOFF-session-B.md`
- `docs/sessions/HANDOFF-session-C.md`
- `docs/cleanup-2026-05/audit-findings.md`

---

## 11. Definition of done (check before you say "done")

- [ ] Looks right at **mobile width (390px)** first, then desktop. No drift, no
      half-render, no sideways layout.
- [ ] Real data or an honest empty/error state. No fabricated values.
- [ ] Brand glass surfaces, flat icons, real token logos. No white boxes.
- [ ] No em-dashes in any copy, comment, or message.
- [ ] `npx tsc --noEmit` clean AND `npm run build` green.
- [ ] Committed as moderator29 with no AI attribution, pushed to the branch.
