'use client';

/**
 * #68 Market-Maker dashboard.
 *
 * Lists the caller's strategies (GET /api/market-maker/strategies), lets them
 * create (POST), and activate/pause/stop (PATCH status) — all wired to the real
 * API with its exact field names. Non-custodial: execution reuses the AA
 * session-key kernel path, so we surface the existing background-kernel setup
 * card rather than rebuilding custody. Real data only — honest empty / loading /
 * error states, no fabricated strategies or numbers.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Loader2, Plus, Play, Pause, Square, Copy, Check, AlertTriangle, ShieldCheck, RefreshCw,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { useAuth } from '@/lib/hooks/useAuth';
import { BackgroundSnipingCard } from '@/components/sniper/BackgroundSnipingCard';
import { CreateStrategyModal } from '@/components/marketMaker/CreateStrategyModal';

// Inline blue-stride ring — brand neon-blue edge glow.
const BLUE_STRIDE = { boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' } as const;

// Matches the columns persisted by app/api/market-maker/strategies/route.ts.
interface Strategy {
  id: string;
  chain: string;
  token_address: string;
  token_symbol: string | null;
  strategy_type: string;
  reference_price_mode: string;
  manual_reference_price: number | null;
  spread_bps: number;
  num_levels: number;
  order_size_usd: number;
  budget_usd: number;
  max_inventory_usd: number | null;
  max_slippage_bps: number;
  band_pct: number | null;
  status: 'active' | 'paused' | 'stopped';
  realized_pnl_usd: number | null;
  inventory_tokens: number | null;
  spent_usd: number | null;
  gross_deployed_usd: number | null;
  created_at: string;
}

function fmtUsd(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: v >= 1 || v <= -1 || v === 0 ? 2 : 4 });
}

export default function MarketMakerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/market-maker/strategies', { cache: 'no-store' });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Could not load strategies.'); return; }
      const j = await res.json();
      setStrategies(Array.isArray(j?.strategies) ? j.strategies : []);
    } catch {
      setError('Could not load strategies.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    load();
  }, [authLoading, user, load, router]);

  const setStatus = useCallback(async (s: Strategy, status: Strategy['status']) => {
    if (busyId) return;
    setBusyId(s.id);
    // Optimistic update — reverted on failure.
    const prev = strategies;
    setStrategies((cur) => cur.map((x) => (x.id === s.id ? { ...x, status } : x)));
    try {
      const res = await fetch('/api/market-maker/strategies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, status }),
      });
      if (!res.ok) { setStrategies(prev); setError('Could not update strategy status.'); }
    } catch {
      setStrategies(prev);
      setError('Could not update strategy status.');
    } finally {
      setBusyId(null);
    }
  }, [busyId, strategies]);

  const activeCount = useMemo(() => strategies.filter((s) => s.status === 'active').length, [strategies]);

  if (authLoading || (loading && user)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <BackButton />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mt-3 nl-glass rounded-2xl p-4 sm:p-5" style={BLUE_STRIDE}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/40 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Market Maker</h1>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Non-Custodial</span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/50">Grid market making · EVM auto-execution via capped session key · {activeCount} active</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setLoading(true); load(); }} className="nl-button nl-button--ghost shrink-0 px-3 py-2 rounded-lg text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={() => setShowCreate(true)} className="nl-btn-neon inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs">
                <Plus className="w-4 h-4" /> New Strategy
              </button>
            </div>
          </div>

          {/* Global kill-switch note */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-2.5">
            <Square className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="text-amber-100/90 text-[11px] sm:text-xs font-medium">
              Global kill: pause or stop any strategy to halt it instantly. Stopped strategies never place new orders — your funded session key stays capped and revocable.
            </p>
          </div>
        </div>

        {/* ── Risk + non-custodial notice ─────────────────────────────── */}
        <div className="mt-4 nl-glass rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
            <div className="text-xs text-white/70 leading-relaxed">
              <span className="font-semibold text-white">Market making can lose money</span> — impermanent loss, adverse
              selection and gas can all erode capital. Returns are never guaranteed. Funds stay non-custodial: execution
              uses your capped session key, and your main keys never leave your browser.
            </div>
          </div>
        </div>

        {/* ── AA kernel fund/enable prompt (reused, not rebuilt) ──────── */}
        <div className="mt-4">
          <BackgroundSnipingCard />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 flex items-center gap-2 text-sm text-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Strategy list ───────────────────────────────────────────── */}
        <div className="mt-5">
          {strategies.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <Bot className="w-12 h-12 mx-auto mb-3 text-white/30" />
              <h3 className="text-lg font-bold mb-1">No strategies yet</h3>
              <p className="text-white/50 text-sm mb-5">No strategies yet — create one to start market making.</p>
              <button onClick={() => setShowCreate(true)} className="nl-btn-neon px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Strategy
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {strategies.map((s) => (
                <StrategyCard key={s.id} s={s} busy={busyId === s.id} onSetStatus={setStatus} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateStrategyModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({ s, busy, onSetStatus }: { s: Strategy; busy: boolean; onSetStatus: (s: Strategy, status: Strategy['status']) => void }) {
  const [copied, setCopied] = useState(false);
  const copyAddr = async () => {
    try { await navigator.clipboard.writeText(s.token_address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  const statusColor = s.status === 'active' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : s.status === 'paused' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : 'text-white/50 bg-white/5 border-white/10';

  // Lifetime deployed (monotonic) vs the budget cap — the true spend ceiling.
  const spent = Number(s.gross_deployed_usd ?? s.spent_usd ?? 0);
  const budget = Number(s.budget_usd ?? 0);
  const spentPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const pnl = s.realized_pnl_usd != null ? Number(s.realized_pnl_usd) : null;
  const inventoryTokens = Number(s.inventory_tokens ?? 0);
  // Inventory ~USD: only a faithful estimate when a manual reference is set;
  // otherwise the live market price lives server-side, so we show tokens only.
  const inventoryUsd = s.reference_price_mode === 'manual' && s.manual_reference_price
    ? inventoryTokens * Number(s.manual_reference_price)
    : null;

  const shortAddr = `${s.token_address.slice(0, 6)}…${s.token_address.slice(-4)}`;

  return (
    <div className="nl-glass rounded-xl p-4" style={BLUE_STRIDE}>
      {/* Top row: token + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ChainLogo chain={s.chain} size={20} />
            <h3 className="text-base font-bold truncate">{s.token_symbol || shortAddr}</h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-white/60">{s.chain}</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/15 text-blue-300">{s.strategy_type}</span>
          </div>
          <button onClick={copyAddr} title="Copy token address" className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono text-white/45 hover:text-white/80 transition">
            {shortAddr} {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 ${statusColor}`}>{s.status}</span>
      </div>

      {/* Params */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
        <Field label="Spread">{(s.spread_bps / 100).toFixed(2)}%</Field>
        <Field label="Levels">{s.num_levels} / side</Field>
        <Field label="Order size">{fmtUsd(s.order_size_usd)}</Field>
        <Field label="Budget">{fmtUsd(s.budget_usd)}</Field>
      </div>

      {/* Spent vs budget */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-white/45 uppercase tracking-wider font-semibold">Spent</span>
          <span className="text-white/70 tabular-nums">{fmtUsd(spent)} / {fmtUsd(budget)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-[#0066FF]" style={{ width: `${spentPct}%` }} />
        </div>
      </div>

      {/* Inventory + PnL */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <Field label="Inventory">
          {inventoryTokens > 0
            ? <>{inventoryTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} {s.token_symbol || ''}{inventoryUsd != null ? <span className="text-white/40"> · ~{fmtUsd(inventoryUsd)}</span> : ''}</>
            : <span className="text-white/40">—</span>}
        </Field>
        <Field label="Realized PnL">
          <span className={pnl != null && pnl > 0 ? 'text-emerald-300' : pnl != null && pnl < 0 ? 'text-red-300' : 'text-white/60'}>
            {pnl != null ? fmtUsd(pnl) : '—'}
          </span>
        </Field>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {s.status === 'active' ? (
          <button onClick={() => onSetStatus(s, 'paused')} disabled={busy} className="nl-button nl-button--ghost flex-1 !py-2 !text-xs font-semibold inline-flex items-center justify-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5 text-amber-300" />} Pause
          </button>
        ) : (
          <button onClick={() => onSetStatus(s, 'active')} disabled={busy} className="nl-btn-neon flex-1 !py-2 !text-xs font-bold inline-flex items-center justify-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Activate
          </button>
        )}
        <button
          onClick={() => onSetStatus(s, 'stopped')}
          disabled={busy || s.status === 'stopped'}
          className="nl-button nl-button--ghost !py-2 !px-3 !text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Square className="w-3.5 h-3.5 text-red-300" /> Stop
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-0.5">{label}</div>
      <div className="text-white/90 font-medium truncate">{children}</div>
    </div>
  );
}
