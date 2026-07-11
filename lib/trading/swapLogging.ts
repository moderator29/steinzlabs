import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Single source of truth for the swap_logs / fee_revenue write shape.
 *
 * These mirror the LIVE columns of project phvewrldcdxupsnakddx (verified, not
 * from migration files). Every writer must go through here so the column names
 * can't drift back to the input_token/output_token/wallet_address/fee_bps set
 * that silently failed every insert and left both tables at 0 rows.
 *
 * NOT NULL on swap_logs: user_id, token_in, token_out, amount_in, chain, status.
 * NOT NULL on fee_revenue: tx_hash, fee_amount, fee_token, chain.
 */

export interface SwapLogRow {
  user_id: string | null;
  token_in: string;
  token_out: string;
  amount_in: number;
  amount_out?: number | null;
  price_impact?: number | null;
  fee_usd?: number | null;
  chain: string;
  dex?: string | null;
  status?: 'pending' | 'completed' | 'confirmed' | 'failed';
  tx_hash?: string | null;
  // Ledger-only fields (NOT swap_logs columns — stripped before that insert).
  // The unified Activity ledger looks rows up by wallet, so pass it here.
  wallet_address?: string | null;
  source?: string | null;   // swap-page | market | vtx | proof | sniper
  trade_type?: string | null;
  value_usd?: number | null;
}

export interface TradeLedgerRow {
  user_id?: string | null;
  wallet_address: string;
  chain: string;
  trade_type?: string;      // swap | buy | sell | send | snipe | receive
  source?: string | null;
  tx_hash?: string | null;
  token_in?: string | null;
  token_out?: string | null;
  amount_in?: number | null;
  amount_out?: number | null;
  value_usd?: number | null;
  status?: 'pending' | 'confirmed' | 'failed';
}

export interface FeeRevenueRow {
  user_id?: string | null;
  tx_hash: string;
  fee_amount: number;
  fee_token: string;
  usd_value?: number | null;
  chain: string;
}

/**
 * swap_logs.user_id is NOT NULL with no default, so an unattributable swap
 * would throw a constraint error that the old code swallowed. Skip explicitly
 * (and say so) rather than fail silently.
 */
export async function recordSwapLog(db: SupabaseClient, row: SwapLogRow): Promise<void> {
  // Strip ledger-only fields — swap_logs has no wallet_address/source/etc columns.
  const { wallet_address, source, trade_type, value_usd, ...swapLogRow } = row;

  // Unified Activity ledger: record even when there's no user_id (matched by
  // wallet), so a swap always surfaces in the wallet's Activity tab.
  if (wallet_address) {
    await recordTradeLedger(db, {
      user_id: row.user_id,
      wallet_address,
      chain: row.chain,
      trade_type: trade_type ?? 'swap',
      source,
      tx_hash: row.tx_hash,
      token_in: row.token_in,
      token_out: row.token_out,
      amount_in: row.amount_in,
      amount_out: row.amount_out,
      value_usd,
      status: row.status === 'failed' ? 'failed' : row.status === 'pending' ? 'pending' : 'confirmed',
    });
  }

  if (!row.user_id) {
    logger.warn({ tx: row.tx_hash, chain: row.chain }, '[swap_logs] skipped: no user_id to attribute the swap');
    return;
  }
  const { error } = await db.from('swap_logs').insert(swapLogRow);
  if (error) {
    logger.error({ err: error.message, tx: row.tx_hash }, '[swap_logs] insert failed');
  }
}

/**
 * Unified trade ledger writer (user_trade_history). Every trade surface lands
 * here so the wallet Activity tab can show ALL app-initiated trades, not just
 * on-chain-decoded transfers. Best-effort + idempotent: a duplicate
 * (tx_hash, chain) is ignored by the partial unique index.
 */
export async function recordTradeLedger(db: SupabaseClient, row: TradeLedgerRow): Promise<void> {
  // Only ledger confirmed/failed trades that have an on-chain hash — pending
  // prepare-stage rows (no hash) would spam Activity with un-deduped entries.
  if (!row.wallet_address || !row.tx_hash) return;
  const { error } = await db.from('user_trade_history').upsert(
    {
      user_id: row.user_id ?? null,
      wallet_address: row.wallet_address,
      chain: row.chain,
      trade_type: row.trade_type ?? 'swap',
      source: row.source ?? null,
      tx_hash: row.tx_hash ?? null,
      token_in: row.token_in ?? null,
      token_out: row.token_out ?? null,
      amount_in: row.amount_in ?? null,
      amount_out: row.amount_out ?? null,
      value_usd: row.value_usd ?? null,
      status: row.status ?? 'confirmed',
    },
    { onConflict: 'tx_hash,chain', ignoreDuplicates: true },
  );
  if (error) {
    logger.error({ err: error.message, tx: row.tx_hash }, '[user_trade_history] insert failed');
  }
}

export async function recordFeeRevenue(db: SupabaseClient, row: FeeRevenueRow): Promise<void> {
  const { error } = await db.from('fee_revenue').insert(row);
  if (error) {
    logger.error({ err: error.message, tx: row.tx_hash }, '[fee_revenue] insert failed');
  }
}

/**
 * Canonical Naka platform fee, in basis points. 50 bps = 0.5%.
 * Collected on every swap (buy and sell) via the 0x v2 monetization params
 * (swapFeeRecipient + swapFeeBps + swapFeeToken) and routed to the treasury
 * wallet (NEXT_PUBLIC_FEE_RECIPIENT_EVM). This is the single source of truth:
 * the 0x quote params (STEINZ_FEE_BPS), the recorded fee_usd, and the
 * displayed fee all derive from it, so they can never drift apart.
 */
export const PLATFORM_FEE_BPS = Number(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS) || 50;

/** The platform fee as a decimal string (e.g. "0.005"). */
export const PLATFORM_FEE_DECIMAL = (PLATFORM_FEE_BPS / 10000).toString();
