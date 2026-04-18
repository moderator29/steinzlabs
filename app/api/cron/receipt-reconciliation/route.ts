import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseEvmReceipt,
  parseSolanaReceipt,
  computeSlippageBps,
  type ReceiptResult,
} from "@/lib/trading/receiptParser";
import { getDexPrice } from "@/lib/services/dexscreener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Walks the four source-order tables looking for confirmed trades whose
 * on-chain result hasn't been parsed yet. Parses the receipt, computes the
 * authoritative amount received, gas paid, slippage vs expected, and flags
 * reverted txs. This is the only path that writes actual_* columns.
 *
 * Intentionally capped per-run so we don't time out a single cron firing.
 * At the 2-minute cadence, even a large backlog drains in a few hours.
 */

const MAX_PER_TABLE = 25;

interface LimitOrderRow {
  id: string;
  chain: string;
  to_token_address: string;
  executed_tx_hash: string;
  expected_amount_out: string | null;
  pending_trade_id: string | null;
}

interface DcaExecutionRow {
  id: string;
  tx_hash: string;
  bot_id: string;
  dca_bots: { chain: string; to_token_address: string } | null;
}

interface StopLossRow {
  id: string;
  chain: string;
  exit_to_token_address: string;
  triggered_tx_hash: string;
  pending_trade_id: string | null;
}

interface CopyTradeRow {
  id: string;
  token_address: string;
  copied_tx_hash: string;
}

interface NativePriceCache {
  ethereum?: number;
  polygon?: number;
  base?: number;
  arbitrum?: number;
  optimism?: number;
  bsc?: number;
  solana?: number;
}

const NATIVE_SYMBOL: Record<string, string> = {
  ethereum: "ETH",
  base: "ETH",
  arbitrum: "ETH",
  optimism: "ETH",
  polygon: "MATIC",
  bsc: "BNB",
  solana: "SOL",
};

const NATIVE_DECIMALS: Record<string, number> = {
  ethereum: 18,
  base: 18,
  arbitrum: 18,
  optimism: 18,
  polygon: 18,
  bsc: 18,
  solana: 9,
};

async function nativePriceUsd(chain: string, cache: NativePriceCache): Promise<number | null> {
  const key = chain.toLowerCase() as keyof NativePriceCache;
  if (cache[key] != null) return cache[key] ?? null;
  const sym = NATIVE_SYMBOL[key];
  if (!sym) return null;
  // DexScreener lookup by well-known wrapped-native addresses would be ideal;
  // fallback: leave null and skip actual_gas_usd (the cron still writes the
  // rest). Cost USD is best-effort.
  const price = await getDexPrice(sym).catch(() => 0);
  cache[key] = price > 0 ? price : 0;
  return cache[key] ?? null;
}

async function parseByChain(params: {
  chain: string;
  txHash: string;
  toTokenAddress: string;
  nativeCache: NativePriceCache;
}): Promise<ReceiptResult> {
  const chain = params.chain.toLowerCase();
  let result: ReceiptResult & { _gasWei?: string; _feeLamports?: number };
  if (chain === "solana" || chain === "sol") {
    result = (await parseSolanaReceipt({
      txHash: params.txHash,
      toTokenMint: params.toTokenAddress,
    })) as ReceiptResult & { _feeLamports?: number };
  } else {
    result = (await parseEvmReceipt({
      chain,
      txHash: params.txHash,
      toTokenAddress: params.toTokenAddress,
    })) as ReceiptResult & { _gasWei?: string };
  }

  const nativePrice = await nativePriceUsd(chain, params.nativeCache);
  if (nativePrice && nativePrice > 0) {
    const decimals = NATIVE_DECIMALS[chain] ?? 18;
    if (result._gasWei) {
      try {
        const wei = BigInt(result._gasWei);
        const denom = BigInt(10) ** BigInt(decimals);
        const whole = Number(wei / denom);
        const frac = Number(wei % denom) / Number(denom);
        result.actualGasUsd = (whole + frac) * nativePrice;
      } catch {
        /* ignore */
      }
    } else if (result._feeLamports != null) {
      const sol = result._feeLamports / 10 ** (NATIVE_DECIMALS.solana ?? 9);
      result.actualGasUsd = sol * nativePrice;
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const nativeCache: NativePriceCache = {};
  let updated = 0;
  let reverted = 0;
  let errors = 0;

  async function applyUpdate(
    table: string,
    id: string,
    result: ReceiptResult,
    expectedOut: string | null,
  ) {
    const update: Record<string, unknown> = {
      tx_reverted: result.reverted,
      revert_reason: result.revertReason,
      actual_amount_out: result.actualAmountOut,
      actual_gas_usd: result.actualGasUsd,
      actual_slippage_bps: computeSlippageBps(expectedOut, result.actualAmountOut),
      receipt_reconciled_at: new Date().toISOString(),
    };
    await admin.from(table).update(update).eq("id", id);
    if (result.reverted) reverted++;
    else updated++;
  }

  // ── limit_orders ─────────────────────────────────────────────────────────
  try {
    const { data } = await admin
      .from("limit_orders")
      .select(
        "id,chain,to_token_address,executed_tx_hash,expected_amount_out,pending_trade_id",
      )
      .eq("status", "executed")
      .not("executed_tx_hash", "is", null)
      .is("receipt_reconciled_at", null)
      .limit(MAX_PER_TABLE)
      .returns<LimitOrderRow[]>();
    for (const row of data ?? []) {
      try {
        const r = await parseByChain({
          chain: row.chain,
          txHash: row.executed_tx_hash,
          toTokenAddress: row.to_token_address,
          nativeCache,
        });
        await applyUpdate("limit_orders", row.id, r, row.expected_amount_out);
      } catch (e) {
        errors++;
        Sentry.captureException(e, {
          tags: { cron: "receipt-reconciliation", table: "limit_orders", id: row.id },
        });
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "receipt-reconciliation", table: "limit_orders" } });
  }

  // ── dca_executions ───────────────────────────────────────────────────────
  try {
    const { data } = await admin
      .from("dca_executions")
      .select("id,tx_hash,bot_id,dca_bots(chain,to_token_address)")
      .eq("status", "success")
      .not("tx_hash", "is", null)
      .is("receipt_reconciled_at", null)
      .limit(MAX_PER_TABLE)
      .returns<DcaExecutionRow[]>();
    for (const row of data ?? []) {
      if (!row.dca_bots?.chain || !row.dca_bots.to_token_address) continue;
      try {
        const r = await parseByChain({
          chain: row.dca_bots.chain,
          txHash: row.tx_hash,
          toTokenAddress: row.dca_bots.to_token_address,
          nativeCache,
        });
        await applyUpdate("dca_executions", row.id, r, null);
      } catch (e) {
        errors++;
        Sentry.captureException(e, {
          tags: { cron: "receipt-reconciliation", table: "dca_executions", id: row.id },
        });
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "receipt-reconciliation", table: "dca_executions" } });
  }

  // ── stop_loss_orders ─────────────────────────────────────────────────────
  try {
    const { data } = await admin
      .from("stop_loss_orders")
      .select("id,chain,exit_to_token_address,triggered_tx_hash,pending_trade_id")
      .in("status", ["triggered_sl", "triggered_tp", "triggered_trail"])
      .not("triggered_tx_hash", "is", null)
      .is("receipt_reconciled_at", null)
      .limit(MAX_PER_TABLE)
      .returns<StopLossRow[]>();
    for (const row of data ?? []) {
      try {
        const r = await parseByChain({
          chain: row.chain,
          txHash: row.triggered_tx_hash,
          toTokenAddress: row.exit_to_token_address,
          nativeCache,
        });
        await applyUpdate("stop_loss_orders", row.id, r, null);
      } catch (e) {
        errors++;
        Sentry.captureException(e, {
          tags: { cron: "receipt-reconciliation", table: "stop_loss_orders", id: row.id },
        });
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "receipt-reconciliation", table: "stop_loss_orders" } });
  }

  // ── user_copy_trades ─────────────────────────────────────────────────────
  try {
    const { data } = await admin
      .from("user_copy_trades")
      .select("id,token_address,copied_tx_hash")
      .eq("status", "success")
      .not("copied_tx_hash", "is", null)
      .is("receipt_reconciled_at", null)
      .limit(MAX_PER_TABLE)
      .returns<CopyTradeRow[]>();
    // copy_trades doesn't carry chain directly; infer from token_address prefix.
    for (const row of data ?? []) {
      const chain = row.token_address.startsWith("0x") ? "ethereum" : "solana";
      try {
        const r = await parseByChain({
          chain,
          txHash: row.copied_tx_hash,
          toTokenAddress: row.token_address,
          nativeCache,
        });
        await applyUpdate("user_copy_trades", row.id, r, null);
      } catch (e) {
        errors++;
        Sentry.captureException(e, {
          tags: { cron: "receipt-reconciliation", table: "user_copy_trades", id: row.id },
        });
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "receipt-reconciliation", table: "user_copy_trades" } });
  }

  return cronResponse("receipt-reconciliation", startedAt, {
    updated,
    reverted,
    errors,
  });
}
