import type { SniperChain } from "./chains";

/**
 * Sniper criteria — a user-defined rule that triggers a buy when matched.
 * Mirrors the public.sniper_criteria table after the v2 migration.
 */
export interface SniperCriteria {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  paused: boolean;

  trigger_type: "new_pair" | "whale_buy" | "price_target" | "manual";
  chains_allowed: SniperChain[];

  // Filters
  min_liquidity_usd: number | null;
  max_buy_tax_bps: number | null;
  max_sell_tax_bps: number | null;
  min_holder_count: number | null;
  max_age_hours: number | null;
  min_security_score: number | null;
  block_honeypots: boolean;

  // Trigger inputs
  trigger_whale_address: string | null;
  trigger_price_target: number | null;

  // Execution
  amount_per_snipe_usd: number;
  max_slippage_bps: number;
  priority_fee_native: number | null;
  mev_protect: boolean;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  auto_execute: boolean;

  // TP/SL
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  trailing_stop_pct: number | null;
  auto_sell_on_target: boolean;
  auto_sell_on_liquidity_drop_pct: number | null;

  // Wallets
  wallet_source: "primary" | "selected" | "any";
  wallet_addresses: string[];

  expiry_hours: number | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface SniperExecution {
  id: string;
  user_id: string;
  criteria_id: string | null;
  chain: SniperChain | null;
  token_address: string;
  token_symbol: string | null;
  amount_native: number | null;
  amount_sol: number | null; // legacy
  slippage_bps: number;
  priority_fee_native: number | null;
  status: "pending" | "submitted" | "confirmed" | "failed";
  tx_hash: string | null;
  error_msg: string | null;
  gas_used: number | null;
  gas_price_native: number | null;
  pnl_usd: number | null;
  realized_at: string | null;
  wallet_address: string | null;
  execution_time_ms: number | null;
  executed_at: string;
}

export interface PlatformSniperState {
  id: number;
  enabled: boolean;
  disabled_reason: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
}

/** Snapshot row used by the UI's active-snipes table. */
export interface ActiveSniper {
  criteria: SniperCriteria;
  todaySnipes: number;
  todaySpendUsd: number;
  lastTriggeredAt: string | null;
}
