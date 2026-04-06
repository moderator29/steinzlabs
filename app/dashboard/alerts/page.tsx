'use client';

import {
  Bell, ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight,
  Fish, TrendingUp, Rocket, Activity, X,
  History, Search, Check, AlertTriangle, Play,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadSmartAlerts, saveSmartAlerts, loadAlertHistory,
  addAlertHistory, useAlertMonitor,
  type SmartAlert, type WhaleAlert, type PriceAlert,
  type NewLaunchAlert, type WalletActivityAlert, type AlertChain,
} from '@/lib/hooks/useAlertMonitor';
import { addLocalNotification } from '@/lib/notifications';

// ── Types ────────────────────────────────────────────────────────────────────

type TabType = 'alerts' | 'history';
type CreateTab = 'whale' | 'price' | 'launch' | 'wallet_activity';

interface CoinOption {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;
}

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
    case 'whale': return '#0A1EFF';
    case 'price': return '#10B981';
    case 'launch': return '#F59E0B';
    case 'wallet_activity': return '#8B5CF6';
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

function alertConditionSummary(alert: SmartAlert): string {
  switch (alert.type) {
    case 'whale':
      return `${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)} >= $${alert.threshold.toLocaleString()} on ${alert.chain.toUpperCase()}`;
    case 'price':
      return `${alert.tokenSymbol.toUpperCase()} ${alert.direction} $${alert.targetPrice.toLocaleString()}`;
    case 'launch':
      return `Liq >= $${alert.minLiquidity.toLocaleString()} · Holders >= ${alert.minHolders}${alert.keywords.length ? ` · "${alert.keywords.join(', ')}"` : ''}`;
    case 'wallet_activity':
      return `${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)} any activity on ${alert.chain.toUpperCase()}`;
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

function genId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1 ml-auto">
      <span className="text-[10px] text-gray-400 mr-1">Delete?</span>
      <button onClick={onConfirm} className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Yes</button>
      <button onClick={onCancel} className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded">No</button>
    </div>
  );
}

// ── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onToggle,
  onDelete,
  onTest,
}: {
  alert: SmartAlert;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = getAlertIcon(alert.type);
  const color = getAlertColor(alert.type);

  return (
    <div className={`glass rounded-xl p-4 border transition-all ${alert.active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
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
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={onTest}
            title="Test alert"
            className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-yellow-400 transition-colors"
          >
            <Play className="w-3 h-3" />
          </button>
          <button onClick={onToggle}>
            {alert.active
              ? <ToggleRight className="w-6 h-6 text-[#10B981]" />
              : <ToggleLeft className="w-6 h-6 text-gray-600" />}
          </button>
          {confirmDelete ? (
            <DeleteConfirm onConfirm={onDelete} onCancel={() => setConfirmDelete(false)} />
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1 hover:bg-white/10 rounded">
              <Trash2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded font-mono truncate flex-1">
          {alertConditionSummary(alert)}
        </div>
        <div className="text-[10px] shrink-0 text-right">
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
              ? 'bg-[#0A1EFF]/20 border-[#0A1EFF]/40 text-white'
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

function WhaleTrackerForm({ onSave }: { onSave: (alert: SmartAlert) => void }) {
  const [wallet, setWallet] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [chain, setChain] = useState<AlertChain>('ethereum');
  const [name, setName] = useState('');

  useEffect(() => {
    if (wallet.length > 10) {
      setName(`Whale Watch: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
    } else {
      setName('');
    }
  }, [wallet]);

  const valid = wallet.length > 10 && parseFloat(threshold) > 0;

  const save = () => {
    if (!valid) return;
    const alert: WhaleAlert = {
      id: genId(),
      type: 'whale',
      name: name || `Whale Watch: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
      walletAddress: wallet,
      threshold: parseFloat(threshold),
      chain,
      active: true,
      lastChecked: 0,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
    onSave(alert);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Wallet Address</label>
        <input
          value={wallet}
          onChange={e => setWallet(e.target.value.trim())}
          placeholder="Enter wallet address to watch"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 placeholder-gray-600 font-mono"
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
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 pl-7 text-sm focus:outline-none focus:border-[#0A1EFF]/40"
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
          placeholder="Whale Watch: 0x1234..."
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 placeholder-gray-600"
        />
      </div>
      <button
        onClick={save}
        disabled={!valid}
        className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-3 rounded-xl font-bold text-sm disabled:opacity-40"
      >
        Save Alert
      </button>
    </div>
  );
}

// ── Price Alert Form ─────────────────────────────────────────────────────────

function PriceAlertForm({ onSave }: { onSave: (alert: SmartAlert) => void }) {
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
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults((data.coins || []).slice(0, 8).map((c: { id: string; symbol: string; name: string; thumb?: string }) => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        thumb: c.thumb,
      })));
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

  const autoName = selected
    ? `${selected.symbol.toUpperCase()} ${direction} $${targetPrice || '...'}`
    : '';

  const valid = selected && parseFloat(targetPrice) > 0;

  const save = () => {
    if (!valid || !selected) return;
    const alert: PriceAlert = {
      id: genId(),
      type: 'price',
      name: autoName || `${selected.symbol.toUpperCase()} price alert`,
      tokenId: selected.id,
      tokenSymbol: selected.symbol,
      direction,
      targetPrice: parseFloat(targetPrice),
      active: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
    onSave(alert);
  };

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
              placeholder="Search token by name or symbol..."
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 pl-9 text-sm focus:outline-none focus:border-[#0A1EFF]/40 placeholder-gray-600"
            />
            {results.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                {results.map(coin => (
                  <button
                    key={coin.id}
                    onClick={() => { setSelected(coin); setQuery(''); setResults([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.06] text-left transition-colors"
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
        <div className="grid grid-cols-2 gap-2">
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
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 pl-7 text-sm focus:outline-none focus:border-[#0A1EFF]/40"
          />
        </div>
      </div>

      {autoName && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-gray-400">
          Alert name: <span className="text-white font-semibold">{autoName}</span>
        </div>
      )}

      <button
        onClick={save}
        disabled={!valid}
        className="w-full bg-gradient-to-r from-[#10B981] to-[#0A1EFF] py-3 rounded-xl font-bold text-sm disabled:opacity-40"
      >
        Save Alert
      </button>
    </div>
  );
}

// ── Launch Alert Form ────────────────────────────────────────────────────────

function LaunchAlertForm({ onSave }: { onSave: (alert: SmartAlert) => void }) {
  const [minLiquidity, setMinLiquidity] = useState('10000');
  const [minHolders, setMinHolders] = useState('10');
  const [chain, setChain] = useState<'solana' | 'any'>('solana');
  const [keywordsRaw, setKeywordsRaw] = useState('');

  const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
  const name = `New launch > $${parseInt(minLiquidity || '0').toLocaleString()} liq${keywords.length ? ` · ${keywords.slice(0, 2).join(', ')}` : ''}`;

  const valid = parseFloat(minLiquidity) >= 0 && parseInt(minHolders) >= 0;

  const save = () => {
    if (!valid) return;
    const alert: NewLaunchAlert = {
      id: genId(),
      type: 'launch',
      name,
      minLiquidity: parseFloat(minLiquidity),
      minHolders: parseInt(minHolders),
      chain,
      keywords,
      active: true,
      lastChecked: 0,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
    onSave(alert);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Min Liquidity</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
            <input
              type="number"
              value={minLiquidity}
              onChange={e => setMinLiquidity(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 pl-6 text-sm focus:outline-none focus:border-[#0A1EFF]/40"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Min Holders</label>
          <input
            type="number"
            value={minHolders}
            onChange={e => setMinHolders(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40"
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
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 placeholder-gray-600"
        />
        <p className="text-[10px] text-gray-600 mt-1">Leave blank to alert on all new tokens</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-gray-400 truncate">
        Alert name: <span className="text-white font-semibold">{name}</span>
      </div>

      <button
        onClick={save}
        disabled={!valid}
        className="w-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] py-3 rounded-xl font-bold text-sm disabled:opacity-40"
      >
        Save Alert
      </button>
    </div>
  );
}

// ── Wallet Activity Form ─────────────────────────────────────────────────────

function WalletActivityForm({ onSave }: { onSave: (alert: SmartAlert) => void }) {
  const [wallet, setWallet] = useState('');
  const [chain, setChain] = useState<AlertChain>('ethereum');
  const [name, setName] = useState('');

  useEffect(() => {
    if (wallet.length > 10) {
      setName(`Activity: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
    } else {
      setName('');
    }
  }, [wallet]);

  const valid = wallet.length > 10;

  const save = () => {
    if (!valid) return;
    const alert: WalletActivityAlert = {
      id: genId(),
      type: 'wallet_activity',
      name: name || `Activity: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
      walletAddress: wallet,
      chain,
      active: true,
      lastChecked: 0,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
    onSave(alert);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Wallet Address</label>
        <input
          value={wallet}
          onChange={e => setWallet(e.target.value.trim())}
          placeholder="Enter wallet address to watch"
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40 placeholder-gray-600 font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1.5">Chain</label>
        <ChainSelector value={chain} onChange={setChain} />
      </div>
      <div className="flex items-center gap-3 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-xl px-3 py-2.5">
        <Check className="w-4 h-4 text-[#8B5CF6] shrink-0" />
        <span className="text-xs text-gray-300">Alert on <span className="text-white font-semibold">all activity</span> — any new transaction will trigger</span>
      </div>
      {name && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-gray-400">
          Alert name: <span className="text-white font-semibold">{name}</span>
        </div>
      )}
      <button
        onClick={save}
        disabled={!valid}
        className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#0A1EFF] py-3 rounded-xl font-bold text-sm disabled:opacity-40"
      >
        Save Alert
      </button>
    </div>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────────────

const CREATE_TABS: { id: CreateTab; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'whale', label: 'Whale Tracker', icon: Fish, color: '#0A1EFF', desc: 'Track large wallet movements' },
  { id: 'price', label: 'Price Target', icon: TrendingUp, color: '#10B981', desc: 'Alert on price levels' },
  { id: 'launch', label: 'New Launch', icon: Rocket, color: '#F59E0B', desc: 'New token launches' },
  { id: 'wallet_activity', label: 'Wallet Activity', icon: Activity, color: '#8B5CF6', desc: 'Any wallet transaction' },
];

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (alert: SmartAlert) => void }) {
  const [tab, setTab] = useState<CreateTab>('whale');

  const handleSave = (alert: SmartAlert) => {
    onSave(alert);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end">
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
          <div className="grid grid-cols-2 gap-2 mb-5">
            {CREATE_TABS.map(t => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
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

          {/* Forms */}
          {tab === 'whale' && <WhaleTrackerForm onSave={handleSave} />}
          {tab === 'price' && <PriceAlertForm onSave={handleSave} />}
          {tab === 'launch' && <LaunchAlertForm onSave={handleSave} />}
          {tab === 'wallet_activity' && <WalletActivityForm onSave={handleSave} />}
        </div>
      </div>
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [history, setHistory] = useState(() => loadAlertHistory());

  useEffect(() => {
    const handler = () => setHistory(loadAlertHistory());
    window.addEventListener('steinz_alert_triggered', handler);
    return () => window.removeEventListener('steinz_alert_triggered', handler);
  }, []);

  if (history.length === 0) {
    return (
      <div className="glass rounded-xl p-8 border border-white/10 text-center mt-4">
        <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-semibold mb-1">No history yet</p>
        <p className="text-xs text-gray-500">Your alert triggers will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      {history.map(entry => {
        const Icon = getAlertIcon(entry.alertType);
        const color = getAlertColor(entry.alertType);
        return (
          <div key={entry.id} className="glass rounded-xl p-3.5 border border-white/[0.08]">
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
  const router = useRouter();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('alerts');

  // Start polling all alert conditions (price, whale, wallet activity, launches)
  useAlertMonitor();

  useEffect(() => {
    setAlerts(loadSmartAlerts());
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) saveSmartAlerts(alerts);
  }, [alerts, initialized]);

  // Refresh alert list when a trigger fires (updates triggerCount/lastTriggered)
  useEffect(() => {
    const handler = () => setAlerts(loadSmartAlerts());
    window.addEventListener('steinz_alert_triggered', handler);
    return () => window.removeEventListener('steinz_alert_triggered', handler);
  }, []);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const addAlert = (alert: SmartAlert) => {
    setAlerts(prev => [...prev, alert]);
  };

  const testAlert = (alert: SmartAlert) => {
    const msg = `Test: ${alertConditionSummary(alert)}`;
    addLocalNotification({ type: 'alert', title: `[TEST] ${alert.name}`, message: msg });
    addAlertHistory({
      alertId: alert.id,
      alertName: alert.name,
      alertType: alert.type,
      message: `[TEST] ${msg}`,
      triggeredAt: Date.now(),
    });
    window.dispatchEvent(new CustomEvent('steinz_alert_triggered'));
  };

  const activeCount = alerts.filter(a => a.active).length;
  const pausedCount = alerts.filter(a => !a.active).length;
  const totalFired = alerts.reduce((sum, a) => sum + (a.triggerCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Bell className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Smart Alerts</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
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
                  ? 'border-[#0A1EFF] text-white'
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
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#0A1EFF]">{activeCount}</div>
            <div className="text-[10px] text-gray-500">Active</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-gray-400">{pausedCount}</div>
            <div className="text-[10px] text-gray-500">Paused</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#F59E0B]">{totalFired}</div>
            <div className="text-[10px] text-gray-500">Triggered</div>
          </div>
        </div>

        {/* Alert type legend */}
        {activeTab === 'alerts' && (
          <div className="flex gap-3 flex-wrap">
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
            {alerts.length === 0 ? (
              <div className="glass rounded-xl p-8 border border-white/10 text-center">
                <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">No alerts yet</p>
                <p className="text-xs text-gray-500 mb-4">Create smart alerts to monitor whale wallets, price targets, new launches, and wallet activity</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  Create First Alert
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onToggle={() => toggleAlert(alert.id)}
                    onDelete={() => deleteAlert(alert.id)}
                    onTest={() => testAlert(alert)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* History tab */}
        {activeTab === 'history' && <HistoryTab />}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSave={addAlert} />
      )}
    </div>
  );
}
