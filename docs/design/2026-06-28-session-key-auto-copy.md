# Design — 24/7 Non-Custodial Auto-Copy via Delegated Session Keys

**Status:** Phase 1 (secure storage foundation) implemented. Live signer gated behind
`SESSION_KEY_SIGNER_ENABLED` + security review + testnet validation. **Not live.**

**Author trail:** continues the `user_session_keys` scaffold from
`2026_05_21_trading_signing_ux.sql` / `app/api/trading/session-key/route.ts`.

---

## Goal

Make Auto-Copy mirror a followed whale's trades **24/7, even with the app closed**,
without the platform custodying the user's main wallet — matching how serious
non-custodial automation works (delegated, scoped, revocable keys), not the
custodial bot-wallet model (Maestro/BonkBot hold your key) and not the
app-open-only client-armed model.

## Why a server-held key is unavoidable here (and why that's still bounded)

The user's wallets are plain EOAs (MetaMask / Phantom / built-in EOA). A plain EOA
**cannot** be made to sign server-side without one of:

1. **ERC-4337 smart accounts** with on-chain session-key policy — strongest, but
   requires deploying/migrating every user to a smart account. Out of scope for v1.
2. **A separate session-key EOA whose private key the server holds (encrypted)**,
   funded by the user with a capped budget. Chosen for v1.

There is no third option for headless EOA execution. Option 2 is the standard
"scoped hot key": the server holds a **session** key, never the main wallet.

### Blast radius (threat model summary)

| Asset | Exposure on full server/DB compromise |
| --- | --- |
| Main wallet | **None.** Its key never leaves the browser; the session key cannot touch it. |
| Session-key EOA | Bounded by what the user funded into it / approved, on `allowed_tokens` only. |
| Caps (`max_per_trade_usd`, `daily_cap_usd`) | App-enforced (server). On compromise, on-chain limit is the funded budget, not the caps. |

Mitigations: short `expires_at` (1h–7d), per-user revocation, `allowed_tokens`
allowlist, per-trade + daily caps enforced before every sign, encryption at rest with
a server secret **not** in the DB, and a spend ledger (`session_key_spends`) that is
the single source of truth for the daily cap. Users are told to fund the session EOA
with only what they're comfortable automating.

## Data model

`user_session_keys` (existing) gains:

- `encrypted_session_key text` — AES-256-GCM ciphertext of the session EOA private
  key, `null` for client-signing-only rows (legacy behavior preserved). Format:
  `v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>`.
- `key_version int default 1` — lets us rotate `SESSION_KEY_ENCRYPTION_SECRET`.

New `session_key_spends` ledger (append-only): `(id, session_key_id, user_id, amount_usd,
source_tx_hash, broadcast_tx_hash, created_at)`. Daily spend = sum over the trailing 24h.
Uniqueness on `(session_key_id, source_tx_hash)` makes execution idempotent.

## Flow

1. **Authorize (client):** generate session EOA → user signs the EIP-712 scope with
   their main wallet → client POSTs `session_address`, scope, signature, **and** (for
   24/7 mode) the session private key over TLS.
2. **Store (server):** verify the signature recovers to `main_address` and that the
   POSTed scope equals the *signed* scope (already done). Encrypt the private key with
   `SESSION_KEY_ENCRYPTION_SECRET` (AES-256-GCM) and store only the ciphertext.
3. **Fund:** user sends a USDC budget (or grants an allowance) to the session EOA.
4. **Execute (server, gated):** on a copy event for an `auto_copy` rule, the signer
   service loads the active non-expired session key, checks scope + daily ledger,
   decrypts the key in memory, signs the swap from the session EOA, broadcasts, and
   appends to `session_key_spends`. Plaintext key is zeroed immediately after signing.
5. **Revoke:** `DELETE` sets `revoked_at`; the signer skips revoked/expired keys; user
   withdraws any remaining session-EOA budget.

## Phasing

- **Phase 1 (this change, safe/inert):** migration (encrypted column + spend ledger),
  `lib/trading/sessionKeyCrypto.ts` (pure AES-GCM helper), `lib/trading/sessionKeyScope.ts`
  (pure scope/cap checks), and route storage of the encrypted key. Moves no funds.
- **Phase 2 (gated, needs review + testnet):** `lib/trading/sessionKeySigner.ts`
  (decrypt → scope-check → sign → broadcast → ledger), behind `SESSION_KEY_SIGNER_ENABLED`.
  Relayer/matcher call it for `auto_copy` only when a valid funded session key exists;
  otherwise auto_copy falls back to the existing pending-trade flow.
- **Phase 3:** EVM first (ethers + aggregator route), then Solana (Keypair + Jupiter).
  Migrate toward ERC-4337 smart-account session keys to move caps on-chain.

## Non-goals for v1

Custodying main wallets; on-chain cap enforcement; cross-chain atomicity. v1 is a
scoped, revocable, time-boxed hot key with app-level caps and a hard funded ceiling.
