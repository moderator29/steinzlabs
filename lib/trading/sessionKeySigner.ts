import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { ethers } from 'ethers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { decryptSessionKey, sessionKeyEncryptionAvailable } from '@/lib/trading/sessionKeyCrypto';
import { checkSessionScope, type SessionKeyRow } from '@/lib/trading/sessionKeyScope';
import { isEvmChain } from '@/lib/utils/addressNormalize';
import type { RouteQuote } from '@/lib/services/swap-aggregator';

/**
 * 24/7 non-custodial Auto-Copy signer — Phase 2 (see
 * docs/design/2026-06-28-session-key-auto-copy.md).
 *
 * Loads a user's delegated session key, enforces scope + the daily ledger,
 * decrypts the key transiently, signs the swap from the session EOA, broadcasts
 * via our existing RPC, and records the spend. Built on existing platform rails
 * (ethers + aggregator route calldata + Supabase) — no smart accounts, no
 * outside services.
 *
 * GATED OFF by default. Requires SESSION_KEY_SIGNER_ENABLED=true AND a configured
 * SESSION_KEY_ENCRYPTION_SECRET. Until enabled (and testnet-validated), every
 * caller falls back to the existing pending-trade confirm flow. Disabled or any
 * failure ⇒ returns null so the caller can fall back — it NEVER throws into the
 * money path.
 */

const ALCHEMY_RPC: Record<string, string | undefined> = {
  ethereum: process.env.ETHEREUM_RPC_URL,
  base: process.env.BASE_RPC_URL,
  arbitrum: process.env.ARBITRUM_RPC_URL,
  optimism: process.env.OPTIMISM_RPC_URL,
  polygon: process.env.POLYGON_RPC_URL,
  bsc: process.env.BSC_RPC_URL,
};

function rpcUrl(chain: string): string | null {
  const c = chain.toLowerCase();
  if (ALCHEMY_RPC[c]) return ALCHEMY_RPC[c]!;
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return null;
  const host: Record<string, string> = {
    ethereum: 'eth-mainnet', base: 'base-mainnet', arbitrum: 'arb-mainnet',
    optimism: 'opt-mainnet', polygon: 'polygon-mainnet',
  };
  return host[c] ? `https://${host[c]}.g.alchemy.com/v2/${key}` : null;
}

export function sessionKeySignerEnabled(): boolean {
  return process.env.SESSION_KEY_SIGNER_ENABLED === 'true' && sessionKeyEncryptionAvailable();
}

export interface SessionCopyParams {
  userId: string;
  chain: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amountIn: string;      // smallest-unit / token-unit string for the swap
  amountUsd: number;     // for cap accounting
  sourceTxHash: string;  // whale tx — idempotency key
  slippageBps: number;
  route: RouteQuote | null;
}

export type SessionCopyResult =
  | { executed: true; broadcastTxHash: string; duplicate?: boolean }
  | null; // null = not handled here; caller falls back to pending-trade flow

/**
 * Pull the executable swap tx (to/data/value) from an aggregator route's raw
 * provider payload. Handles 0x-style (flat to/data/value) and 1inch-style
 * (tx:{to,data,value}). Returns null if the route carries no calldata.
 */
function extractSwapTx(route: RouteQuote | null): { to: string; data: string; value: string; allowanceTarget?: string } | null {
  const raw = route?.raw as Record<string, unknown> | undefined;
  if (!raw) return null;
  const tx = (raw.tx ?? raw.transaction ?? raw) as Record<string, unknown>;
  const to = tx.to as string | undefined;
  const data = (tx.data ?? tx.calldata) as string | undefined;
  if (!to || !data) return null;
  return {
    to,
    data,
    value: String(tx.value ?? '0'),
    allowanceTarget: (raw.allowanceTarget ?? raw.spender ?? to) as string | undefined,
  };
}

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

/**
 * Try to auto-execute a copy via the user's session key. Returns null whenever
 * it can't (disabled / no key / out of scope / any error) so the caller falls
 * back. Idempotent on (session_key_id, source_tx_hash) via session_key_spends.
 */
export async function executeWithSessionKey(p: SessionCopyParams): Promise<SessionCopyResult> {
  if (!sessionKeySignerEnabled()) return null;
  if (!isEvmChain(p.chain)) return null; // EVM-first; Solana lands in Phase 3.

  const admin = getSupabaseAdmin();
  try {
    // 1) Active, funded session key for this user+chain.
    const { data: keys } = await admin
      .from('user_session_keys')
      .select('id, chain, max_per_trade_usd, daily_cap_usd, allowed_tokens, expires_at, revoked_at, encrypted_session_key')
      .eq('user_id', p.userId)
      .eq('chain', p.chain.toLowerCase())
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .not('encrypted_session_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const key = keys?.[0] as (SessionKeyRow & { encrypted_session_key: string }) | undefined;
    if (!key) return null;

    // 2) Trailing-24h spend from the ledger (daily-cap source of truth).
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: spendRows } = await admin
      .from('session_key_spends')
      .select('amount_usd')
      .eq('session_key_id', key.id)
      .gte('created_at', since);
    const spentToday = (spendRows ?? []).reduce((s, r) => s + Number((r as { amount_usd: number }).amount_usd ?? 0), 0);

    // 3) Scope gate.
    const verdict = checkSessionScope(key, { chain: p.chain, tokenAddress: p.toTokenAddress, amountUsd: p.amountUsd }, spentToday, new Date());
    if (!verdict.ok) return null;

    // 4) Idempotent claim — UNIQUE(session_key_id, source_tx_hash) guarantees a
    //    whale tx is auto-copied at most once even across overlapping ticks.
    const { data: claim, error: claimErr } = await admin
      .from('session_key_spends')
      .insert({ session_key_id: key.id, user_id: p.userId, amount_usd: p.amountUsd, source_tx_hash: p.sourceTxHash })
      .select('id')
      .single();
    if (claimErr || !claim) return null; // dup or write failure ⇒ don't double-execute.

    // 5) Execute on-chain from the session EOA.
    // TESTNET-GATE: the route calldata was built from p.amountIn. Confirm the
    // aggregator was quoted with RAW token units (not the human-decimal string)
    // so the swap moves the intended size — verify on testnet before enabling
    // SESSION_KEY_SIGNER_ENABLED on mainnet (see design doc Phase 2/3).
    const swap = extractSwapTx(p.route);
    if (!swap) { await admin.from('session_key_spends').delete().eq('id', claim.id); return null; }
    const url = rpcUrl(p.chain);
    if (!url) { await admin.from('session_key_spends').delete().eq('id', claim.id); return null; }

    let pk = '';
    try {
      pk = decryptSessionKey(key.encrypted_session_key);
      const provider = new ethers.JsonRpcProvider(url);
      const wallet = new ethers.Wallet(pk, provider);

      // ERC-20 approve when the swap spends a token (not native). amountIn is a
      // human-decimal string (e.g. "50.000000"), so we don't parse it to raw
      // units here — use the approve-max-once pattern: if there's no existing
      // allowance, approve MaxUint256 once; subsequent trades skip it.
      const isNativeIn = p.fromTokenAddress === '0x0000000000000000000000000000000000000000'
        || p.fromTokenAddress.toLowerCase() === 'native';
      if (!isNativeIn && swap.allowanceTarget) {
        const erc20 = new ethers.Contract(p.fromTokenAddress, ERC20_ABI, wallet);
        const current: bigint = await erc20.allowance(wallet.address, swap.allowanceTarget);
        if (current === BigInt(0)) {
          const approveTx = await erc20.approve(swap.allowanceTarget, ethers.MaxUint256);
          await approveTx.wait(1);
        }
      }

      const tx = await wallet.sendTransaction({ to: swap.to, data: swap.data, value: BigInt(swap.value || '0') });
      const receipt = await tx.wait(1);
      const hash = receipt?.hash ?? tx.hash;
      await admin.from('session_key_spends').update({ broadcast_tx_hash: hash }).eq('id', claim.id);
      return { executed: true, broadcastTxHash: hash };
    } catch (err) {
      // On-chain failure: release the claim so a later retry/fallback can act.
      await admin.from('session_key_spends').delete().eq('id', claim.id);
      Sentry.captureException(err, { tags: { module: 'sessionKeySigner.execute', chain: p.chain } });
      return null;
    } finally {
      pk = ''; // best-effort wipe of the plaintext key reference.
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'sessionKeySigner', chain: p.chain } });
    return null;
  }
}
