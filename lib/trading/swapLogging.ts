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
  if (!row.user_id) {
    logger.warn({ tx: row.tx_hash, chain: row.chain }, '[swap_logs] skipped: no user_id to attribute the swap');
    return;
  }
  const { error } = await db.from('swap_logs').insert(row);
  if (error) {
    logger.error({ err: error.message, tx: row.tx_hash }, '[swap_logs] insert failed');
  }
}

export async function recordFeeRevenue(db: SupabaseClient, row: FeeRevenueRow): Promise<void> {
  const { error } = await db.from('fee_revenue').insert(row);
  if (error) {
    logger.error({ err: error.message, tx: row.tx_hash }, '[fee_revenue] insert failed');
  }
}

/** 0.4% canonical platform fee, in basis points. */
export const PLATFORM_FEE_BPS = 40;
