import 'server-only';
import { getEvmRpcUrl } from '@/lib/chains/evmRpc';
import { goldrushEnabled, goldrushChainName } from '@/lib/services/goldrush';

/**
 * On-chain confirmation for Wire gifts.
 *
 * A Wire gift is a REAL peer-to-peer native transfer the sender's own wallet
 * already broadcast (see lib/wallet/giftSend.ts). The record route inserts the
 * row as status='pending' with the broadcast tx_hash; THIS module is the only
 * thing that flips it to 'confirmed' - and only after independently observing
 * the transaction succeed on-chain. It never confirms without a real success:
 *   - EVM: eth_getTransactionReceipt.status === 0x1 AND the receipt's `to`
 *     equals the recorded recipient address (a native transfer's `to` is the
 *     recipient). GoldRush's tx-by-hash is preferred when a key is configured,
 *     with raw RPC as the always-available fallback.
 *   - Solana: getSignatureStatuses → err === null AND confirmationStatus is
 *     'confirmed' or 'finalized'.
 *
 * The verifier is read-only and non-custodial: it touches no keys and moves no
 * funds. It returns one of three honest outcomes and lets the caller decide
 * what to persist:
 *   - 'confirmed' - the tx is real and succeeded to the right recipient.
 *   - 'failed'    - the tx reverted / errored on-chain (definitive).
 *   - 'pending'   - not yet observable (not mined, not found, RPC unreachable,
 *                   or the `to` didn't match). Never confirm on 'pending'.
 */

export type GiftVerifyOutcome = 'confirmed' | 'failed' | 'pending';

const RPC_TIMEOUT_MS = 8_000;

function sameEvmAddress(a: string, b: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Minimal JSON-RPC POST. Returns the `result` field, or null on any failure. */
async function jsonRpc<T>(url: string, method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T; error?: unknown };
    if (json.error || json.result == null) return null;
    return json.result;
  } catch {
    return null;
  }
}

// ─── GoldRush tx-by-hash (optional, preferred when a key is configured) ───────
// Covalent/GoldRush: GET /v1/{chainName}/transaction_v2/{txHash}/ → data.items[0]
// with { successful, from_address, to_address }. lib/services/goldrush.ts owns
// the balance/tx-list surface but not tx-by-hash, so we call the endpoint here
// (same key + graceful-degradation contract). Returns null on ANY failure so
// callers fall back to raw RPC.
interface GoldrushTxByHash {
  successful: boolean | null;
  to: string | null;
  from: string | null;
}
async function goldrushTxByHash(chain: string, txHash: string): Promise<GoldrushTxByHash | null> {
  if (!goldrushEnabled()) return null;
  const chainName = goldrushChainName(chain);
  if (!chainName) return null;
  const key = process.env.COVALENT_API_KEY || process.env.GOLDRUSH_API_KEY || '';
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.covalenthq.com/v1/${chainName}/transaction_v2/${txHash}/?quote-currency=USD&no-logs=true`,
      {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      error?: boolean;
      data?: { items?: Array<{ successful?: boolean | null; to_address?: string | null; from_address?: string | null }> };
    };
    const item = json?.data?.items?.[0];
    if (json?.error || !item) return null;
    return {
      successful: item.successful ?? null,
      to: item.to_address ?? null,
      from: item.from_address ?? null,
    };
  } catch {
    return null;
  }
}

// ─── EVM ──────────────────────────────────────────────────────────────────────
interface EvmReceipt {
  status?: string; // '0x1' success, '0x0' revert
  to?: string | null;
}

async function verifyEvm(chain: string, txHash: string, recipientAddress: string): Promise<GiftVerifyOutcome> {
  // Prefer GoldRush when enabled - it indexes the tx even after the node prunes
  // it from its recent set.
  const gr = await goldrushTxByHash(chain, txHash);
  if (gr && gr.successful != null) {
    if (gr.successful === false) return 'failed';
    // successful === true: require the transfer to have gone to the recipient.
    if (gr.to && sameEvmAddress(gr.to, recipientAddress)) return 'confirmed';
    // Mismatched (or unknown) `to` on a success → do not confirm; let RPC decide.
  }

  const url = getEvmRpcUrl(chain);
  if (!url) return 'pending';
  const receipt = await jsonRpc<EvmReceipt | null>(url, 'eth_getTransactionReceipt', [txHash]);
  if (!receipt) return 'pending'; // not mined yet, or RPC unreachable
  const status = (receipt.status ?? '').toLowerCase();
  if (status === '0x0' || status === '0x00') return 'failed';
  if (status === '0x1' || status === '0x01') {
    // Native transfer: the receipt `to` is the recipient. Only confirm on match.
    if (receipt.to && sameEvmAddress(receipt.to, recipientAddress)) return 'confirmed';
    return 'pending';
  }
  return 'pending';
}

// ─── Solana ────────────────────────────────────────────────────────────────────
function solanaRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

interface SolSignatureStatus {
  err: unknown | null;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized' | null;
}

async function verifySolana(txHash: string): Promise<GiftVerifyOutcome> {
  const result = await jsonRpc<{ value?: Array<SolSignatureStatus | null> }>(
    solanaRpcUrl(),
    'getSignatureStatuses',
    [[txHash], { searchTransactionHistory: true }],
  );
  const status = result?.value?.[0];
  if (!status) return 'pending'; // signature not seen yet
  if (status.err != null) return 'failed'; // transaction failed on-chain
  const conf = status.confirmationStatus;
  if (conf === 'confirmed' || conf === 'finalized') return 'confirmed';
  return 'pending'; // only 'processed' so far
}

/**
 * Verify a recorded gift transaction on-chain. Read-only; never throws.
 */
export async function verifyGiftOnChain(params: {
  chain: string;
  txHash: string;
  recipientAddress: string;
}): Promise<GiftVerifyOutcome> {
  const chain = (params.chain || '').toLowerCase();
  const txHash = (params.txHash || '').trim();
  if (!txHash) return 'pending';
  try {
    if (chain === 'solana') return await verifySolana(txHash);
    return await verifyEvm(chain, txHash, (params.recipientAddress || '').trim());
  } catch {
    return 'pending';
  }
}
