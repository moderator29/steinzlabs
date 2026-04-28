'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crosshair, Shield, AlertTriangle, Play, Pause, ExternalLink,
  CheckCircle, XCircle, Loader2, Lock, Plus, Power, Settings as SettingsIcon,
  TrendingUp, Trash2, Zap, Target, Filter,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth, effectiveTier } from '@/lib/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import { CHAIN_CONFIGS, SNIPER_CHAINS, type SniperChain } from '@/lib/sniper/chains';
import { NewSniperModal } from './NewSniperModal';

interface SniperCriteriaRow {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  paused: boolean;
  trigger_type: string;
  chains_allowed: string[];
  amount_per_snipe_usd: number;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  auto_execute: boolean;
  max_slippage_bps: number;
  priority_fee_native: number | null;
  mev_protect: boolean;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  trailing_stop_pct: number | null;
  wallet_addresses: string[];
  expiry_hours: number | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionRow {
  id: string;
  token_symbol: string | null;
  token_address: string;
  chain: string | null;
  amount_native: number | null;
  amount_sol: number | null;
  status: string;
  tx_hash: string | null;
  pnl_usd: number | null;
  executed_at: string;
  execution_time_ms: number | null;
}

interface DetectedToken {
  id: string; address: string; symbol: string; name: string; chain: string;
  liquidity: number; securityScore: number; status: 'safe' | 'risky' | 'blocked' | 'scanning' | 'sniped';
  detectedAt: number; price?: number; pairAge?: string; logo?: string;
}

type Tab = 'snipers' | 'feed' | 'history';

function fmtUSD(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(2)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SniperPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const tier = effectiveTier(user);
  const isMaxTier = tier === 'max';

  const [tab, setTab] = useState<Tab>('snipers');
  const [chainFilter, setChainFilter] = useState<SniperChain | 'all'>('all');
  const [snipers, setSnipers] = useState<SniperCriteriaRow[]>([]);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [feedTokens, setFeedTokens] = useState<DetectedToken[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [killSwitchOn, setKillSwitchOn] = useState(false);
  const [killToggling, setKillToggling] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadSnipers = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('sniper_criteria')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (!error && data) setSnipers(data as SniperCriteriaRow[]);
  }, [user?.id]);

  const loadExecutions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('sniper_executions')
      .select('id, token_symbol, token_address, chain, amount_native, amount_sol, status, tx_hash, pnl_usd, executed_at, execution_time_ms')
      .eq('user_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(50);
    if (data) setExecutions(data as ExecutionRow[]);
  }, [user?.id]);

  const loadKillSwitch = useCallback(async () => {
    try {
      const res = await fetch('/api/sniper/state', { cache: 'no-store' });
      const j = await res.json();
      // platform_sniper_state.enabled === false means killed.
      setKillSwitchOn(j?.enabled === false);
    } catch { /* keep default */ }
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (chainFilter !== 'all') params.set('chain', chainFilter);
      const res = await fetch(`/api/sniper?${params.toString()}`, { cache: 'no-store' });
      const j = await res.json();
      setFeedTokens(j?.tokens ?? []);
    } catch (err) {
      console.error('[sniper.feed] load failed:', err);
    } finally {
      setFeedLoading(false);
    }
  }, [chainFilter]);

  // ── Initial + reactive loads ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([loadSnipers(), loadExecutions(), loadKillSwitch()]).finally(() => setLoading(false));
  }, [authLoading, user, loadSnipers, loadExecutions, loadKillSwitch]);

  useEffect(() => {
    if (tab === 'feed') loadFeed();
  }, [tab, chainFilter, loadFeed]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const togglePause = async (s: SniperCriteriaRow) => {
    const next = !s.paused;
    setSnipers(prev => prev.map(x => x.id === s.id ? { ...x, paused: next } : x));
    await supabase.from('sniper_criteria').update({ paused: next }).eq('id', s.id);
  };

  const removeSniper = async (s: SniperCriteriaRow) => {
    if (!confirm(`Delete sniper "${s.name}"? This cannot be undone.`)) return;
    setSnipers(prev => prev.filter(x => x.id !== s.id));
    await supabase.from('sniper_criteria').delete().eq('id', s.id);
  };

  const toggleKillSwitch = async () => {
    if (killToggling) return;
    setKillToggling(true);
    const next = !killSwitchOn;
    try {
      const res = await fetch('/api/sniper/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !next, reason: next ? 'User killed all snipers' : null }),
      });
      if (res.ok) setKillSwitchOn(next);
    } finally {
      setKillToggling(false);
    }
  };

  const visibleSnipers = useMemo(
    () => chainFilter === 'all' ? snipers : snipers.filter(s => s.chains_allowed.includes(chainFilter)),
    [snipers, chainFilter],
  );

  // ── Render gates ─────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!isMaxTier) {
    return (
      <div className="min-h-screen bg-[#07090f] text-white p-6">
        <BackButton />
        <div className="max-w-md mx-auto mt-20 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-amber-400" />
          <h1 className="text-2xl font-bold mb-2">Sniper Bot is MAX-tier</h1>
          <p className="text-white/70 mb-6">Upgrade to MAX to unlock 5-chain sniping with sub-2s execution, anti-MEV routing, multi-wallet support, and TP/SL automation.</p>
          <button
            onClick={() => router.push('/dashboard/pricing')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 font-semibold hover:opacity-90 transition"
          >
            Upgrade to MAX
          </button>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <BackButton />

        <PageHeader
          title="Sniper Bot"
          description="Sub-2s execution · 5 chains · MEV-protected"
          actions={
            <>
              <button
                onClick={toggleKillSwitch}
                disabled={killToggling}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition ${
                  killSwitchOn
                    ? 'bg-red-500/15 border-red-500/50 text-red-300 hover:bg-red-500/25'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                {killToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {killSwitchOn ? 'KILLED — Resume' : 'Kill Switch'}
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 font-bold text-sm hover:opacity-90 transition shadow-lg shadow-blue-900/30"
              >
                <Plus className="w-4 h-4" />
                New Sniper
              </button>
            </>
          }
        />

        {killSwitchOn && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0" />
            <p className="text-red-200 text-sm font-medium">All snipers are killed server-side. No new executions will fire until you resume.</p>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatCard label="Active Snipers" value={snipers.filter(s => s.enabled && !s.paused).length} icon={Target} />
          <StatCard label="Total Executions" value={executions.length} icon={Zap} />
          <StatCard
            label="Total PnL"
            value={fmtUSD(executions.reduce((sum, e) => sum + (Number(e.pnl_usd) || 0), 0))}
            icon={TrendingUp}
          />
          <StatCard
            label="Avg Exec Time"
            value={(() => {
              const times = executions.map(e => e.execution_time_ms).filter((t): t is number => t != null && t > 0);
              if (!times.length) return '—';
              const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
              return `${avg < 1000 ? avg + 'ms' : (avg / 1000).toFixed(2) + 's'}`;
            })()}
            icon={Loader2}
          />
        </div>

        {/* Chain filter */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs uppercase tracking-wider text-white/50 font-semibold mr-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Chain:
          </span>
          <ChainPill active={chainFilter === 'all'} onClick={() => setChainFilter('all')}>All</ChainPill>
          {SNIPER_CHAINS.map(c => (
            <ChainPill key={c} active={chainFilter === c} onClick={() => setChainFilter(c)}>
              <img src={CHAIN_CONFIGS[c].logo} alt="" className="w-4 h-4 rounded-full" />
              {CHAIN_CONFIGS[c].symbol}
            </ChainPill>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-white/10">
          <Tab id="snipers" current={tab} onClick={setTab} count={visibleSnipers.length}>My Snipers</Tab>
          <Tab id="feed" current={tab} onClick={setTab}>New Token Feed</Tab>
          <Tab id="history" current={tab} onClick={setTab} count={executions.length}>History</Tab>
        </div>

        <div className="mt-5">
          {tab === 'snipers' && (
            <SnipersTab
              snipers={visibleSnipers}
              onPause={togglePause}
              onDelete={removeSniper}
              onCreate={() => setShowNewModal(true)}
            />
          )}
          {tab === 'feed' && (
            <FeedTab tokens={feedTokens} loading={feedLoading} onRefresh={loadFeed} chainFilter={chainFilter} />
          )}
          {tab === 'history' && (
            <HistoryTab executions={executions} chainFilter={chainFilter} />
          )}
        </div>
      </div>

      {showNewModal && (
        <NewSniperModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); loadSnipers(); }}
          userId={user.id}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChainPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
        active ? 'bg-blue-500/20 border-2 border-blue-400/50 text-blue-200' : 'bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  );
}

function Tab({ id, current, onClick, count, children }: { id: Tab; current: Tab; onClick: (t: Tab) => void; count?: number; children: React.ReactNode }) {
  const active = id === current;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2.5 text-sm font-semibold relative transition ${active ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
    >
      {children}
      {count != null && (
        <span className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-bold ${active ? 'bg-blue-500/30 text-blue-200' : 'bg-white/10 text-white/60'}`}>
          {count}
        </span>
      )}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t" />}
    </button>
  );
}

function SnipersTab({ snipers, onPause, onDelete, onCreate }: { snipers: SniperCriteriaRow[]; onPause: (s: SniperCriteriaRow) => void; onDelete: (s: SniperCriteriaRow) => void; onCreate: () => void }) {
  if (snipers.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <Crosshair className="w-12 h-12 mx-auto mb-3 text-white/30" />
        <h3 className="text-lg font-bold mb-1">No active snipers yet</h3>
        <p className="text-white/50 text-sm mb-5">Create your first sniper to start auto-executing on new launches, whale moves, or price targets.</p>
        <button onClick={onCreate} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 font-semibold text-sm hover:opacity-90 transition inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Sniper
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {snipers.map(s => <SniperCard key={s.id} s={s} onPause={onPause} onDelete={onDelete} />)}
    </div>
  );
}

function SniperCard({ s, onPause, onDelete }: { s: SniperCriteriaRow; onPause: (s: SniperCriteriaRow) => void; onDelete: (s: SniperCriteriaRow) => void }) {
  const status = !s.enabled ? 'disabled' : s.paused ? 'paused' : 'active';
  const statusColor = status === 'active' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : status === 'paused' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : 'text-white/50 bg-white/5 border-white/10';
  return (
    <div className="rounded-xl border-2 border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-base font-bold truncate">{s.name}</h3>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>{status}</span>
            {s.auto_execute && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/15 text-blue-300">Auto</span>}
            {s.mev_protect && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 bg-purple-500/15 text-purple-300">MEV-Protect</span>}
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            {s.chains_allowed.map(c => {
              const cfg = CHAIN_CONFIGS[c as SniperChain];
              if (!cfg) return null;
              return <img key={c} src={cfg.logo} alt={cfg.symbol} title={cfg.name} className="w-5 h-5 rounded-full" />;
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="Per snipe">${s.amount_per_snipe_usd?.toFixed(0) ?? '—'}</Field>
            <Field label="Daily cap">${s.daily_max_spend_usd?.toFixed(0) ?? '—'} · {s.daily_max_snipes ?? '—'} max</Field>
            <Field label="Slippage">{(s.max_slippage_bps / 100).toFixed(1)}%</Field>
            <Field label="TP / SL">{s.take_profit_pct ? `+${s.take_profit_pct}%` : '—'} / {s.stop_loss_pct ? `-${s.stop_loss_pct}%` : '—'}</Field>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => onPause(s)} title={s.paused ? 'Resume' : 'Pause'} className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition">
            {s.paused ? <Play className="w-4 h-4 text-emerald-300" /> : <Pause className="w-4 h-4 text-amber-300" />}
          </button>
          <button onClick={() => onDelete(s)} title="Delete" className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/20 hover:text-red-300 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-0.5">{label}</div>
      <div className="text-white/90 font-medium">{children}</div>
    </div>
  );
}

function FeedTab({ tokens, loading, onRefresh, chainFilter }: { tokens: DetectedToken[]; loading: boolean; onRefresh: () => void; chainFilter: SniperChain | 'all' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-white/60 font-medium">
          {loading ? 'Scanning…' : `${tokens.length} new pairs detected${chainFilter !== 'all' ? ` on ${CHAIN_CONFIGS[chainFilter].name}` : ''}`}
        </div>
        <button onClick={onRefresh} className="text-xs font-semibold text-blue-300 hover:text-blue-200">↻ Refresh</button>
      </div>
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-400" /></div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center text-white/50 text-sm">No new pairs match the filter right now.</div>
      ) : (
        <div className="grid gap-2">
          {tokens.map(t => <TokenRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

function TokenRow({ t }: { t: DetectedToken }) {
  const statusColor = t.status === 'safe' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : t.status === 'risky' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : 'text-red-300 bg-red-500/15 border-red-500/30';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3 hover:border-white/20 transition">
      {t.logo ? <img src={t.logo} alt="" className="w-10 h-10 rounded-full flex-shrink-0" /> : <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{t.symbol}</span>
          <span className="text-xs text-white/50 truncate">{t.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-white/40">{t.chain}</span>
        </div>
        <div className="text-xs text-white/60 mt-0.5">
          Liq ${(t.liquidity / 1000).toFixed(1)}K · {t.pairAge ?? 'new'} · Score {t.securityScore}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>{t.status}</span>
      <button className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-bold hover:bg-blue-500/30 transition">
        Snipe
      </button>
    </div>
  );
}

function HistoryTab({ executions, chainFilter }: { executions: ExecutionRow[]; chainFilter: SniperChain | 'all' }) {
  const visible = chainFilter === 'all' ? executions : executions.filter(e => e.chain === chainFilter);
  if (visible.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center text-white/50 text-sm">No executions yet on this chain.</div>;
  }
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03]">
          <tr className="text-left text-xs uppercase tracking-wider text-white/50">
            <th className="px-4 py-3 font-semibold">Token</th>
            <th className="px-4 py-3 font-semibold">Chain</th>
            <th className="px-4 py-3 font-semibold">Amount</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">PnL</th>
            <th className="px-4 py-3 font-semibold">Speed</th>
            <th className="px-4 py-3 font-semibold">When</th>
            <th className="px-4 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(e => {
            const cfg = e.chain ? CHAIN_CONFIGS[e.chain as SniperChain] : null;
            const pnl = e.pnl_usd != null ? Number(e.pnl_usd) : null;
            return (
              <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{e.token_symbol ?? '—'}</td>
                <td className="px-4 py-3">{cfg ? <span className="inline-flex items-center gap-1.5"><img src={cfg.logo} alt="" className="w-4 h-4 rounded-full" /> {cfg.symbol}</span> : (e.chain ?? '—')}</td>
                <td className="px-4 py-3 text-white/80">{e.amount_native ?? e.amount_sol ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${e.status === 'confirmed' ? 'text-emerald-300' : e.status === 'failed' ? 'text-red-300' : 'text-amber-300'}`}>
                    {e.status}
                  </span>
                </td>
                <td className={`px-4 py-3 font-bold ${pnl != null && pnl > 0 ? 'text-emerald-300' : pnl != null && pnl < 0 ? 'text-red-300' : 'text-white/60'}`}>
                  {pnl != null ? fmtUSD(pnl) : '—'}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">{e.execution_time_ms ? `${e.execution_time_ms}ms` : '—'}</td>
                <td className="px-4 py-3 text-white/60 text-xs">{timeAgo(e.executed_at)}</td>
                <td className="px-4 py-3">
                  {e.tx_hash && cfg ? (
                    <a href={`${cfg.explorerTxBase}${e.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 text-xs font-medium">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
