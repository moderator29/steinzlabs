"use client";

/**
 * VtxToolSidecar — persistent right sidebar for desktop VTX layout.
 *
 * Surfaces three things the user otherwise has to scroll through the chat
 * to find:
 *   1. Token cards extracted from any assistant message in the current session.
 *   2. A timeline of which VTX tools have been called (when streamed back from
 *      the API in `data.toolsUsed`).
 *   3. Pending swap (if a prepare_swap tool call has staged one) with a CTA
 *      pointing the user to the PendingTradesBanner.
 *
 * Hidden on mobile (the chat itself already shows token cards inline).
 * Pure presentation — owner of state passes the snapshots down.
 */

import {
  Coins,
  Wrench,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ExternalLink,
  Clock,
} from "lucide-react";

export interface SidecarTokenCard {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  marketCap?: string;
  volume?: string;
  liquidity?: string;
  chain?: string;
  contract?: string;
}

export interface SidecarToolEvent {
  id: string;
  name: string;
  timestamp: number;
  // Optional summary blurb VTX produced for this call (e.g. "trust score 82/100")
  summary?: string;
  // Optional risk flag color for security tools
  risk?: "safe" | "warning" | "danger";
}

export interface SidecarPendingSwap {
  id: string;
  fromSymbol?: string | null;
  toSymbol?: string | null;
  amountIn?: string;
  expectedOut?: string | null;
  routeProvider?: string | null;
  expiresAt?: string;
}

interface Props {
  tokens: SidecarTokenCard[];
  toolEvents: SidecarToolEvent[];
  pendingSwap?: SidecarPendingSwap | null;
}

function RiskIcon({ risk }: { risk?: SidecarToolEvent["risk"] }) {
  if (risk === "safe") return <ShieldCheck className="w-3 h-3 text-emerald-400" />;
  if (risk === "warning") return <ShieldAlert className="w-3 h-3 text-amber-400" />;
  if (risk === "danger") return <ShieldX className="w-3 h-3 text-red-400" />;
  return <Wrench className="w-3 h-3 text-gray-500" />;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const TOOL_LABELS: Record<string, string> = {
  token_security_scan: "Token security",
  token_market_data: "Market data",
  wallet_profile: "Wallet profile",
  entity_lookup: "Entity lookup",
  social_sentiment: "Social sentiment",
  solana_token_data: "Solana token",
  evm_token_data: "EVM token",
  new_token_detection: "New launches",
  contract_analysis: "Contract analysis",
  address_security: "Address security",
  whale_activity: "Whale activity",
  check_phishing_url: "Phishing check",
  prepare_swap: "Prepare swap",
};

export function VtxToolSidecar({ tokens, toolEvents, pendingSwap }: Props) {
  const empty = tokens.length === 0 && toolEvents.length === 0 && !pendingSwap;
  return (
    <aside
      className="hidden lg:flex flex-col w-[340px] flex-shrink-0 bg-[#080C16] border-l border-white/[0.04]"
      aria-label="Tool results"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-white/[0.04] flex-shrink-0">
        <Wrench className="w-4 h-4 text-[#0A1EFF]" />
        <span className="text-xs font-bold tracking-tight">Intelligence Output</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {empty && (
          <div className="text-center pt-12 px-4">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#0A1EFF]" />
            </div>
            <p className="text-xs text-gray-400">No tool output yet.</p>
            <p className="text-[10px] text-gray-600 mt-1.5">
              Token cards, security checks, and swap previews will appear here as VTX runs them.
            </p>
          </div>
        )}

        {/* Pending swap — top priority */}
        {pendingSwap && (
          <section>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <ArrowUpRight className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                Pending swap
              </span>
            </div>
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="text-xs font-semibold text-white mb-1">
                {pendingSwap.amountIn} {pendingSwap.fromSymbol ?? "tokens"} → {pendingSwap.toSymbol ?? "?"}
              </div>
              {pendingSwap.expectedOut && (
                <div className="text-[10px] text-gray-400">
                  Expected out: <span className="font-mono text-white">{pendingSwap.expectedOut}</span>
                </div>
              )}
              {pendingSwap.routeProvider && (
                <div className="text-[10px] text-gray-500 mt-1">via {pendingSwap.routeProvider}</div>
              )}
              <p className="text-[10px] text-amber-300 mt-2 leading-snug">
                Confirm in the PendingTradesBanner at the bottom of the page.
              </p>
            </div>
          </section>
        )}

        {/* Token cards */}
        {tokens.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Coins className="w-3 h-3 text-[#0A1EFF]" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                Tokens analyzed
              </span>
            </div>
            <div className="space-y-2">
              {tokens.map((t, i) => (
                <div
                  key={`${t.symbol}-${i}`}
                  className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{t.symbol}</div>
                      <div className="text-[10px] text-gray-500 truncate">{t.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] font-mono font-semibold text-white">{t.price}</div>
                      <div
                        className={`text-[9px] font-semibold ${t.isPositive ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {t.change}
                      </div>
                    </div>
                  </div>
                  {(t.marketCap || t.volume || t.liquidity) && (
                    <div className="grid grid-cols-3 gap-1 mt-1.5">
                      {t.marketCap && (
                        <div className="text-center">
                          <div className="text-[8px] text-gray-600 uppercase">MCap</div>
                          <div className="text-[9px] text-gray-300 font-medium">{t.marketCap}</div>
                        </div>
                      )}
                      {t.volume && (
                        <div className="text-center">
                          <div className="text-[8px] text-gray-600 uppercase">Vol</div>
                          <div className="text-[9px] text-gray-300 font-medium">{t.volume}</div>
                        </div>
                      )}
                      {t.liquidity && (
                        <div className="text-center">
                          <div className="text-[8px] text-gray-600 uppercase">Liq</div>
                          <div className="text-[9px] text-gray-300 font-medium">{t.liquidity}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {t.contract && (
                    <a
                      href={`#contract-${t.contract}`}
                      className="mt-2 flex items-center gap-1 text-[9px] text-[#0A1EFF] hover:opacity-80 transition-opacity"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span className="font-mono truncate">
                        {t.contract.slice(0, 6)}…{t.contract.slice(-4)}
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tool timeline */}
        {toolEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                Tools used
              </span>
            </div>
            <div className="space-y-1">
              {toolEvents
                .slice()
                .reverse()
                .slice(0, 12)
                .map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <RiskIcon risk={evt.risk} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-300 font-medium leading-tight">
                        {TOOL_LABELS[evt.name] ?? evt.name}
                      </div>
                      {evt.summary && (
                        <div className="text-[9px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                          {evt.summary}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-600 flex-shrink-0">{relTime(evt.timestamp)}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
