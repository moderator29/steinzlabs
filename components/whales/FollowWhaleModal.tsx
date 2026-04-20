'use client';

// Phase 6 — FollowWhaleModal
// 3 modes: Alerts Only (Pro) · One-Click Copy (Pro) · Auto-Copy (Max).
// Whole follow flow is Pro+ by product design — the backend
// `withTierGate('pro')` on /api/whales/[address]/follow mirrors that.
// Persists to user_whale_follows + user_copy_rules.

import { useState } from 'react';
import { X, Bell, Zap, Cpu, Loader2, Check, AlertTriangle, Lock } from 'lucide-react';
import { useTier } from '@/lib/hooks/useTier';

type Mode = 'alerts' | 'one_click' | 'auto';

interface WhaleLite {
  address: string;
  chain: string;
  label: string | null;
}

export default function FollowWhaleModal({
  whale,
  onClose,
  onDone,
}: {
  whale: WhaleLite;
  onClose: () => void;
  onDone: () => void;
}) {
  const { tier, isPro, isMax, isPaid, loading: tierLoading } = useTier();
  const [mode, setMode] = useState<Mode>('alerts');
  const [maxPerTrade, setMaxPerTrade] = useState(500);
  const [dailyCap, setDailyCap] = useState(2500);
  const [slippage, setSlippage] = useState(1.5);
  const [threshold, setThreshold] = useState(50_000);
  const [channels, setChannels] = useState({ push: true, email: true, telegram: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!isPro) { setError('Whale tracking requires Pro. Upgrade to follow whales.'); return; }
    if (mode === 'auto' && !isMax) { setError('Auto-Copy requires Max.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/whales/${whale.address}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: whale.chain,
          mode,
          alert_threshold_usd: threshold,
          alert_channels: Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
          copy_rules: mode !== 'alerts' ? {
            max_per_trade_usd: maxPerTrade,
            daily_cap_usd: dailyCap,
            slippage_pct: slippage,
            allowed_chains: [whale.chain],
          } : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setTimeout(onDone, 900);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-[#0A0E1A] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <h2 className="font-bold">Follow {whale.label || whale.address.slice(0, 8)}</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">{whale.chain}</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Follow mode</label>
            {tierLoading ? (
              // Bug §2.17: without this guard, the modal flashes all-locked
              // for a beat (useTier defaults isPro=isMax=false until /api/user/tier
              // resolves). A Max user would see three locks for ~200ms and
              // screenshot it as "my tier isn't detected". Show a real skeleton.
              <div className="space-y-2">
                <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
              </div>
            ) : (
              <>
                <ModeCard
                  active={mode === 'alerts'}
                  onClick={() => { if (isPro) setMode('alerts'); }}
                  Icon={Bell}
                  title="Alerts only"
                  description="Get notified when this whale trades. Requires Pro."
                  locked={!isPro}
                  requiredTier="Pro"
                  currentTier={tier}
                />
                <ModeCard
                  active={mode === 'one_click'}
                  onClick={() => { if (isPro) setMode('one_click'); }}
                  Icon={Zap}
                  title="One-Click Copy"
                  description="Review each trade, copy with one tap. Requires Pro."
                  locked={!isPro}
                  requiredTier="Pro"
                  currentTier={tier}
                />
                <ModeCard
                  active={mode === 'auto'}
                  onClick={() => { if (isMax) setMode('auto'); }}
                  Icon={Cpu}
                  title="Auto-Copy"
                  description="Mirror every trade automatically with your rules. Requires Max."
                  locked={!isMax}
                  requiredTier="Max"
                  currentTier={tier}
                />
              </>
            )}
          </div>

          {/* Alert threshold + channels (always shown) */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Alert threshold</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={1000}
                max={1_000_000}
                step={1000}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                className="flex-1 accent-[#0A1EFF]"
              />
              <div className="w-20 text-right font-mono text-sm">${threshold.toLocaleString()}</div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Only notify on trades ≥ this USD value.</p>
          </div>
          <div className="flex items-center gap-2">
            {(['push', 'email', 'telegram'] as const).map((k) => (
              <label key={k} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                channels[k] ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border-[#0A1EFF]/40' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}>
                <input
                  type="checkbox"
                  checked={channels[k]}
                  onChange={(e) => setChannels({ ...channels, [k]: e.target.checked })}
                  className="hidden"
                />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </label>
            ))}
          </div>

          {/* Copy rules (only for copy modes) */}
          {mode !== 'alerts' && (
            <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Copy-trade rules</div>
              <NumberRow label="Max per trade (USD)" value={maxPerTrade} setValue={setMaxPerTrade} step={50} />
              <NumberRow label="Daily cap (USD)" value={dailyCap} setValue={setDailyCap} step={100} />
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500">Slippage tolerance</label>
                  <span className="text-xs font-mono">{slippage.toFixed(1)}%</span>
                </div>
                <input
                  type="range" min={0.1} max={10} step={0.1} value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  className="w-full accent-[#0A1EFF] mt-1"
                />
              </div>
              {mode === 'auto' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-[11px] text-amber-200">
                    Auto-Copy executes on your linked wallet automatically. Only enable this for whales you trust.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}
          {success && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> Following — you'll get alerts for trades ≥ ${threshold.toLocaleString()}.
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] font-bold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Confirm Follow'}
          </button>
          {!isPro && (
            <p className="text-[10px] text-amber-400/80 text-center">
              Whale tracking is Pro+. Upgrade to follow whales, receive alerts, and copy trades.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active, onClick, Icon, title, description, locked, requiredTier, currentTier,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Bell;
  title: string;
  description: string;
  locked: boolean;
  requiredTier?: string;
  currentTier?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
        active ? 'bg-[#0A1EFF]/15 border-[#0A1EFF]/50'
        : locked ? 'bg-white/[0.02] border-white/10 opacity-60 cursor-not-allowed'
        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-[#0A1EFF]/20 text-[#8FA3FF]' : 'bg-white/5 text-slate-400'}`}>
        {locked ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{title}</span>
          {locked && requiredTier && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 uppercase">
              {requiredTier} required
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

function NumberRow({ label, value, setValue, step }: { label: string; value: number; setValue: (n: number) => void; step: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => setValue(parseInt(e.target.value || '0', 10) || 0)}
        className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-right outline-none focus:border-[#0A1EFF]/50"
      />
    </div>
  );
}
