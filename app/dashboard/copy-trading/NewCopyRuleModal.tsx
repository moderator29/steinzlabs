"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Bell, MousePointerClick, Bot, Lock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, effectiveTier } from "@/lib/hooks/useAuth";
import { useWallet } from "@/lib/hooks/useWallet";

type Mode = "alerts_only" | "oneclick" | "auto_copy";
type Direction = "both" | "buy" | "sell";

export interface EditableRule {
  id: string;
  whale_address: string;
  chain: string;
  mode: Mode | null;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  pct_of_whale: number | null;
  tp_pct: number | null;
  sl_pct: number | null;
  max_slippage_bps: number;
  copy_direction?: Direction | null;
  min_trade_size_usd?: number | null;
  tokens_allowlist?: string[] | null;
  tokens_blacklist?: string[] | null;
  // Carried through edit so re-saving a rule preserves its live on/off + pause
  // state (the upsert would otherwise reset them to the create defaults).
  enabled?: boolean;
  paused?: boolean;
}

interface Props {
  initialWhaleAddress?: string;
  initialChain?: string;
  initialLabel?: string;
  /** When set the modal edits an existing rule (whale + chain are locked). */
  initialRule?: EditableRule | null;
  onClose: () => void;
  onSaved: () => void;
}

// Split a comma/newline/space separated address blob into a clean array.
function parseAddresses(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

const MODE_META: Record<Mode, { title: string; sub: string; icon: typeof Bell; required: "free" | "pro" | "max" }> = {
  alerts_only: {
    title: "Alerts Only",
    sub: "Telegram push when the whale trades. You decide what to do.",
    icon: Bell,
    required: "free",
  },
  oneclick: {
    title: "One-Click Copy",
    sub: "Pre-filled swap card on whale trade. Tap Confirm in app.",
    icon: MousePointerClick,
    required: "pro",
  },
  auto_copy: {
    title: "Auto-Copy",
    sub: "Auto-fires per your rules. Pause anytime. Browser still signs.",
    icon: Bot,
    required: "max",
  },
};

const TIER_RANK: Record<string, number> = { free: 0, mini: 1, pro: 2, max: 3 };

export default function NewCopyRuleModal({
  initialWhaleAddress = "",
  initialChain = "ethereum",
  initialLabel = "",
  initialRule = null,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initialRule;
  const { user } = useAuth();
  const tier = useMemo(
    () =>
      effectiveTier(
        user ? { tier: user.tier, tier_expires_at: user.tier_expires_at } : null,
      ),
    [user],
  );

  // Escape closes modal — matches platform UX.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [mode, setMode] = useState<Mode>(initialRule?.mode ?? "oneclick");
  const [whale, setWhale] = useState(initialRule?.whale_address ?? initialWhaleAddress);
  const [chain, setChain] = useState(initialRule?.chain ?? initialChain);
  const [maxPerTrade, setMaxPerTrade] = useState(initialRule ? String(initialRule.max_per_trade_usd) : "100");
  const [dailyCap, setDailyCap] = useState(initialRule ? String(initialRule.daily_cap_usd) : "500");
  const [sizingMode, setSizingMode] = useState<"fixed" | "pct">(
    initialRule?.pct_of_whale != null ? "pct" : "fixed",
  );
  const [pctOfWhale, setPctOfWhale] = useState(initialRule?.pct_of_whale != null ? String(initialRule.pct_of_whale) : "5");
  const [tpPct, setTpPct] = useState(initialRule?.tp_pct != null ? String(initialRule.tp_pct) : "");
  const [slPct, setSlPct] = useState(initialRule?.sl_pct != null ? String(initialRule.sl_pct) : "");
  const [slippageBps, setSlippageBps] = useState(initialRule ? String(initialRule.max_slippage_bps) : "200");
  const [direction, setDirection] = useState<Direction>(initialRule?.copy_direction ?? "both");
  const [minTradeSize, setMinTradeSize] = useState(
    initialRule?.min_trade_size_usd != null ? String(initialRule.min_trade_size_usd) : "",
  );
  const [allowText, setAllowText] = useState((initialRule?.tokens_allowlist ?? []).join("\n"));
  const [blockText, setBlockText] = useState((initialRule?.tokens_blacklist ?? []).join("\n"));
  const [showFilters, setShowFilters] = useState(
    !!(initialRule && ((initialRule.copy_direction && initialRule.copy_direction !== "both") ||
      initialRule.min_trade_size_usd != null ||
      (initialRule.tokens_allowlist?.length ?? 0) > 0 ||
      (initialRule.tokens_blacklist?.length ?? 0) > 0)),
  );
  const [saving, setSaving] = useState(false);

  const modeAllowed = TIER_RANK[tier] >= TIER_RANK[MODE_META[mode].required];

  // Chain-mismatch warning — if a wallet is connected on a different
  // chain family than the rule targets, auto-copy / one-click will
  // fail at signing time. Surface this up-front rather than at the
  // moment of (failed) execution. Alerts-only mode is unaffected since
  // it doesn't sign anything.
  const { address: walletAddr, provider, walletPlatformChain } = useWallet();
  const ruleIsSolana = chain === "solana";
  const crossFamily = !!walletAddr && (
    (provider === "phantom" && !ruleIsSolana) ||
    (provider === "metamask" && ruleIsSolana)
  );
  const withinEvm = !!walletAddr && !crossFamily && !ruleIsSolana
    && walletPlatformChain !== null && walletPlatformChain !== chain;
  const showChainMismatch = mode !== "alerts_only" && (crossFamily || withinEvm);
  const mismatchTarget = ruleIsSolana
    ? "a Solana wallet (Phantom)"
    : `an EVM wallet on ${chain}`;

  async function save() {
    if (!modeAllowed) {
      return toast.error(`${MODE_META[mode].title} requires ${MODE_META[mode].required} tier`);
    }
    if (!whale.trim()) return toast.error("Whale address required");
    const max = Number(maxPerTrade);
    const day = Number(dailyCap);
    if (!Number.isFinite(max) || !Number.isFinite(day) || max <= 0 || day <= 0) {
      return toast.error("Caps must be positive numbers");
    }
    if (max > day) return toast.error("Max per trade can't exceed daily cap");

    let pctValue: number | null = null;
    if (sizingMode === "pct") {
      const p = Number(pctOfWhale);
      if (!Number.isFinite(p) || p <= 0 || p > 100) {
        return toast.error("% of whale must be between 0 and 100");
      }
      pctValue = p;
    }
    const tp = tpPct ? Number(tpPct) : null;
    const sl = slPct ? Number(slPct) : null;
    if (tp != null && (!Number.isFinite(tp) || tp <= 0)) return toast.error("TP must be positive");
    if (sl != null && (!Number.isFinite(sl) || sl <= 0)) return toast.error("SL must be positive");
    const slip = Number(slippageBps);
    if (!Number.isFinite(slip) || slip <= 0 || slip > 5000) {
      return toast.error("Slippage must be 1–5000 bps");
    }
    let minSize: number | null = null;
    if (minTradeSize.trim()) {
      const m = Number(minTradeSize);
      if (!Number.isFinite(m) || m < 0) return toast.error("Min whale trade size must be ≥ 0");
      minSize = m;
    }
    const allowlist = parseAddresses(allowText);
    const blocklist = parseAddresses(blockText);

    setSaving(true);
    try {
      const res = await fetch("/api/copy-trading/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whale_address: whale.trim(),
          chain,
          mode,
          max_per_trade_usd: max,
          daily_cap_usd: day,
          pct_of_whale: pctValue,
          tp_pct: tp,
          sl_pct: sl,
          max_slippage_bps: slip,
          copy_direction: direction,
          min_trade_size_usd: minSize,
          tokens_allowlist: allowlist,
          tokens_blacklist: blocklist,
          // On edit, preserve the rule's current enabled/paused rather than
          // letting the create defaults flip them back on.
          ...(isEdit ? { enabled: initialRule?.enabled ?? true, paused: initialRule?.paused ?? false } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to save rule");
        return;
      }
      toast.success(isEdit ? "Rule updated" : "Rule saved");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0F1320] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{isEdit ? "Edit copy rule" : "New copy rule"}</h2>
            <p className="text-xs text-white/50 mt-0.5 truncate">
              {initialLabel ? `Mirror ${initialLabel} on your terms.` : "Mirror a whale on your terms."}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-white/60">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">Mode</label>
            <div className="mt-2 space-y-2">
              {(["alerts_only", "oneclick", "auto_copy"] as Mode[]).map((m) => {
                const meta = MODE_META[m];
                const Icon = meta.icon;
                const locked = TIER_RANK[tier] < TIER_RANK[meta.required];
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full text-start rounded-xl border p-3 transition flex items-start gap-3 ${
                      mode === m ? "border-blue-400/60 bg-blue-500/15" : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    } ${locked ? "opacity-60" : ""}`}
                  >
                    <Icon size={16} className={mode === m ? "text-blue-300" : "text-white/60"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{meta.title}</span>
                        {locked && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            <Lock size={9} /> {meta.required}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/55 mt-0.5">{meta.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Whale address" value={whale} onChange={setWhale} placeholder="0x… / mint" mono disabled={isEdit} />
            <SelectField
              label="Chain"
              value={chain}
              onChange={setChain}
              disabled={isEdit}
              options={["ethereum", "solana", "bsc", "base", "arbitrum", "optimism", "polygon", "avalanche"]}
            />
          </div>

          {showChainMismatch && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                Connected via <span className="font-semibold">{provider}</span>; this rule targets{" "}
                <span className="font-semibold uppercase">{chain}</span>. {MODE_META[mode].title}
                {" "}requires {mismatchTarget} to sign trades. You can still save the rule, but
                trades will fail until the wallet matches.
              </span>
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">Sizing</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["fixed", "pct"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSizingMode(m)}
                  className={`rounded-lg border p-2 text-xs font-medium transition ${
                    sizingMode === m ? "border-blue-400/60 bg-blue-500/15 text-blue-100" : "border-white/10 bg-white/[0.03] text-white/60"
                  }`}
                >
                  {m === "fixed" ? "Fixed USD" : "% of whale"}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {sizingMode === "fixed" ? (
                <Field label="Max per trade ($)" value={maxPerTrade} onChange={setMaxPerTrade} type="number" />
              ) : (
                <>
                  <Field label="% of whale's size" value={pctOfWhale} onChange={setPctOfWhale} type="number" />
                  <Field label="Hard cap per trade ($)" value={maxPerTrade} onChange={setMaxPerTrade} type="number" />
                </>
              )}
              <Field label="Daily cap ($)" value={dailyCap} onChange={setDailyCap} type="number" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Take-profit %" value={tpPct} onChange={setTpPct} type="number" placeholder="e.g. 100" />
            <Field label="Stop-loss %" value={slPct} onChange={setSlPct} type="number" placeholder="e.g. 25" />
            <Field label="Slippage (bps)" value={slippageBps} onChange={setSlippageBps} type="number" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/50 font-semibold hover:text-white/80"
            >
              {showFilters ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Filters
              <span className="text-white/30 normal-case tracking-normal font-normal">optional</span>
            </button>

            {showFilters && (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">Direction</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {([
                      ["both", "Buys + sells"],
                      ["buy", "Buys only"],
                      ["sell", "Sells only"],
                    ] as [Direction, string][]).map(([d, lbl]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDirection(d)}
                        className={`rounded-lg border p-2 text-xs font-medium transition ${
                          direction === d ? "border-blue-400/60 bg-blue-500/15 text-blue-100" : "border-white/10 bg-white/[0.03] text-white/60"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="Min whale trade size ($)"
                  value={minTradeSize}
                  onChange={setMinTradeSize}
                  type="number"
                  placeholder="e.g. 5000 — skip smaller moves"
                />

                <TextAreaField
                  label="Only copy these tokens (allow-list)"
                  value={allowText}
                  onChange={setAllowText}
                  placeholder="One token address per line. Leave empty to allow all."
                />
                <TextAreaField
                  label="Never copy these tokens (block-list)"
                  value={blockText}
                  onChange={setBlockText}
                  placeholder="One token address per line."
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-white/60 hover:text-white px-3 py-1.5">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !modeAllowed}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        className={`mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 focus:border-blue-400/60 px-2.5 py-1.5 text-sm text-white outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
          props.mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={2}
        className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 focus:border-blue-400/60 px-2.5 py-1.5 text-sm text-white outline-none font-mono resize-y"
      />
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 focus:border-blue-400/60 px-2.5 py-1.5 text-sm text-white outline-none capitalize disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {props.options.map((o) => (
          <option key={o} value={o} className="bg-[#0F1320]">{o}</option>
        ))}
      </select>
    </label>
  );
}
