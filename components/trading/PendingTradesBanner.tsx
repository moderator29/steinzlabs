"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWalletSessionKey } from "@/lib/wallet/walletSession";

interface PendingTrade {
  id: string;
  source_reason:
    | "limit_order"
    | "dca"
    | "stop_loss"
    | "take_profit"
    | "trail_stop"
    | "copy_trade"
    | "sniper_buy";
  chain: string;
  wallet_source: "external_evm" | "external_solana" | "builtin";
  from_token_address: string;
  from_token_symbol: string | null;
  to_token_address: string;
  to_token_symbol: string | null;
  amount_in: string;
  expected_amount_out: string | null;
  expected_price_usd: number | null;
  route_provider: string | null;
  security_trust_score: number | null;
  security_is_honeypot: boolean | null;
  // Client-armed auto-sign (non-custodial). When true AND the built-in Naka
  // wallet is unlocked in this tab, the banner signs without a manual click.
  // Keys never leave the browser; the server still never signs.
  auto_confirm?: boolean;
  expires_at: string;
}

const REASON_LABEL: Record<PendingTrade["source_reason"], string> = {
  limit_order: "Limit order",
  dca: "DCA",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
  trail_stop: "Trailing stop",
  copy_trade: "Copy trade",
  sniper_buy: "Sniper buy",
};

const POLL_INTERVAL_MS = 20_000;

interface InlineSignResult {
  txHash: string;
  clientReportedAmountOut?: string;
  clientReportedPrice?: number;
}

type InlineSigner = (t: PendingTrade) => Promise<InlineSignResult>;

async function signAndBroadcast(trade: PendingTrade): Promise<InlineSignResult | null> {
  const w = (window as unknown as { __nakaSignPendingTrade?: InlineSigner })
    .__nakaSignPendingTrade;
  if (typeof w === "function") return w(trade);
  // Fallback only if the provider did not mount (shouldn't happen inside
  // /dashboard/*). Redirect to the swap page with a pendingId so the user
  // can complete signing there.
  const qs = new URLSearchParams({
    from: trade.from_token_address,
    to: trade.to_token_address,
    chain: trade.chain,
    amount: trade.amount_in,
    pendingId: trade.id,
  });
  window.location.href = `/dashboard/swap?${qs.toString()}`;
  return null;
}

interface RowState {
  error?: string;
  successTxHash?: string;
}

export function PendingTradesBanner() {
  const [trades, setTrades] = useState<PendingTrade[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  // Trades we've already auto-signed (or attempted) so the 20s poll can't
  // double-fire the same trade.
  const autoAttempted = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/pending-trades", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { trades: PendingTrade[] };
      setTrades(data.trades ?? []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  const onConfirm = useCallback(
    async (trade: PendingTrade, opts?: { auto?: boolean }) => {
      setBusyId(trade.id);
      setRowState((prev) => ({ ...prev, [trade.id]: {} }));
      try {
        // Atomic server claim BEFORE broadcasting so a remount mid-sign or a
        // second open tab can't double-broadcast the same trade. A 409 means
        // another instance already owns it — abort without signing.
        const claimRes = await fetch(`/api/trading/pending-trades/${trade.id}/claim`, { method: "POST" });
        if (!claimRes.ok) {
          if (!opts?.auto) {
            const b = (await claimRes.json().catch(() => ({}))) as { error?: string };
            setRowState((prev) => ({ ...prev, [trade.id]: { error: b.error ?? "This trade is already being signed." } }));
          }
          return;
        }

        let signed: InlineSignResult | null;
        try {
          signed = await signAndBroadcast(trade);
        } catch (err) {
          // Release ONLY on failures that provably happened before any on-chain
          // broadcast, so the user can retry immediately. Anything ambiguous
          // keeps the claim (a tx may have gone out) until its TTL — that's the
          // double-broadcast guard.
          const msg = err instanceof Error ? err.message : "";
          if (/password|locked|no wallet keys|can.?t sign|does not match|outdated|not detected|no .*wallet account/i.test(msg)) {
            await fetch(`/api/trading/pending-trades/${trade.id}/release`, { method: "POST" }).catch(() => {});
          }
          throw err;
        }
        if (!signed) {
          // Redirected to the swap page to sign there — release so that path
          // can re-claim and complete it.
          await fetch(`/api/trading/pending-trades/${trade.id}/release`, { method: "POST" }).catch(() => {});
          return;
        }
        const res = await fetch(`/api/trading/pending-trades/${trade.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: signed.txHash,
            clientReportedAmountOut: signed.clientReportedAmountOut,
            clientReportedPrice: signed.clientReportedPrice,
          }),
        });
        if (res.ok) {
          setRowState((prev) => ({
            ...prev,
            [trade.id]: { successTxHash: signed.txHash },
          }));
          setTimeout(() => {
            setTrades((prev) => prev.filter((t) => t.id !== trade.id));
          }, 3000);
        } else {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setRowState((prev) => ({
            ...prev,
            [trade.id]: { error: body.error ?? `Server error (${res.status})` },
          }));
        }
      } catch (err) {
        setRowState((prev) => ({
          ...prev,
          [trade.id]: {
            error: err instanceof Error ? err.message : "Signing failed",
          },
        }));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  // Client-armed auto-sign (#11). For trades flagged auto_confirm by an
  // auto-execute sniper using the built-in Naka wallet: sign WITHOUT a click,
  // but only when the wallet is unlocked in this tab and the trade clears the
  // same safety gates a human would check (no honeypot, not low-trust). Keys
  // never leave the browser; the server never signs. Falls back to the manual
  // one-tap card otherwise (external wallets, locked wallet, flagged tokens).
  useEffect(() => {
    if (busyId) return;
    const unlocked = !!getWalletSessionKey();
    if (!unlocked) return;
    const eligible = trades.find(
      (t) =>
        t.auto_confirm === true &&
        t.wallet_source === "builtin" &&
        t.security_is_honeypot !== true &&
        (t.security_trust_score == null || t.security_trust_score >= 50) &&
        !autoAttempted.current.has(t.id),
    );
    if (!eligible) return;
    autoAttempted.current.add(eligible.id);
    void onConfirm(eligible, { auto: true });
    // onConfirm is stable; depend on trades + busyId so we re-evaluate as the
    // pending set changes and after each sign completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, busyId]);

  const onReject = useCallback(async (trade: PendingTrade) => {
    setBusyId(trade.id);
    try {
      const res = await fetch(`/api/trading/pending-trades/${trade.id}/reject`, {
        method: "POST",
      });
      if (res.ok) setTrades((prev) => prev.filter((t) => t.id !== trade.id));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (trades.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-md">
      <div className="rounded-xl border border-blue-500/30 bg-slate-900/95 shadow-2xl shadow-blue-500/10 backdrop-blur">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-start"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <span className="text-sm font-semibold text-white">
              {trades.length} pending trade{trades.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-400">awaiting confirmation</span>
          </div>
          <span className="text-xs text-slate-400">{expanded ? "Hide" : "Review"}</span>
        </button>
        {expanded && (
          <div className="max-h-96 overflow-y-auto border-t border-slate-800">
            {trades.map((trade) => {
              const expiresIn = Math.max(
                0,
                Math.round((new Date(trade.expires_at).getTime() - Date.now()) / 60000),
              );
              const honeypot = trade.security_is_honeypot === true;
              const trustWarn =
                trade.security_trust_score != null && trade.security_trust_score < 50;
              return (
                <div
                  key={trade.id}
                  className="border-b border-slate-800 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {REASON_LABEL[trade.source_reason]} · {trade.chain.toUpperCase()}
                    </span>
                    <span>{expiresIn}m left</span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-white">
                    {trade.amount_in} {trade.from_token_symbol ?? "token"} →{" "}
                    {trade.expected_amount_out ?? "?"} {trade.to_token_symbol ?? "token"}
                  </div>
                  {(honeypot || trustWarn) && (
                    <div className="mt-1 text-xs text-amber-400">
                      {honeypot
                        ? "Honeypot flag present. Review before confirming."
                        : `Low trust score ${trade.security_trust_score}/100.`}
                    </div>
                  )}
                  {rowState[trade.id]?.successTxHash && (
                    <div className="mt-1 text-xs text-emerald-400 font-mono truncate">
                      Broadcast ✓ {rowState[trade.id].successTxHash}
                    </div>
                  )}
                  {rowState[trade.id]?.error && (
                    <div className="mt-1 text-xs text-rose-400">
                      {rowState[trade.id].error}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === trade.id}
                      onClick={() => onConfirm(trade)}
                      className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {busyId === trade.id ? "Signing..." : "Confirm in Wallet"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === trade.id}
                      onClick={() => onReject(trade)}
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
