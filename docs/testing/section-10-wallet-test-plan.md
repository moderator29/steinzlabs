# §10 — Swap Wallet Connection — Real-Device Test Plan

> **Audience**: Phantomfcalls (the only person who can run this).
> **Why**: WalletConnect v2 + mobile deep links only fail in production-like
> conditions. Dev tooling lies. Run these four flows end-to-end before
> calling §10 done.
>
> **Context**: §10 wires Reown AppKit (Web3Modal v5 successor) into the
> swap page. Project ID `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is already
> in `.env.local` and prod env. Vercel deploy uses `nodejs` project under
> team `phantomfcalls-8856s-projects`.

---

## Pre-flight (do once, before any phone test)

1. `cd dev/steinzlabs && git pull && npm install` to pick up new deps
   (`@reown/appkit*`, `wagmi`, `@tanstack/react-query`).
2. Verify env: `vercel env ls | grep WALLETCONNECT_PROJECT_ID` — should
   show Production / Preview / Development entries.
3. In **https://cloud.reown.com** → your project → **Domains**, ensure
   the production URL (e.g. `nakalabs.xyz`) is whitelisted. Without
   this, mobile deep links fail with origin mismatch.
4. `npm run build && npm run start` and smoke-test on desktop first:
   - Open the swap page in Chrome with MetaMask extension installed.
     Connect should work.
   - Open in incognito (no extension). Connect should show
     WalletConnect QR.

If any pre-flight step fails, stop — it's a config issue, not a flow
bug.

---

## The four real-device flows

Each flow is **one round trip**: phone opens dapp → taps Connect →
approves in wallet app → returns to dapp connected → executes a tiny
swap → tx confirms.

Use the comp-Max account `Phantomfcalls@gmail.com` (auto-tier override
keeps you on Max indefinitely so you don't hit free-tier gates).

### Flow 1 — iOS Safari + MetaMask Mobile

Pre-req: iPhone, latest iOS, MetaMask app installed and unlocked, has
a tiny BNB or ETH balance ($1+ is enough).

| Step | Expected | Pass? |
|---|---|---|
| Open Safari → `https://nakalabs.xyz/dashboard/swap` | Swap page renders, "Connect Wallet" button visible | ☐ |
| Tap **Connect Wallet** | AppKit modal opens with MetaMask + Phantom + WalletConnect rows | ☐ |
| Tap **MetaMask** | Safari hands off to MetaMask app via universal link | ☐ |
| MetaMask shows the connection request | Origin reads "nakalabs.xyz" (or local), chain is the one you selected | ☐ |
| Tap **Connect** in MetaMask | Returns to Safari, swap page now shows your wallet address (truncated) | ☐ |
| Set chain to BNB Chain, swap 0.001 BNB → BUSD, hit **Sign & Swap** | MetaMask app re-opens with the unsigned tx | ☐ |
| Approve | Returns to Safari, tx hash shown, BSCscan link works | ☐ |
| Tx confirms within ~10s | Swap card resets, balance refreshed | ☐ |

**Common iOS-only failures**: universal link not triggering (MetaMask
not installed, or origin not whitelisted in Reown); tx never returns
to Safari (deep-link callback blocked by privacy settings).

### Flow 2 — iOS Safari + Phantom Mobile

Pre-req: iPhone, latest iOS, Phantom app installed and unlocked, has a
tiny SOL balance (0.01 SOL is enough).

| Step | Expected | Pass? |
|---|---|---|
| Open Safari → swap page | Swap page renders | ☐ |
| Tap Connect → **Phantom** | Safari hands off to Phantom app | ☐ |
| Phantom shows connection request | Origin reads correctly | ☐ |
| Approve | Returns to Safari, Solana address shown | ☐ |
| Set chain to Solana, swap 0.005 SOL → USDC | Phantom re-opens with quote | ☐ |
| Approve | Returns to Safari, tx hash shown, Solscan link works | ☐ |
| Tx confirms within ~5s | Swap card resets, balance refreshed | ☐ |

**Solana-specific gotcha**: Jito bundle returns `bundleId`, NOT a tx
signature. The swap engine derives the real signature from
`tx.signatures[0]` via bs58 (`lib/sniper/engine/solana.ts`). If the UI
shows a "bundleId" string that doesn't decode as base58, that's a
regression in the engine — file an §11 bug.

### Flow 3 — Android Chrome + MetaMask Mobile

Pre-req: Android, MetaMask app installed, tiny ETH/BNB.

Same step list as Flow 1, substituting Chrome for Safari. Android
typically routes deep links more reliably than iOS, but verify the
**return** to Chrome still works (some OEM browsers steal focus).

### Flow 4 — Android Chrome + Phantom Mobile

Pre-req: Android, Phantom app installed, tiny SOL.

Same step list as Flow 2.

---

## Edge cases worth one extra pass

- **No wallet installed**: Open a fresh phone, no MM/Phantom. Tap
  Connect → MetaMask. Should redirect to App Store / Play Store.
- **Lock screen during swap**: After tapping Sign & Swap, lock the
  phone for 30s, unlock, return to MetaMask, approve. Swap page should
  recover gracefully when you return.
- **Background tab**: Connect, then switch to a different browser tab
  for 2 minutes, return. Wallet should still be connected (we persist
  via localStorage; AppKit also caches via WalletConnect session).
- **Wrong chain**: On BNB MetaMask connection, switch to swap on
  Avalanche. App should prompt MetaMask to switch chains, NOT silently
  use the wrong RPC.

---

## What "done" looks like

All 4 flows pass × confirmed swap on chain = §10 ships.

If any flow fails, paste the exact step number + what you saw in a
ticket / Telegram and I'll fix on `feat/swap-wallet-fixes` branch.

Don't skip flows because "MetaMask works on iOS so Phantom probably
does too" — they have completely different deep-link grammars and
fail in different places.
