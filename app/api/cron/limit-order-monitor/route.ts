import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse, cronHasWork } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDexPrice } from "@/lib/services/dexscreener";
import { executeTrade } from "@/lib/trading/relayer";
import { usdcForChain, usdToUsdcBaseUnits } from "@/lib/trading/usdc";
import { getTokenDecimalsForSizing } from "@/lib/sniper/priceFeed";

const isEvmAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LimitOrderRow {
  id: string;
  user_id: string;
  chain: string;
  from_token_address: string;
  from_token_symbol: string | null;
  to_token_address: string;
  to_token_symbol: string | null;
  from_amount: string;
  trigger_price_usd: number;
  trigger_direction: "above" | "below";
  slippage_bps: number;
  wallet_source: "external_evm" | "external_solana" | "builtin";
  expires_at: string | null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  // Short-circuit if there's nothing to monitor. Every external DEX call we
  // skip here is Vercel credit we don't burn while the platform has no users.
  if (!(await cronHasWork("limit_orders", { column: "status", value: "active" }))) {
    return cronResponse("limit-order-monitor", startedAt, { skipped: "no-active-orders" });
  }

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let triggered = 0;
  let skipped = 0;
  let failed = 0;

  const { data: expiredRows } = await admin
    .from("limit_orders")
    .update({ status: "expired", updated_at: nowIso })
    .eq("status", "active")
    .lt("expires_at", nowIso)
    .not("expires_at", "is", null)
    .select("id");
  const expired = expiredRows?.length ?? 0;

  const { data: orders, error } = await admin
    .from("limit_orders")
    .select(
      "id,user_id,chain,from_token_address,from_token_symbol,to_token_address,to_token_symbol,from_amount,trigger_price_usd,trigger_direction,slippage_bps,wallet_source,expires_at",
    )
    .eq("status", "active")
    .limit(500)
    .returns<LimitOrderRow[]>();

  if (error) {
    Sentry.captureException(error, { tags: { cron: "limit-order-monitor" } });
    return cronResponse("limit-order-monitor", startedAt, { error: error.message });
  }

  const rows = orders ?? [];
  const priceCache = new Map<string, number | null>();
  const uniqueTokens = Array.from(
    new Set(rows.map((r) => `${r.chain}:${r.to_token_address.toLowerCase()}`)),
  );
  await Promise.all(
    uniqueTokens.map(async (key) => {
      const addr = key.split(":")[1];
      try {
        const price = await getDexPrice(addr);
        priceCache.set(key, price > 0 ? price : null);
      } catch {
        priceCache.set(key, null);
      }
    }),
  );

  for (const order of rows) {
    const key = `${order.chain}:${order.to_token_address.toLowerCase()}`;
    const currentPrice = priceCache.get(key) ?? null;
    if (currentPrice == null) {
      skipped++;
      continue;
    }
    const shouldTrigger =
      (order.trigger_direction === "above" && currentPrice >= order.trigger_price_usd) ||
      (order.trigger_direction === "below" && currentPrice <= order.trigger_price_usd);
    if (!shouldTrigger) {
      skipped++;
      continue;
    }

    // Resolve a real contract for the from-token (older create paths stored the
    // literal "USDC" symbol, which aggregators reject) and scale the
    // human from_amount to base units (aggregators expect wei, not "100").
    const fromAddr = isEvmAddress(order.from_token_address)
      ? order.from_token_address
      : (usdcForChain(order.chain) ?? order.from_token_address);
    // Size the spend leg. USDC → deterministic per-chain helper (no RPC); a
    // wrong default-18 on a 6-dp USDC chain would over-scale the order by 1e12.
    // Non-USDC from-token → resolve real decimals and SKIP on failure, never 18.
    let amountInBase: string;
    if (fromAddr === usdcForChain(order.chain)) {
      amountInBase = usdToUsdcBaseUnits(Number(order.from_amount), order.chain);
    } else {
      const dec = await getTokenDecimalsForSizing(order.chain, fromAddr);
      if (dec == null) {
        Sentry.captureMessage(`limit-order-monitor: from-token decimals unavailable for ${order.chain}:${fromAddr} — skipping order ${order.id} this tick`);
        continue;
      }
      amountInBase = (BigInt(Math.round(Number(order.from_amount) * 1e6)) * (BigInt(10) ** BigInt(dec)) / BigInt(1e6)).toString();
    }

    const result = await executeTrade({
      userId: order.user_id,
      chain: order.chain,
      walletSource: order.wallet_source,
      fromTokenAddress: fromAddr,
      fromTokenSymbol: order.from_token_symbol,
      toTokenAddress: order.to_token_address,
      toTokenSymbol: order.to_token_symbol,
      amountIn: amountInBase,
      slippageBps: order.slippage_bps ?? 100,
      reason: "limit_order",
      sourceOrderId: order.id,
      sourceOrderTable: "limit_orders",
      expectedPriceUsd: currentPrice,
    });

    if (result.awaitingUserConfirmation) {
      // Gate re-trigger: move order out of 'active' while user confirmation
      // is pending. Restored to 'active' by reject/cleanup if not confirmed.
      await admin
        .from("limit_orders")
        .update({
          status: "pending_confirmation",
          pending_trade_id: result.pendingTradeId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      triggered++;
    } else if (result.securityBlocked) {
      await admin
        .from("limit_orders")
        .update({
          status: "failed",
          failure_reason: result.failureReason ?? "security_blocked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      failed++;
    } else if (!result.success) {
      failed++;
      Sentry.captureMessage(`limit-order trigger failed: ${result.failureReason}`, {
        tags: { order_id: order.id },
      });
    }
  }

  return cronResponse("limit-order-monitor", startedAt, {
    considered: rows.length,
    triggered,
    skipped,
    failed,
    expired,
  });
}
