import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Solana session-key authorization — the ed25519 equivalent of the EVM EIP-712
 * flow in app/api/trading/session-key/route.ts. The user's MAIN Solana wallet
 * (Phantom etc.) signs a canonical scope message with signMessage; the server
 * verifies that ed25519 signature recovers to the main wallet before storing the
 * delegated session key. Shared so the frontend builds the EXACT same message it
 * signs (byte-for-byte) and the server reconstructs it from the signed scope.
 */

export interface SolanaAuthScope {
  sessionAddress: string;   // session keypair pubkey (base58)
  chain: string;            // 'solana'
  maxPerTradeUsd: number;
  dailyCapUsd: number;
  allowedTokens: string;    // comma-joined mints, '' = any
  expiresAt: number;        // unix seconds
}

/** Canonical, human-readable authorization message. Order/format is FIXED. */
export function buildSolanaAuthMessage(s: SolanaAuthScope): string {
  return [
    'NakaLabs Session Key Authorization',
    `Session: ${s.sessionAddress}`,
    `Chain: ${s.chain}`,
    `Max per trade (USD): ${s.maxPerTradeUsd}`,
    `Daily cap (USD): ${s.dailyCapUsd}`,
    `Allowed tokens: ${s.allowedTokens || 'any'}`,
    `Expires: ${s.expiresAt}`,
  ].join('\n');
}

/** Verify an ed25519 signature over `message` by the main wallet pubkey. */
export function verifySolanaAuthMessage(message: string, signatureB58: string, mainPubkeyB58: string): boolean {
  try {
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(signatureB58);
    if (sig.length !== 64) return false;
    const pub = new PublicKey(mainPubkeyB58).toBytes();
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

/** Load a Solana Keypair from base58 / JSON-array / base64 secret. Null if invalid. */
export function loadSolanaKeypairFromSecret(secret: string): Keypair | null {
  const raw = (secret || '').trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[];
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    try {
      const d = bs58.decode(raw);
      if (d.length === 64) return Keypair.fromSecretKey(d);
    } catch { /* not base58 */ }
    const b = Buffer.from(raw, 'base64');
    if (b.length === 64) return Keypair.fromSecretKey(Uint8Array.from(b));
    return null;
  } catch {
    return null;
  }
}

/** True when `secret` is the private key for `expectedPubkeyB58`. */
export function solanaSecretMatchesAddress(secret: string, expectedPubkeyB58: string): boolean {
  const kp = loadSolanaKeypairFromSecret(secret);
  return !!kp && kp.publicKey.toBase58() === expectedPubkeyB58;
}
