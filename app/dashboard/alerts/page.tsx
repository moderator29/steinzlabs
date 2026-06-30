'use client';

// Naka Labs brand icons — Whale aliased to Fish (same semantic).
import {
  Bell, Plus, Trash2, TrendingUp, Activity, X,
  Search, CheckCircle as Check, AlertTriangle,
  Whale as Fish,
} from '@/components/icons/brand';
import { ToggleLeft, ToggleRight, Rocket, History } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useNavState } from '@/lib/nav/useNavState';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

// ── Types (client mirror of the server alert model) ──────────────────────────

type TabType = 'alerts' | 'history';
type CreateTab = 'whale' | 'price' | 'launch' | 'wallet_activity';
type AlertChain = 'solana' | 'ethereum' | 'bsc' | 'base';

interface ServerAlert {
  id: string;
  type: CreateTab;
  name: string;
  active: boolean;
  triggered: boolean;
  triggerCount: number;
  lastTriggered?: number;
  createdAt: string;
  condition: Record<string, unknown>;
}

interface HistoryEntry {
  id: string;
  alertName: string;
  alertType: string;
  message: string;
  triggeredAt: number;
}

interface CoinOption {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;
}

// Payloads POSTed to /api/alerts (discriminated by `type`).
type NewAlertPayload =
  | { type: 'price'; tokenId: string; tokenSymbol: string; direction: 'above' | 'below'; targetPrice: number; label?: string }
  | { type: 'whale'; walletAddress: string; threshold: number; chain: AlertChain; label?: string }
  | { type: 'wallet_activity'; walletAddress: string; chain: AlertChain; label?: string }
  | { type: 'launch'; minLiquidity: number; minHolders: number; chain: 'solana' | 'any'; keywords: string[]; label?: string };

// ── Icon + Color maps ────────────────────────────────────────────────────────

function getAlertIcon(type: string) {
  switch (type) {
    case 'whale': return Fish;
    case 'price': return TrendingUp;
    case 'launch': return Rocket;
    case 'wallet_activity': return Activity;
    default: return AlertTriangle;
  }
}

function getAlertColor(type: string): string {
  switch (type) {
    case 'whale': return '#0066FF';
    case 'price': return '#10B981';
    case 'launch': return '#F59E0B';
    case 'wallet_activity': return '#8B7CFF';
    default: return '#6B7280';
  }
}

function getAlertTypeName(type: string): string {
  switch (type) {
    case 'whale': return 'Whale Tracker';
    case 'price': return 'Price Target';
    case 'launch': return 'New Launch';
    case 'wallet_activity': return 'Wallet Activity';
    default: return type;
  }
}

function alertConditionSummary(alert: ServerAlert): string {
  const c = alert.condition || {};
  const short = (a: unknown) => (typeof a === 'string' ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
  switch (alert.type) {
    case 'whale':
      return `${short(c.walletAddress)} over $${Number(c.threshold || 0).toLocaleString()} on ${String(c.chain || '').toUpperCase()}`;
    case 'price':
      return `${String(c.tokenSymbol || '').toUpperCase()} ${String(c.direction || '')} $${Number(c.targetPrice || 0).toLocaleString()}`;
    case 'launch': {
      const kw = Array.isArray(c.keywords) ? (c.keywords as string[]) : [];
      return `Liq over $${Number(c.minLiquidity || 0).toLocaleString()} · Holders over ${Number(c.minHolders || 0)}${kw.length ? ` · "${kw.join(', ')}"` : ''}`;
    }
    case 'wallet_activity':
      return `${short(c.walletAddress)} any activity on ${String(c.chain || '').toUpperCase()}`;
    default:
      return '';
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1 ms-auto">
      <span className="text-[10px] text-gray-400 me-1">Delete?</span>
      <button onClick={onConfirm} className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Yes</button>
      <button onClick={onCancel} className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded">No</button>
    </div>
  );
}

// ── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert, onToggle, onDelete, busy,
}: {
  alert: ServerAlert;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = getAlertIcon(alert.type);
  const color = getAlertColor(alert.type);

  return (
    <div className={`nl-glass nl-glass--interactive rounded-xl p-4 transition-all ${alert.active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{alert.name}</div>
            <div className="text-[10px] text-gray-500">{getAlertTypeName(alert.type)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ms-2">
          <button onClick={onToggle} disabled={busy} title={alert.active ? 'Pause alert' : 'Resume alert'} className="disabled:opacity-40">
            {alert.active
              ? <ToggleRight className="w-6 h-6 text-[#10B981]" />
              : <ToggleLeft className="w-6 h-6 text-gray-600" />}
          </button>
          {confirmDelete ? (
            <DeleteConfirm onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1 hover:bg-white/10 rounded" disabled={busy}>
              <Trash2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded font-mono truncate flex-1">
          {alertConditionSummary(alert)}
        </div>
        <div className="text-[10px] shrink-0 text-end">
          {alert.triggerCount > 0
            ? <span className="text-[#F59E0B]">{alert.triggerCount} fired</span>
            : <span className="text-gray-600">never fired</span>}
          {alert.lastTriggered && (
            <div className="text-gray-600">{timeAgo(alert.lastTriggered)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chain Selector ───────────────────────────────────────────────────────────

const CHAINS: { value: AlertChain; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'solana', label: 'Solana' },
  { value: 'bsc', label: 'BSC' },
  { value: 'base', label: 'Base' },
];

function ChainSelector({ value, onChange }: { value: AlertChain; onChange: (c: AlertChain) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CHAINS.map(c => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            value === c.value
              ? 'bg-[#0066FF]/20 border-[#0066FF]/40 text-white'
              : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ── Whale Tracker Form ───────────────────────────────────────────────────────

function WhaleTrackerForm({ onSave, saving }: { onSave: (a: NewAlertPayload) => void; saving: boolean }) {
  const [wallet, setWallet] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [chain, setChain] = useState<AlertChain>('ethereum');
  const [name, setName] = useState('');

  useEffect(() => {
    setName(wallet.length > 10 ? `Whale Watch · ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '');
  }, [wallet]);

  const valid = wallet.length > 10 && parseFloat(threshold) > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Wallet Address</label>
        <input
          value={wallet}
          onChange={e => setWallet(e.target.value.trim())}
          placeholder="Enter wallet address to watch"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600 font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Min Transaction Value (USD)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            min="0"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 ps-7 text-sm focus:outline-none focus:border-[#0066FF]/40"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Chain</label>
        <ChainSelector value={chain} onChange={setChain} />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Alert Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Whale Watch · 0x1234…"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600"
        />
      </div>
      <button
        onClick={() => valid && onSave({ type: 'whale', walletAddress: wallet, threshold: parseFloat(threshold), chain, label: name || undefined })}
        disabled={!valid || saving}
        className="nl-btn-neon w-full py-3 rounded-xl font-bold text-sm"
      >
        {saving ? 'Saving…' : 'Save Alert'}
      </button>
    </div>
  );
}

// ── Price Alert Form ─────────────────────────────────────────────────────────

function PriceAlertForm({ onSave, saving }: { onSave: (a: NewAlertPayload) => void; saving: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinOption[]>([]);
  const [selected, setSelected] = useState<CoinOption | null>(null);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCoins = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/market/resolve?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const data = await res.json() as { matches: { id: string | null; symbol: string; name: string; image: string | null }[] };
      setResults((data.matches || []).slice(0, 8)
        .filter((m) => m.id)
        .map((m) => ({ id: m.id as string, symbol: m.symbol, name: m.name, thumb: m.image ?? '' })));
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => searchCoins(query), 400);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [query, searchCoins]);

  const autoName = selected ? `${selected.symbol.toUpperCase()} ${direction} $${targetPrice || '…'}` : '';
  const valid = !!selected && parseFloat(targetPrice) > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Token</label>
        {selected ? (
          <div className="flex items-center justify-between bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              {selected.thumb && <img src={selected.thumb} alt="" className="w-5 h-5 rounded-full" />}
              <span className="text-sm font-semibold">{selected.symbol.toUpperCase()}</span>
              <span className="text-xs text-gray-500">{selected.name}</span>
            </div>
            <button onClick={() => { setSelected(null); setQuery(''); }} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search token by name or symbol…"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 ps-9 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600"
            />
            {results.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {results.map(coin => (
                  <button
                    key={coin.id}
                    onClick={() => { setSelected(coin); setQuery(''); setResults([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.06] text-start transition-colors"
                  >
                    {coin.thumb && <img src={coin.thumb} alt="" className="w-5 h-5 rounded-full" />}
                    <span className="text-xs font-semibold">{coin.symbol.toUpperCase()}</span>
                    <span className="text-xs text-gray-500 truncate">{coin.name}</span>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Direction</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['above', 'below'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                direction === d
                  ? d === 'above'
                    ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                    : 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
              }`}
            >
              Price goes {d === 'above' ? '▲ ABOVE' : '▼ BELOW'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Target Price (USD)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 ps-7 text-sm focus:outline-none focus:border-[#0066FF]/40"
          />
        </div>
      </div>

      {autoName && (
        <div className="nl-glass rounded-lg px-3 py-2 text-xs text-gray-400">
          Alert name: <span className="text-white font-semibold">{autoName}</span>
        </div>
      )}

      <button
        onClick={() => valid && selected && onSave({ type: 'price', tokenId: selected.id, tokenSymbol: selected.symbol, direction, targetPrice: parseFloat(targetPrice), label: autoName || undefined })}
        disabled={!valid || saving}
        className="nl-btn-neon w-full py-3 rounded-xl font-bold text-sm"
      >
        {saving ? 'Saving…' : 'Save Alert'}
      </button>
    </div>
  );
}

// ── Launch Alert Form ────────────────────────────────────────────────────────

function LaunchAlertForm({ onSave, saving }: { onSave: (a: NewAlertPayload) => void; saving: boolean }) {
  const [minLiquidity, setMinLiquidity] = useState('10000');
  const [minHolders, setMinHolders] = useState('10');
  const [chain, setChain] = useState<'solana' | 'any'>('solana');
  const [keywordsRaw, setKeywordsRaw] = useState('');

  const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
  const name = `New launch over $${parseInt(minLiquidity || '0').toLocaleString()} liq${keywords.length ? ` · ${keywords.slice(0, 2).join(', ')}` : ''}`;
  const valid = parseFloat(minLiquidity) >= 0 && parseInt(minHolders) >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Min Liquidity</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
            <input
              type="number"
              value={minLiquidity}
              onChange={e => setMinLiquidity(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 ps-6 text-sm focus:outline-none focus:border-[#0066FF]/40"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Min Holders</label>
          <input
            type="number"
            value={minHolders}
            onChange={e => setMinHolders(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Chain</label>
        <div className="flex gap-2">
          {(['solana', 'any'] as const).map(c => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                chain === c
                  ? 'bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]'
                  : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
              }`}
            >
              {c === 'solana' ? 'Solana (pump.fun)' : 'Any Chain'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Keywords (optional)</label>
        <input
          value={keywordsRaw}
          onChange={e => setKeywordsRaw(e.target.value)}
          placeholder="pepe, dog, cat (comma separated)"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600"
        />
        <p className="text-[10px] text-gray-600 mt-1">Leave blank to alert on all new tokens</p>
      </div>

      <div className="nl-glass rounded-lg px-3 py-2 text-xs text-gray-400 truncate">
        Alert name: <span className="text-white font-semibold">{name}</span>
      </div>

      <button
        onClick={() => valid && onSave({ type: 'launch', minLiquidity: parseFloat(minLiquidity), minHolders: parseInt(minHolders), chain, keywords, label: name })}
        disabled={!valid || saving}
        className="nl-btn-neon w-full py-3 rounded-xl font-bold text-sm"
      >
        {saving ? 'Saving…' : 'Save Alert'}
      </button>
    </div>
  );
}

// ── Wallet Activity Form ─────────────────────────────────────────────────────

function WalletActivityForm({ onSave, saving }: { onSave: (a: NewAlertPayload) => void; saving: boolean }) {
  const [wallet, setWallet] = useState('');
  const [chain, setChain] = useState<AlertChain>('ethereum');
  const [name, setName] = useState('');

  useEffect(() => {
    setName(wallet.length > 10 ? `Activity · ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '');
  }, [wallet]);

  const valid = wallet.length > 10;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Wallet Address</label>
        <input
          value={wallet}
          onChange={e => setWallet(e.target.value.trim())}
          placeholder="Enter wallet address to watch"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600 font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Chain</label>
        <ChainSelector value={chain} onChange={setChain} />
      </div>
      <div className="flex items-center gap-3 bg-[#8B7CFF]/10 border border-[#8B7CFF]/20 rounded-xl px-3 py-2.5">
        <Check className="w-4 h-4 text-[#8B7CFF] shrink-0" />
        <span className="text-xs text-gray-300">Alert on <span className="text-white font-semibold">all activity</span> · any new transaction will trigger</span>
      </div>
      {name && (
        <div className="nl-glass rounded-lg px-3 py-2 text-xs text-gray-400">
          Alert name: <span className="text-white font-semibold">{name}</span>
        </div>
      )}
      <button
        onClick={() => valid && onSave({ type: 'wallet_activity', walletAddress: wallet, chain, label: name || undefined })}
        disabled={!valid || saving}
        className="nl-btn-neon w-full py-3 rounded-xl font-bold text-sm"
      >
        {saving ? 'Saving…' : 'Save Alert'}
      </button>
    </div>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────────────

const CREATE_TABS: { id: CreateTab; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'whale', label: 'Whale Tracker', icon: Fish, color: '#0066FF', desc: 'Track large wallet movements' },
  { id: 'price', label: 'Price Target', icon: TrendingUp, color: '#10B981', desc: 'Alert on price levels' },
  { id: 'launch', label: 'New Launch', icon: Rocket, color: '#F59E0B', desc: 'New token launches' },
  { id: 'wallet_activity', label: 'Wallet Activity', icon: Activity, color: '#8B7CFF', desc: 'Any wallet transaction' },
];

function CreateModal({ onClose, onSave, saving, error }: {
  onClose: () => void;
  onSave: (a: NewAlertPayload) => void;
  saving: boolean;
  error: string | null;
}) {
  const [tab, setTab] = useState<CreateTab>('whale');

  return (
    <div className="fixed inset-0 z-[100] flex items-end" data-overlay>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#0D1117] rounded-t-2xl border-t border-white/[0.06] z-10 max-h-[90vh] overflow-y-auto pb-8">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Create Alert</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tab pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {CREATE_TABS.map(t => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-start transition-all ${
                    tab === t.id
                      ? 'border-white/20 bg-white/[0.08]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.color}20` }}>
                    <TabIcon className="w-3.5 h-3.5" style={{ color: t.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight">{t.label}</div>
                    <div className="text-[10px] text-gray-500 leading-tight">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Forms */}
          {tab === 'whale' && <WhaleTrackerForm onSave={onSave} saving={saving} />}
          {tab === 'price' && <PriceAlertForm onSave={onSave} saving={saving} />}
          {tab === 'launch' && <LaunchAlertForm onSave={onSave} saving={saving} />}
          {tab === 'wallet_activity' && <WalletActivityForm onSave={onSave} saving={saving} />}
        </div>
      </div>
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, loading }: { history: HistoryEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="nl-glass rounded-xl p-8 text-center mt-4">
        <div className="w-6 h-6 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="nl-glass rounded-xl p-8 text-center mt-4 nl-fade-up">
        <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-semibold mb-1">No history yet</p>
        <p className="text-xs text-gray-500">
          Your alert triggers will appear here once they fire. Use the
          <span className="text-slate-200 font-semibold"> Create </span>
          button in the header to set up your first alert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      {history.map(entry => {
        const Icon = getAlertIcon(entry.alertType);
        const color = getAlertColor(entry.alertType);
        return (
          <div key={entry.id} className="nl-glass rounded-xl p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}20` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">{entry.alertName}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">{timeAgo(entry.triggeredAt)}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{entry.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('alerts');

  useNavState(
    'alerts',
    () => ({ activeTab }),
    (s) => { if (typeof s.activeTab === 'string') setActiveTab(s.activeTab as TabType); },
  );

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      if (res.status === 401) { setLoadError('Sign in to manage your alerts.'); setAlerts([]); return; }
      if (!res.ok) { setLoadError('Could not load alerts.'); return; }
      const data = await res.json() as { alerts: ServerAlert[] };
      // This page owns the four smart-alert types; ignore legacy rows created
      // by the older /alerts surface so we never render an unknown type.
      const known: CreateTab[] = ['price', 'whale', 'launch', 'wallet_activity'];
      setAlerts((data.alerts || []).filter(a => known.includes(a.type)));
      setLoadError(null);
    } catch {
      setLoadError('Could not load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/history', { cache: 'no-store' });
      if (!res.ok) { setHistory([]); return; }
      const data = await res.json() as { history: HistoryEntry[] };
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); loadHistory(); }, [loadAlerts, loadHistory]);

  const addAlert = async (payload: NewAlertPayload) => {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setCreateError(err.error || 'Failed to save alert.');
        return;
      }
      const data = await res.json() as { alert: ServerAlert };
      setAlerts(prev => [data.alert, ...prev]);
      setShowCreate(false);
    } catch {
      setCreateError('Failed to save alert.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAlert = async (alert: ServerAlert) => {
    setBusyId(alert.id);
    const next = !alert.active;
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: next } : a));
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, active: next }),
      });
      if (!res.ok) setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: alert.active } : a));
    } catch {
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: alert.active } : a));
    } finally {
      setBusyId(null);
    }
  };

  const deleteAlert = async (id: string) => {
    setBusyId(id);
    const prev = alerts;
    setAlerts(p => p.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) setAlerts(prev);
    } catch {
      setAlerts(prev);
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = alerts.filter(a => a.active).length;
  const pausedCount = alerts.filter(a => !a.active).length;
  const totalFired = alerts.reduce((sum, a) => sum + (a.triggerCount || 0), 0);

  return (
    <AuroraBackground fullHeight className="text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-xl border-b border-white/10" data-overlay>
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Bell className="w-5 h-5 text-[#0066FF]" />
          <h1 className="text-sm font-heading font-bold">Smart Alerts</h1>
          <button
            onClick={() => { setCreateError(null); setShowCreate(true); }}
            className="nl-btn-neon ms-auto px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Create
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/[0.06] px-4">
          {(['alerts', 'history'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors capitalize ${
                activeTab === t
                  ? 'border-[#0066FF] text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'history' ? <History className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <TiltCard className="nl-fade-up">
          <div className="grid grid-cols-3 gap-2">
            <div className="nl-glass rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#0066FF]">{activeCount}</div>
              <div className="text-[10px] text-gray-500">Active</div>
            </div>
            <div className="nl-glass rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-400">{pausedCount}</div>
              <div className="text-[10px] text-gray-500">Paused</div>
            </div>
            <div className="nl-glass rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#F59E0B]">{totalFired}</div>
              <div className="text-[10px] text-gray-500">Triggered</div>
            </div>
          </div>
        </TiltCard>

        {/* Server-evaluated assurance line */}
        <p className="text-[10px] text-gray-500 nl-fade-up nl-fade-up-1">
          Alerts run on Naka servers · they keep watching after you close the tab and sync across your devices.
        </p>

        {/* Alert type legend */}
        {activeTab === 'alerts' && (
          <div className="flex gap-3 flex-wrap nl-fade-up nl-fade-up-1">
            {CREATE_TABS.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.id} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <Icon className="w-3 h-3" style={{ color: t.color }} />
                  {t.label}
                </div>
              );
            })}
          </div>
        )}

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <>
            {loadError && (
              <div className="nl-glass rounded-xl p-4 text-center text-xs text-amber-300">{loadError}</div>
            )}
            {loading ? (
              <div className="nl-glass rounded-xl p-8 text-center">
                <div className="w-6 h-6 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : alerts.length === 0 && !loadError ? (
              <TiltCard className="nl-fade-up nl-fade-up-2">
                <div className="nl-glass rounded-xl p-8 text-center">
                  <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold mb-1">No alerts yet</p>
                  <p className="text-xs text-gray-500 mb-4">Create smart alerts to monitor whale wallets, price targets, new launches, and wallet activity</p>
                  <button
                    onClick={() => { setCreateError(null); setShowCreate(true); }}
                    className="nl-btn-neon px-5 py-2.5 rounded-xl text-xs font-bold"
                  >
                    Create First Alert
                  </button>
                </div>
              </TiltCard>
            ) : (
              <div className="space-y-2 nl-fade-up nl-fade-up-2">
                {alerts.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    busy={busyId === alert.id}
                    onToggle={() => toggleAlert(alert)}
                    onDelete={() => deleteAlert(alert.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {activeTab === 'history' && <HistoryTab history={history} loading={historyLoading} />}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSave={addAlert}
          saving={saving}
          error={createError}
        />
      )}
    </AuroraBackground>
  );
}
