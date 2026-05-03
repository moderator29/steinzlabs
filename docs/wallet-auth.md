# Wallet Authentication (SIWE)

Sign-In With Ethereum on `/login` and `/signup`. Uses Reown AppKit for the connect modal (MetaMask + every WalletConnect-compatible wallet) and verifies the signature server-side before issuing a Supabase session.

## Flow (EVM)

```
[Click "Sign in with wallet"]
         ↓
AppKit modal opens — user picks MetaMask / Phantom / Rainbow / WC v2 wallet
         ↓
wagmi exposes the connected address
         ↓
POST /api/auth/wallet-nonce { address, chain: 'evm' }
         ↓ returns { nonce, message, expiresAt }
Wallet signs the message via wagmi useSignMessage()
         ↓
POST /api/auth/wallet-verify { address, signature, nonce, chain }
         ↓ verifies via viem.verifyMessage(), atomically consumes the nonce,
         ↓ creates wallet_identities row + Supabase user if new,
         ↓ returns { actionLink }
Browser navigates to actionLink → consumes magic-link, sets session, lands on /dashboard
```

## Files

- `components/auth/WalletAuthButton.tsx` — single component used on both `/login` (mode="signin") and `/signup` (mode="signup")
- `app/api/auth/wallet-nonce/route.ts` — issues a 16-byte nonce, 5-minute TTL, stored in `auth_wallet_nonces`
- `app/api/auth/wallet-verify/route.ts` — verifies signature, creates user, generates magic-link
- `lib/wallet/appkit.ts` — AppKit init (already in repo, unchanged)

## Address normalization

Both routes use `normalizeAddress()` from `lib/utils/addressNormalize.ts`. EVM addresses canonicalize to lowercase; Solana base58 preserves case. **Never** call `.toLowerCase()` directly on a raw address — Solana support is not far away and CLAUDE.md bans it.

## Required env

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — already configured. If missing, `WalletAuthButton` renders nothing (HAS_APPKIT short-circuit) and the existing email + Google flows still work.

## Solana (planned)

Phantom / Solflare auth via `signMessage` from `@solana/wallet-adapter-react`. The server side is already chain-aware (`chain: 'solana'` in both routes). UI follow-up — single component split into EVM + Solana variants or a unified picker.

## Linking (post-Phase-4)

Once Phase 4 lands the Vault, the same wallet flow gates NakaCult access via `wallet_identities.address` → `whales`/`token_balances` lookup for $NAKA holdings ≥ 600,000 OR NakaLabs NFT ownership.

## Security notes

- Nonces are single-use (`consumed = true` on verify) and TTL'd at 5 minutes.
- Magic-link issued by Supabase Admin is one-shot; the token is consumed on `actionLink` navigation.
- `auth_wallet_nonces` is RLS-locked (admin-only writes via `getSupabaseAdmin()`); no client-callable surface bypasses the nonce check.
- Failed sigs disconnect the wallet so the next attempt re-prompts cleanly.
