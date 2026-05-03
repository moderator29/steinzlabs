# The Conclave

The Conclave is the governance chamber. Cult members author **Decrees**, **Whispers**, or **Treasury motions**, vote yes / no / abstain, and watch live as the bar shifts. Passed Decrees shape the platform.

## Routes

- `/vault/conclave` — proposal hub. Treasury panel + tabbed proposal list (Active / Passed / Failed / All) + author modal.

## API

| Route | Verb | What |
|-------|------|------|
| `/api/cult/proposals` | GET | List proposals (`?status=active|passed|failed|all`) |
| `/api/cult/proposals` | POST | Author a new proposal |
| `/api/cult/proposals/:id/vote` | POST | Cast or change a vote |

All routes call `getCultAccess()` first; non-cult users get 403.

## Tables (`2026_05_02_conclave.sql`, applied live)

- `cult_proposals` — id, kind (decree/whisper/treasury), title, body, stake_naka, status, yes/no/abstain weights, voter_count, ends_at, resolved_at. RLS: cult-read.
- `cult_proposal_votes` — composite PK on (proposal_id, voter_id). Stores choice + weight + is_chosen at vote time. RLS: cult-read.
- `cult_proposal_comments` — threaded discussion under each proposal (parent_id self-FK). RLS: cult-read, cult-self-insert.
- `cult_treasury_snapshots` — periodic balance snapshot (NAKA + USD), source enum, captured_at. RLS: cult-read, admin-write.
- `cult_stats` view — refreshed to count `decrees_passed` from real proposals.

## Vote weighting

Weight = 1 per cultist, 2 per Chosen (Elder-Decree double-weight rule from §8.2 of the spec). The on-chain holdings-weighted formula (`sqrt(naka_balance)`) lands once `lib/cult/holdings.ts` reads the connected wallet's $NAKA balance.

## Real-time

The current implementation polls `/api/cult/proposals?status=...` every 10s while the tab is visible. Supabase Realtime subscriptions will replace polling in a follow-up — every INSERT/UPDATE on `cult_proposal_votes` will push the vote orb burst directly to viewers without waiting on the interval.

## Resolution job (next pass)

A scheduled function will run every minute and flip `status` from `active` to `passed`/`failed` once `ends_at < now()`. Pass rule: `yes_weight > no_weight` AND `voter_count >= 5`. Failed otherwise. Author stake is returned on pass, slashed on fail to the treasury (Decree-only).

## UI components

- `ConclaveClient.tsx` — top-level client component. Tab state, polling loop, list rendering.
- `ProposalCard.tsx` — single proposal with the live vote bar, three vote buttons, urgency animation in the last hour.
- `CreateProposalModal.tsx` — author form. Title 6-140 chars, body 30-5000, stake input, voting window (24h / 48h / 3d / 7d).
- `TreasuryPanel.tsx` — server-rendered latest treasury snapshot (renders em-dash + owner instructions until first row exists).

## Owner action items

1. Insert the first treasury snapshot once the on-chain treasury wallet is set up:
   ```sql
   INSERT INTO cult_treasury_snapshots (balance_naka, balance_usd, source, notes)
   VALUES (2400000, 48000, 'manual', 'Initial seed');
   ```
2. Optional: schedule a cron in Vercel hitting a future `/api/admin/cult/refresh-treasury` endpoint that reads the live balance via Alchemy/Helius and inserts a fresh snapshot.
