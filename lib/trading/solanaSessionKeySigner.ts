import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { decryptSessionKey, sessionKeyEncryptionAvailable } from '@/lib/trading/sessionKeyCrypto';
import { checkSessionScope, type SessionKeyRow } from '@/lib/trading/sessionKeyScope';
import { getQuote, buildSwapTransaction } from '@/lib/services/jupiter';
import type { SessionCopyParams, SessionCopyResult } from '@/lib/trading/sessionKeySigner';

/**
 * 24/7 non-custodial Auto-Copy signer — Solana (Phase 3). The Solana twin of
 * lib/trading/sessionKeySigner.ts: same delegated session-key model, same
 * scope + atomic daily-ledger enforcement (the claim_session_spend RPC is
 * chain-agnostic), same never-release-after-broadcast guarantee — only the
 * execution rail differs (Jupiter quote + VersionedTransaction signed by the
 * session Keypair + sendRawTransaction, instead of 0x calldata + ethers).
 *
 * Built on existing platform rails (the same Jupiter service the manual Solana
 * confirm flow uses + Supabase) — no outside services. GATED OFF by default:
 * requires SESSION_KEY_SIGNER_ENABLED=true AND SESSION_KEY_ENCRYPTION_SECRET.
 * Disabled or ANY failure ⇒ returns null so the caller falls back to the
 * pending-trade confirm flow. It NEVER throws into the money path.
 */

function heliusRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY_1 ?? process.env.HELIUS_API_KEY_2;
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  const fallback =
    process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ??
    process.env.SOLANA_RPC_URL ??
    (process.env.ALCHEMY_API_KEY ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);
  return fallback ?? null;
}

export function solanaSessionKeySignerEnabled(): boolean {
  return process.env.SESSION_KEY_SIGNER_ENABLED === 'true' && sessionKeyEncryptionAvailable();
}

/**
 * Load a Solana Keypair from the decrypted session-key plaintext. Accepts the
 * three formats provisioning might store so the key side is flexible:
 *   - JSON byte array  "[12,34,...]"  (solana-keygen / Keypair.secretKey)
 *   - base58           (Phantom-style secret-key export)
 *   - base64
 * Returns null on anything unparseable (fail closed — never guess a key).
 */
function loadSolanaKeypair(plaintext: string): Keypair | null {
  const raw = plaintext.trim();
  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[];
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    // base58 first (most common export shape), then base64 as a fallback.
    try {
      const decoded = bs58.decode(raw);
      if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    } catch { /* not base58 — try base64 */ }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 64) return Keypair.fromSecretKey(Uint8Array.from(buf));
    return null;
  } catch {
    return null;
  }
}

/**
 * Try to auto-execute a Solana copy via the user's session key. Returns null
 * whenever it can't (disabled / not solana / no key / out of scope / any error)
 * so the caller falls back. Idempotent on (session_key_id, source_tx_hash) via
 * session_key_spends — same ledger the EVM signer uses.
 */
export async function executeSolanaWithSessionKey(p: SessionCopyParams): Promise<SessionCopyResult> {
  if (!solanaSessionKeySignerEnabled()) return null;
  if (p.chain.toLowerCase() !== 'solana') return null;

  const admin = getSupabaseAdmin();
  try {
    // 1) Active, funded Solana session key for this user.
    const { data: keys } = await admin
      .from('user_session_keys')
      .select('id, chain, max_per_trade_usd, daily_cap_usd, allowed_tokens, expires_at, revoked_at, encrypted_session_key')
      .eq('user_id', p.userId)
      .eq('chain', 'solana')
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .not('encrypted_session_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const key = keys?.[0] as (SessionKeyRow & { encrypted_session_key: string }) | undefined;
    if (!key) return null;

    // 2) Static scope gate (chain / expiry / per-trade / allowlist). The daily
    //    cap is enforced atomically in step 3, so pass 0 here.
    const verdict = checkSessionScope(key, { chain: p.chain, tokenAddress: p.toTokenAddress, amountUsd: p.amountUsd }, 0, new Date());
    if (!verdict.ok) return null;

    // Jupiter's quote takes the raw input amount as a Number. Solana base units
    // (USDC 6dp on buys, the token's dp on sells) stay well inside the safe
    // integer range; bail if anything is off rather than send a wrong size.
    const amountIn = Number(p.amountInRaw);
    if (!Number.isFinite(amountIn) || amountIn <= 0 || !Number.isSafeInteger(amountIn)) return null;

    const rpc = heliusRpcUrl();
    if (!rpc) return null;

    // 3) Atomic claim — advisory-locked daily-cap re-check + idempotent insert on
    //    UNIQUE(session_key_id, source_tx_hash). NULL = cap would breach OR this
    //    whale tx was already claimed, so we must not execute.
    const { data: claimId, error: claimErr } = await admin.rpc('claim_session_spend', {
      p_session_key_id: key.id,
      p_user: p.userId,
      p_amount: p.amountUsd,
      p_daily_cap: key.daily_cap_usd != null ? Number(key.daily_cap_usd) : null,
      p_source_tx: p.sourceTxHash,
    });
    if (claimErr || !claimId) return null;
    const claim = { id: claimId as string };
    const releaseClaim = () => admin.from('session_key_spends').delete().eq('id', claim.id);

    // 4) Execute on-chain from the session keypair via a FIRM Jupiter route.
    // Once sendRawTransaction resolves the spend is COMMITTED — from that point
    // the claim is NEVER released (releasing would restore daily-cap budget for
    // spent funds AND let a retry re-claim + double-broadcast). broadcastHash
    // draws that line: the catch only releases for PRE-broadcast failures.
    let broadcastHash: string | null = null;
    try {
      const kp = loadSolanaKeypair(decryptSessionKey(key.encrypted_session_key));
      if (!kp) { await releaseClaim(); return null; }
      const owner = kp.publicKey.toBase58();

      const quote = await getQuote(p.fromTokenAddress, p.toTokenAddress, amountIn, p.slippageBps);
      if (!quote) { await releaseClaim(); return null; }

      const built = await buildSwapTransaction(quote, owner);
      if (!built?.swapTransaction) { await releaseClaim(); return null; }

      const tx = VersionedTransaction.deserialize(Buffer.from(built.swapTransaction, 'base64'));
      tx.sign([kp]);

      const conn = new Connection(rpc, 'confirmed');
      const sig = await conn.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      // SPEND COMMITTED. Record the signature (best-effort — never releases) and
      // treat confirmation as non-fatal: the tx is already submitted whether or
      // not we observe finality here.
      broadcastHash = sig;
      await admin.from('session_key_spends')
        .update({ broadcast_tx_hash: broadcastHash }).eq('id', claim.id)
        .then(() => {}, () => { /* hash persist is best-effort; never releases */ });
      try {
        await conn.confirmTransaction(sig, 'confirmed');
      } catch { /* already submitted; confirmation only */ }
      return { executed: true, broadcastTxHash: broadcastHash };
    } catch (err) {
      if (!broadcastHash) await releaseClaim();
      Sentry.captureException(err, { tags: { module: 'solanaSessionKeySigner.execute', chain: p.chain } });
      return broadcastHash ? { executed: true, broadcastTxHash: broadcastHash } : null;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'solanaSessionKeySigner', chain: p.chain } });
    return null;
  }
}
