/**
 * Non-custodial trade relayer.
 *
 * Called by monitor crons (limit-order-monitor, dca-executor, stop-loss-monitor,
 * copy-trade-monitor) when a trigger condition fires. The relayer:
 *   1. Blocks honeypots and critical-risk tokens via GoPlus.
 *   2. Picks the best route via the multi-provider swap aggregator.
 *   3. Records a pending_trades row + notifies the user.
 *
 * It NEVER signs on behalf of the user. See lib/trading/builtinSigner.ts.
 */

import * as Sentry from "@sentry/nextjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAllRoutes, type RouteQuote } from "@/lib/services/swap-aggregator";
import { getTokenSecurity } from "@/lib/services/goplus";
import { notifyPendingTrade, type TradeNotificationReason } from "@/lib/trading/notifications";

export type WalletSource = "external_evm" | "external_solana" | "builtin";

export interface TradeIntent {
  userId: string;
  chain: string;
  walletSource: WalletSource;
  fromTokenAddress: string;
  fromTokenSymbol?: string | null;
  toTokenAddress: string;
  toTokenSymbol?: string | null;
  amountIn: string;
  slippageBps: number;
  reason: TradeNotificationReason;
  sourceOrderId?: string | null;
  sourceOrderTable?: "limit_orders" | "dca_bots" | "stop_loss_orders" | "user_copy_trades" | null;
  expectedPriceUsd?: number | null;
}

export interface TradeResult {
  success: boolean;
  pendingTradeId?: string;
  awaitingUserConfirmation?: boolean;
  securityBlocked?: boolean;
  failureReason?: string;
  route?: RouteQuote | null;
}

const HONEYPOT_BLOCK_TRUST_FLOOR = 40; // trustScore below this + honeypot = block
const CRITICAL_TRUST_FLOOR = 20;        // always block regardless of honeypot flag

export async function executeTrade(intent: TradeIntent): Promise<TradeResult> {
  try {
    // LAYER 1 — Security pre-check. Native asset swaps (address 0x0 / SOL) skip.
    const isNativeOut =
      intent.toTokenAddress === "0x0000000000000000000000000000000000000000" ||
      intent.toTokenAddress.toLowerCase() === "native" ||
      intent.toTokenAddress === "So11111111111111111111111111111111111111112";

    let trustScore: number | null = null;
    let isHoneypot: boolean | null = null;

    if (!isNativeOut) {
      try {
        const sec = await getTokenSecurity(intent.toTokenAddress, intent.chain);
        trustScore = sec.trustScore;
        isHoneypot = sec.isHoneypot;
        if (sec.isHoneypot && sec.trustScore < HONEYPOT_BLOCK_TRUST_FLOOR) {
          return {
            success: false,
            securityBlocked: true,
            failureReason: `Blocked: token flagged as honeypot (trust ${sec.trustScore}/100)`,
          };
        }
        if (sec.trustScore < CRITICAL_TRUST_FLOOR || sec.safetyLevel === "DANGER") {
          return {
            success: false,
            securityBlocked: true,
            failureReason: `Blocked: token risk ${sec.safetyLevel} (trust ${sec.trustScore}/100)`,
          };
        }
      } catch (err) {
        // GoPlus unavailable: degrade to allow but log. The UI still shows badges
        // from independent calls. We don't want a GoPlus outage to halt execution.
        Sentry.captureException(err, { tags: { module: "relayer.security", chain: intent.chain } });
      }
    }

    // LAYER 2 — Route discovery. Solana uses Jupiter (handled at confirm time
    // from existing /api/swap/quote). For EVM we pick the best aggregator route.
    let bestRoute: RouteQuote | null = null;
    if (intent.chain.toLowerCase() !== "solana") {
      const routes = await getAllRoutes({
        chain: intent.chain,
        fromToken: intent.fromTokenAddress,
        toToken: intent.toTokenAddress,
        amountIn: intent.amountIn,
        slippageBps: intent.slippageBps,
      });
      bestRoute = routes[0] ?? null;
      if (!bestRoute) {
        return { success: false, failureReason: "No viable swap route found" };
      }
    }

    // LAYER 3 — Record pending trade. Client will fetch a firm quote + sign at
    // confirmation time (route data here is an indicative hint; confirm path
    // always re-quotes). This keeps server work stateless and safe.
    const admin = getSupabaseAdmin();
    const { data: inserted, error } = await admin
      .from("pending_trades")
      .insert({
        user_id: intent.userId,
        source_reason: intent.reason,
        source_order_id: intent.sourceOrderId ?? null,
        source_order_table: intent.sourceOrderTable ?? null,
        chain: intent.chain,
        wallet_source: intent.walletSource,
        from_token_address: intent.fromTokenAddress,
        from_token_symbol: intent.fromTokenSymbol ?? null,
        to_token_address: intent.toTokenAddress,
        to_token_symbol: intent.toTokenSymbol ?? null,
        amount_in: intent.amountIn,
        slippage_bps: intent.slippageBps,
        expected_amount_out: bestRoute?.amountOut ?? null,
        expected_price_usd: intent.expectedPriceUsd ?? null,
        route_provider: bestRoute?.provider ?? null,
        route_data: bestRoute ? (bestRoute as unknown as Record<string, unknown>) : {},
        security_trust_score: trustScore,
        security_is_honeypot: isHoneypot,
        status: "pending",
      })
      .select("id, expires_at")
      .single();

    if (error || !inserted) {
      Sentry.captureException(error ?? new Error("pending_trades insert returned no row"), {
        tags: { module: "relayer.persist", reason: intent.reason },
      });
      return { success: false, failureReason: error?.message ?? "Could not record pending trade" };
    }

    // LAYER 4 — Notify user (best-effort, never blocks).
    await notifyPendingTrade({
      userId: intent.userId,
      reason: intent.reason,
      chain: intent.chain,
      fromTokenSymbol: intent.fromTokenSymbol ?? null,
      toTokenSymbol: intent.toTokenSymbol ?? null,
      amountIn: intent.amountIn,
      expectedAmountOut: bestRoute?.amountOut ?? null,
      pendingTradeId: inserted.id,
      expiresAt: inserted.expires_at,
    });

    return {
      success: true,
      pendingTradeId: inserted.id,
      awaitingUserConfirmation: true,
      route: bestRoute,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: "relayer", reason: intent.reason, chain: intent.chain },
    });
    return { success: false, failureReason: err instanceof Error ? err.message : String(err) };
  }
}
