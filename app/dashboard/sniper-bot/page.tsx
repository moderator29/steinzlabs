"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/ui/BackButton";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SniperCriteria {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: "new_token_launch" | "whale_buy" | "price_target";
  chains_allowed: string[];
  min_liquidity_usd: number;
  max_buy_tax_bps: number;
  max_sell_tax_bps: number;
  min_holder_count: number;
  max_age_hours: number;
  min_security_score: number;
  block_honeypots: boolean;
  trigger_whale_address: string | null;
  trigger_price_target: number | null;
  amount_per_snipe_usd: number;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  auto_execute: boolean;
  wallet_source: "metamask" | "phantom" | "builtin";
  created_at: string;
}

interface MatchEvent {
  id: string;
  criteria_id: string;
  user_id: string;
  matched_token_address: string;
  matched_chain: string;
  trigger_reason: string;
  decision: "matched" | "sniped_pending" | "sniped_executed" | "skipped" | "failed";
  pending_trade_id: string | null;
  executed_tx_hash: string | null;
  pnl_usd: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface PlatformState {
  enabled: boolean;
  disabled_reason: string | null;
  disabled_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAINS = ["ethereum", "solana", "bsc", "arbitrum", "polygon", "base", "avalanche"];
const TRIGGER_LABELS: Record<SniperCriteria["trigger_type"], string> = {
  new_token_launch: "New Token Launch",
  whale_buy: "Whale Buy",
  price_target: "Price Target",
};
const DECISION_COLORS: Record<MatchEvent["decision"], string> = {
  matched: "text-blue-400",
  sniped_pending: "text-yellow-400",
  sniped_executed: "text-green-400",
  skipped: "text-slate-400",
  failed: "text-red-400",
};
const WALLET_LABELS: Record<SniperCriteria["wallet_source"], string> = {
  metamask: "MetaMask",
  phantom: "Phantom",
  builtin: "Built-in",
};

// ─── Create Criteria Modal ────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  trigger_type: "new_token_launch" as SniperCriteria["trigger_type"],
  chains_allowed: ["ethereum"] as string[],
  min_liquidity_usd: 10000,
  max_buy_tax_bps: 1000,
  max_sell_tax_bps: 1000,
  min_holder_count: 10,
  max_age_hours: 48,
  min_security_score: 60,
  block_honeypots: true,
  trigger_whale_address: "",
  trigger_price_target: "",
  amount_per_snipe_usd: 50,
  daily_max_snipes: 5,
  daily_max_spend_usd: 500,
  auto_execute: false,
  wallet_source: "metamask" as SniperCriteria["wallet_source"],
};

function CreateModal({
  onClose,
  onCreated,
  editItem,
}: {
  onClose: () => void;
  onCreated: (c: SniperCriteria) => void;
  editItem?: SniperCriteria;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    editItem
      ? {
          name: editItem.name,
          trigger_type: editItem.trigger_type,
          chains_allowed: editItem.chains_allowed,
          min_liquidity_usd: editItem.min_liquidity_usd,
          max_buy_tax_bps: editItem.max_buy_tax_bps,
          max_sell_tax_bps: editItem.max_sell_tax_bps,
          min_holder_count: editItem.min_holder_count,
          max_age_hours: editItem.max_age_hours,
          min_security_score: editItem.min_security_score,
          block_honeypots: editItem.block_honeypots,
          trigger_whale_address: editItem.trigger_whale_address ?? "",
          trigger_price_target: editItem.trigger_price_target?.toString() ?? "",
          amount_per_snipe_usd: editItem.amount_per_snipe_usd,
          daily_max_snipes: editItem.daily_max_snipes,
          daily_max_spend_usd: editItem.daily_max_spend_usd,
          auto_execute: editItem.auto_execute,
          wallet_source: editItem.wallet_source,
        }
      : { ...EMPTY_FORM }
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleChain = (c: string) =>
    setForm((f) => ({
      ...f,
      chains_allowed: f.chains_allowed.includes(c)
        ? f.chains_allowed.filter((x) => x !== c)
        : [...f.chains_allowed, c],
    }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        id: editItem?.id,
        ...form,
        trigger_whale_address: form.trigger_whale_address || null,
        trigger_price_target: form.trigger_price_target ? Number(form.trigger_price_target) : null,
      };
      const res = await fetch("/api/sniper/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      onCreated(json.criteria as SniperCriteria);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Trigger", "Filters", "Execution", "Review"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-950 border border-slate-800/50 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">
              {editItem ? "Edit Criteria" : "New Sniper Criteria"}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
          {/* Step indicators */}
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`h-1 w-full rounded-full transition-colors ${
                    i + 1 <= step ? "bg-blue-500" : "bg-slate-800"
                  }`}
                />
                <span className={`text-xs ${i + 1 === step ? "text-blue-400" : "text-slate-500"}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Name</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Low-cap ETH Snipers"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Trigger Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["new_token_launch", "whale_buy", "price_target"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => set("trigger_type", t)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.trigger_type === t
                          ? "bg-blue-500/20 border-blue-500 text-blue-300"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {TRIGGER_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              {form.trigger_type === "whale_buy" && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Whale Address (optional)</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                    value={form.trigger_whale_address}
                    onChange={(e) => set("trigger_whale_address", e.target.value)}
                    placeholder="0x… or leave blank for any whale"
                  />
                </div>
              )}
              {form.trigger_type === "price_target" && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Price Target (USD)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={form.trigger_price_target}
                    onChange={(e) => set("trigger_price_target", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Chains</label>
                <div className="flex flex-wrap gap-2">
                  {CHAINS.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleChain(c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        form.chains_allowed.includes(c)
                          ? "bg-purple-500/20 border-purple-500 text-purple-300"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {[
                { label: "Min Liquidity (USD)", key: "min_liquidity_usd" as const, min: 0 },
                { label: "Max Buy Tax (bps)", key: "max_buy_tax_bps" as const, min: 0 },
                { label: "Max Sell Tax (bps)", key: "max_sell_tax_bps" as const, min: 0 },
                { label: "Min Holder Count", key: "min_holder_count" as const, min: 1 },
                { label: "Max Token Age (hours)", key: "max_age_hours" as const, min: 1 },
                { label: "Min Security Score (0–100)", key: "min_security_score" as const, min: 0 },
              ].map(({ label, key, min }) => (
                <div key={key}>
                  <label className="block text-slate-400 text-sm mb-1">{label}</label>
                  <input
                    type="number"
                    min={min}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={form[key] as number}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-300 text-sm">Block Honeypots</span>
                <button
                  onClick={() => set("block_honeypots", !form.block_honeypots)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    form.block_honeypots ? "bg-blue-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      form.block_honeypots ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Amount per Snipe (USD)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.amount_per_snipe_usd}
                  onChange={(e) => set("amount_per_snipe_usd", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Daily Max Snipes</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.daily_max_snipes}
                  onChange={(e) => set("daily_max_snipes", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Daily Max Spend (USD)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.daily_max_spend_usd}
                  onChange={(e) => set("daily_max_spend_usd", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Wallet Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["metamask", "phantom", "builtin"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => set("wallet_source", w)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.wallet_source === w
                          ? "bg-blue-500/20 border-blue-500 text-blue-300"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {WALLET_LABELS[w]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-slate-300 text-sm">Auto Execute</span>
                  <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">MAX</span>
                </div>
                <button
                  onClick={() => set("auto_execute", !form.auto_execute)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    form.auto_execute ? "bg-green-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      form.auto_execute ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {form.auto_execute && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Auto Execute requires Max tier. Trades will be submitted as pending and require wallet signature.
                </p>
              )}
            </>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 space-y-2">
                <Row label="Name" value={form.name} />
                <Row label="Trigger" value={TRIGGER_LABELS[form.trigger_type]} />
                <Row label="Chains" value={form.chains_allowed.join(", ")} />
                <Row label="Min Liquidity" value={`$${form.min_liquidity_usd.toLocaleString()}`} />
                <Row label="Security Score" value={`≥ ${form.min_security_score}`} />
                <Row label="Per Snipe" value={`$${form.amount_per_snipe_usd}`} />
                <Row label="Daily Cap" value={`${form.daily_max_snipes} snipes / $${form.daily_max_spend_usd}`} />
                <Row label="Wallet" value={WALLET_LABELS[form.wallet_source]} />
                <Row label="Auto Execute" value={form.auto_execute ? "Yes (Max)" : "No"} />
              </div>
              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/50 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Back
            </button>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => {
                if (step === 1 && (!form.name || !form.chains_allowed.length)) return;
                setStep((s) => s + 1);
              }}
              disabled={step === 1 && (!form.name || !form.chains_allowed.length)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving…" : editItem ? "Save Changes" : "Create"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

// ─── Kill Switch Confirm ──────────────────────────────────────────────────────

function KillSwitchModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-slate-950 border border-red-500/30 rounded-2xl p-6 text-center"
      >
        <div className="text-4xl mb-3">🛑</div>
        <h3 className="text-white font-semibold text-lg mb-2">Pause All Snipers?</h3>
        <p className="text-slate-400 text-sm mb-6">
          This will disable every active sniper criteria immediately. No new snipes will fire until you re-enable them.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Pause All
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Criteria Card ────────────────────────────────────────────────────────────

function CriteriaCard({
  c,
  onToggle,
  onEdit,
  onDelete,
}: {
  c: SniperCriteria;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (c: SniperCriteria) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium truncate">{c.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              c.enabled
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-slate-700/50 border-slate-600 text-slate-400"
            }`}>
              {c.enabled ? "Active" : "Paused"}
            </span>
            {c.auto_execute && (
              <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full">
                Auto
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1">
            {TRIGGER_LABELS[c.trigger_type]} · {c.chains_allowed.join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onToggle(c.id, !c.enabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${c.enabled ? "bg-green-500" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${c.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-white font-medium">${c.amount_per_snipe_usd}</div>
          <div className="text-slate-500">per snipe</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-white font-medium">{c.daily_max_snipes}</div>
          <div className="text-slate-500">daily max</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-2 text-center">
          <div className="text-white font-medium">${c.daily_max_spend_usd.toLocaleString()}</div>
          <div className="text-slate-500">daily spend</div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/50">
        <button onClick={() => onEdit(c)} className="text-xs text-slate-400 hover:text-white transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(c.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "criteria" | "feed" | "history";

export default function SniperBotPage() {
  const [tab, setTab] = useState<Tab>("criteria");
  const [criteria, setCriteria] = useState<SniperCriteria[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<SniperCriteria | undefined>();
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [killLoading, setKillLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCriteria = useCallback(async () => {
    const res = await fetch("/api/sniper/criteria");
    if (!res.ok) return;
    const json = await res.json();
    setCriteria(json.criteria ?? []);
    setLoadingCriteria(false);
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    const res = await fetch("/api/sniper/executions?limit=50");
    if (res.ok) {
      const json = await res.json();
      setEvents(json.events ?? []);
    }
    setLoadingEvents(false);
  }, []);

  const fetchPlatformState = useCallback(async () => {
    const res = await fetch("/api/sniper/state");
    if (res.ok) setPlatformState(await res.json());
  }, []);

  useEffect(() => {
    fetchCriteria();
    fetchPlatformState();
  }, [fetchCriteria, fetchPlatformState]);

  useEffect(() => {
    if (tab === "history") fetchEvents();
  }, [tab, fetchEvents]);

  // Poll feed every 30s when on feed tab
  useEffect(() => {
    if (tab === "feed") {
      fetchEvents();
      pollRef.current = setInterval(fetchEvents, 30_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [tab, fetchEvents]);

  async function handleToggle(id: string, enabled: boolean) {
    await fetch("/api/sniper/criteria", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sniper/criteria?id=${id}`, { method: "DELETE" });
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleKillSwitch() {
    setKillLoading(true);
    try {
      await fetch("/api/sniper/kill-switch", { method: "POST" });
      setCriteria((prev) => prev.map((c) => ({ ...c, enabled: false })));
    } finally {
      setKillLoading(false);
      setShowKillSwitch(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "criteria", label: "My Criteria" },
    { id: "feed", label: "Live Feed" },
    { id: "history", label: "Execution History" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3 flex items-center gap-3">
        <BackButton />
        <div className="flex items-center gap-2 flex-1">
          <span className="font-semibold text-white">Sniper Bot</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-medium">
            PRO
          </span>
        </div>
        <button
          onClick={() => setShowKillSwitch(true)}
          disabled={killLoading}
          className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-medium transition-colors"
        >
          🛑 Kill Switch
        </button>
      </div>

      {/* Platform-disabled banner */}
      {platformState && !platformState.enabled && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-center">
          <span className="text-red-400 text-sm">
            ⚠️ Sniper Bot is platform-wide disabled
            {platformState.disabled_reason ? `: ${platformState.disabled_reason}` : ""}
          </span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab Bar */}
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800/50 rounded-xl p-1 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: My Criteria */}
        {tab === "criteria" && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditItem(undefined); setShowCreate(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                + New Criteria
              </button>
            </div>
            {loadingCriteria ? (
              <div className="text-center text-slate-500 py-12">Loading…</div>
            ) : criteria.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-slate-400 mb-2">No sniper criteria yet</p>
                <p className="text-slate-500 text-sm">Create your first criteria to start auto-detecting opportunities.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                  {criteria.map((c) => (
                    <CriteriaCard
                      key={c.id}
                      c={c}
                      onToggle={handleToggle}
                      onEdit={(item) => { setEditItem(item); setShowCreate(true); }}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Tab: Live Feed */}
        {tab === "feed" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm">Matches detected in real-time. Refreshes every 30s.</p>
              <button onClick={fetchEvents} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                ↻ Refresh
              </button>
            </div>
            {loadingEvents ? (
              <div className="text-center text-slate-500 py-12">Loading…</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-slate-400">No recent matches</p>
                <p className="text-slate-500 text-sm mt-1">The monitor will log matches here as they occur.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {events.slice(0, 30).map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`bg-slate-950/80 backdrop-blur-xl border rounded-xl p-4 border-l-4 ${
                        e.decision === "sniped_executed"
                          ? "border-green-500/50 border-l-green-500"
                          : e.decision === "failed"
                          ? "border-red-500/50 border-l-red-500"
                          : "border-slate-800/50 border-l-blue-500"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium uppercase ${DECISION_COLORS[e.decision]}`}>
                              {e.decision.replace(/_/g, " ")}
                            </span>
                            <span className="text-slate-500 text-xs">·</span>
                            <span className="text-slate-400 text-xs">{e.matched_chain}</span>
                          </div>
                          <p className="text-white text-sm font-mono truncate mt-1">{e.matched_token_address}</p>
                          <p className="text-slate-400 text-xs mt-1">{e.trigger_reason}</p>
                        </div>
                        {e.pnl_usd !== null && (
                          <span className={`text-sm font-medium ${e.pnl_usd >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {e.pnl_usd >= 0 ? "+" : ""}${e.pnl_usd.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-xs mt-2">{new Date(e.created_at).toLocaleString()}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Tab: Execution History */}
        {tab === "history" && (
          <div>
            {loadingEvents ? (
              <div className="text-center text-slate-500 py-12">Loading…</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-400">No executions yet</p>
              </div>
            ) : (
              <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/50">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Token</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Chain</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Decision</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">PnL</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {events.map((e) => (
                        <motion.tr
                          key={e.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-slate-800/30 hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-white">
                            {e.matched_token_address.slice(0, 8)}…{e.matched_token_address.slice(-4)}
                          </td>
                          <td className="px-4 py-3 text-slate-400 capitalize">{e.matched_chain}</td>
                          <td className={`px-4 py-3 text-xs font-medium uppercase ${DECISION_COLORS[e.decision]}`}>
                            {e.decision.replace(/_/g, " ")}
                          </td>
                          <td className={`px-4 py-3 text-right ${
                            e.pnl_usd === null
                              ? "text-slate-500"
                              : e.pnl_usd >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}>
                            {e.pnl_usd === null ? "—" : `${e.pnl_usd >= 0 ? "+" : ""}$${e.pnl_usd.toFixed(2)}`}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                            {new Date(e.created_at).toLocaleDateString()}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            key="create"
            editItem={editItem}
            onClose={() => { setShowCreate(false); setEditItem(undefined); }}
            onCreated={(c) => {
              setCriteria((prev) =>
                editItem ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev]
              );
            }}
          />
        )}
        {showKillSwitch && (
          <KillSwitchModal
            key="kill"
            onClose={() => setShowKillSwitch(false)}
            onConfirm={handleKillSwitch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
