'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Crosshair, Zap, Shield, AlertTriangle, TrendingUp, TrendingDown,
  Settings, Play, Pause, ToggleLeft, ToggleRight, Clock, DollarSign, Target,
  Activity, RefreshCw, CheckCircle, XCircle, Loader2, ChevronRight, Filter,
  Wallet, Globe, Lock
} from 'lucide-react';

interface SniperConfig {
  maxBuyAmount: string;
  slippage: string;
  gasMultiplier: string;
  minLiquidity: string;
  maxTax: string;
  antiHoneypot: boolean;
  antiMEV: boolean;
  autoSell: boolean;
  autoSellMultiplier: string;
  stopLoss: string;
  chains: string[];
}

interface DetectedToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  chain: string;
  liquidity: number;
  tax: number;
  honeypot: boolean;
  securityScore: number;
  detectedAt: number;
  status: 'scanning' | 'safe' | 'risky' | 'blocked' | 'sniped';
  price?: number;
  marketCap?: number;
  pairAge?: string;
}

interface SniperTrade {
  id: string;
  symbol: string;
  address: string;
  chain: string;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  amount: number;
  timestamp: number;
  status: 'open' | 'closed';
}

const CHAINS = [
  { id: 'ethereum', label: 'ETH', color: '#627EEA' },
  { id: 'solana', label: 'SOL', color: '#9945FF' },
  { id: 'bsc', label: 'BSC', color: '#F3BA2F' },
  { id: 'base', label: 'BASE', color: '#0052FF' },
];

function formatCompact(n: number): string {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SecurityBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
  const label = score >= 70 ? 'SAFE' : score >= 40 ? 'CAUTION' : 'RISKY';
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color, background: `${color}18` }}>
      {label}
    </span>
  );
}

const DEMO_TOKENS: DetectedToken[] = [
  {
    id: '1', address: '0xf28c...3fa1', symbol: 'PEPE2', name: 'Pepe 2.0',
    chain: 'ethereum', liquidity: 125000, tax: 5, honeypot: false,
    securityScore: 72, detectedAt: Date.now() - 45000, status: 'safe',
    price: 0.000042, marketCap: 420000, pairAge: '2m'
  },
  {
    id: '2', address: '8xKm...9P2q', symbol: 'MOONDOG', name: 'Moon Dog',
    chain: 'solana', liquidity: 89000, tax: 3, honeypot: false,
    securityScore: 65, detectedAt: Date.now() - 120000, status: 'risky',
    price: 0.0012, marketCap: 280000, pairAge: '8m'
  },
  {
    id: '3', address: '0xa3b7...c2d4', symbol: 'RUGPULL', name: 'SafeMoon Clone',
    chain: 'bsc', liquidity: 12000, tax: 25, honeypot: true,
    securityScore: 8, detectedAt: Date.now() - 30000, status: 'blocked',
    price: 0.000001, marketCap: 15000, pairAge: '1m'
  },
  {
    id: '4', address: '0x5e9c...7f1b', symbol: 'GIGA', name: 'Gigachad Token',
    chain: 'base', liquidity: 340000, tax: 2, honeypot: false,
    securityScore: 88, detectedAt: Date.now() - 8000, status: 'scanning',
    price: 0.0089, marketCap: 1200000, pairAge: '30s'
  },
];

const DEFAULT_CONFIG: SniperConfig = {
  maxBuyAmount: '0.1',
  slippage: '15',
  gasMultiplier: '1.5',
  minLiquidity: '50000',
  maxTax: '10',
  antiHoneypot: true,
  antiMEV: true,
  autoSell: false,
  autoSellMultiplier: '2',
  stopLoss: '30',
  chains: ['ethereum', 'solana'],
};

export default function SniperPage() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [config, setConfig] = useState<SniperConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<DetectedToken[]>(DEMO_TOKENS);
  const [trades] = useState<SniperTrade[]>([]);
  const [tab, setTab] = useState<'live' | 'trades' | 'settings'>('live');
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate scanning animation
  useEffect(() => {
    if (active) {
      setScanning(true);
      scanRef.current = setInterval(() => {
        setTokens(prev => {
          // Occasionally update scanning tokens to safe/risky
          return prev.map(t => {
            if (t.status === 'scanning' && Math.random() > 0.6) {
              return { ...t, status: t.securityScore >= 60 ? 'safe' : 'risky' };
            }
            return t;
          });
        });
      }, 2000);
    } else {
      setScanning(false);
      if (scanRef.current) clearInterval(scanRef.current);
    }
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, [active]);

  const toggleChain = (chainId: string) => {
    setConfig(prev => ({
      ...prev,
      chains: prev.chains.includes(chainId)
        ? prev.chains.filter(c => c !== chainId)
        : [...prev.chains, chainId],
    }));
  };

  const safeCount = tokens.filter(t => t.status === 'safe').length;
  const blockedCount = tokens.filter(t => t.status === 'blocked').length;

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060A12]/95 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Crosshair className="w-4 h-4 text-[#0A1EFF]" />
          <span className="font-heading font-bold text-sm">Sniper Bot</span>
          <span className="px-1.5 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[9px] font-bold rounded">BETA</span>
        </div>
        <button
          onClick={() => setActive(!active)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            active
              ? 'bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444]'
              : 'bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 text-[#0A1EFF]'
          }`}
        >
          {active ? <><Pause className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Start</>}
        </button>
      </div>

      <div className="px-4 pt-4">
        {/* Status Banner */}
        <div className={`rounded-xl border p-3 mb-4 flex items-center gap-3 transition-all ${
          active
            ? 'bg-[#10B981]/05 border-[#10B981]/20'
            : 'bg-white/[0.02] border-white/[0.06]'
        }`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-[#10B981] animate-pulse' : 'bg-gray-600'}`} />
          <div className="flex-1">
            <div className="text-xs font-semibold">{active ? 'Sniper Active' : 'Sniper Offline'}</div>
            <div className="text-[10px] text-gray-500">
              {active
                ? `Scanning ${config.chains.length} chains for new token listings...`
                : 'Start the sniper to detect and analyze new listings in real-time'}
            </div>
          </div>
          {active && scanning && <Loader2 className="w-3.5 h-3.5 text-[#10B981] animate-spin flex-shrink-0" />}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Detected', value: tokens.length, color: 'text-white' },
            { label: 'Safe', value: safeCount, color: 'text-[#10B981]' },
            { label: 'Blocked', value: blockedCount, color: 'text-[#EF4444]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass rounded-xl border border-white/[0.07] p-3 text-center">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 mb-4 border border-white/[0.06]">
          {(['live', 'trades', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                tab === t ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'live' ? 'Live Feed' : t === 'trades' ? 'My Trades' : 'Settings'}
            </button>
          ))}
        </div>

        {/* Live Feed Tab */}
        {tab === 'live' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">New Listings</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-600">
                <Activity className="w-3 h-3" />
                {active ? 'Live' : 'Paused'}
              </div>
            </div>
            {tokens.length === 0 ? (
              <div className="text-center py-12 text-gray-600 text-sm">
                {active ? 'Waiting for new listings...' : 'Start the sniper to detect tokens'}
              </div>
            ) : (
              tokens.map(token => (
                <div key={token.id} className="glass rounded-xl border border-white/[0.07] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center border border-white/10">
                        <span className="text-[8px] font-bold text-[#0A1EFF]">{token.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{token.symbol}</span>
                          <SecurityBadge score={token.securityScore} />
                        </div>
                        <div className="text-[10px] text-gray-500">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[11px] font-semibold capitalize ${
                        token.status === 'safe' ? 'text-[#10B981]' :
                        token.status === 'blocked' ? 'text-[#EF4444]' :
                        token.status === 'scanning' ? 'text-[#F59E0B]' :
                        'text-gray-400'
                      }`}>
                        {token.status === 'scanning' ? (
                          <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Scanning</span>
                        ) : token.status === 'safe' ? (
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Safe</span>
                        ) : token.status === 'blocked' ? (
                          <span className="flex items-center gap-1"><XCircle className="w-3 h-3" />Blocked</span>
                        ) : 'Risky'}
                      </div>
                      <div className="text-[10px] text-gray-600">{timeAgo(token.detectedAt)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Liq', value: formatCompact(token.liquidity) },
                      { label: 'Tax', value: `${token.tax}%`, alert: token.tax > 10 },
                      { label: 'MCap', value: formatCompact(token.marketCap || 0) },
                      { label: 'Age', value: token.pairAge || 'N/A' },
                    ].map(({ label, value, alert }) => (
                      <div key={label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center border border-white/[0.05]">
                        <div className="text-[9px] text-gray-600">{label}</div>
                        <div className={`text-[11px] font-semibold ${alert ? 'text-[#EF4444]' : 'text-white'}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {token.honeypot && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#EF4444] bg-[#EF4444]/05 rounded-lg px-2 py-1.5 border border-[#EF4444]/15">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      Honeypot detected. Buy blocked.
                    </div>
                  )}

                  {token.status === 'safe' && active && (
                    <button className="w-full py-2 bg-[#0A1EFF]/20 border border-[#0A1EFF]/30 rounded-lg text-[11px] font-bold text-[#0A1EFF] hover:bg-[#0A1EFF]/30 transition-colors flex items-center justify-center gap-1.5">
                      <Zap className="w-3 h-3" /> Snipe {config.maxBuyAmount} ETH
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Trades Tab */}
        {tab === 'trades' && (
          <div>
            {trades.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Target className="w-7 h-7 text-gray-600" />
                </div>
                <p className="text-sm font-semibold text-gray-400 mb-1">No trades yet</p>
                <p className="text-xs text-gray-600">Start the sniper to capture opportunities</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trades.map(trade => (
                  <div key={trade.id} className="glass rounded-xl border border-white/[0.07] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{trade.symbol}</span>
                      <span className={`text-sm font-bold ${trade.pnlPercent >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-4">
            {/* Chain Selection */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Chains</p>
              <div className="flex gap-2 flex-wrap">
                {CHAINS.map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => toggleChain(chain.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                      config.chains.includes(chain.id)
                        ? 'text-white border-white/20'
                        : 'text-gray-500 border-white/[0.07] hover:border-white/15'
                    }`}
                    style={config.chains.includes(chain.id) ? { backgroundColor: `${chain.color}20`, borderColor: `${chain.color}40`, color: chain.color } : {}}
                  >
                    {chain.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Config Fields */}
            <div className="glass rounded-xl border border-white/[0.07] overflow-hidden">
              {[
                { key: 'maxBuyAmount', label: 'Max Buy Amount', suffix: 'ETH' },
                { key: 'slippage', label: 'Slippage', suffix: '%' },
                { key: 'gasMultiplier', label: 'Gas Multiplier', suffix: 'x' },
                { key: 'minLiquidity', label: 'Min Liquidity', suffix: 'USD' },
                { key: 'maxTax', label: 'Max Tax', suffix: '%' },
              ].map(({ key, label, suffix }, i, arr) => (
                <div key={key} className={`flex items-center justify-between px-3.5 py-3 ${i < arr.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-[10px] text-gray-500">{suffix} unit</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={(config as any)[key]}
                      onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-20 bg-[#060A12] border border-white/10 rounded-lg px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-[#0A1EFF]/30"
                    />
                    <span className="text-[10px] text-gray-500">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className="glass rounded-xl border border-white/[0.07] overflow-hidden">
              {[
                { key: 'antiHoneypot', label: 'Anti-Honeypot', desc: 'Block honeypot contracts automatically', icon: Shield },
                { key: 'antiMEV', label: 'MEV Protection', desc: 'Protect against sandwich attacks', icon: Lock },
                { key: 'autoSell', label: 'Auto Sell', desc: `Take profit at ${config.autoSellMultiplier}x`, icon: TrendingUp },
              ].map(({ key, label, desc, icon: Icon }, i, arr) => (
                <div key={key} className={`flex items-center justify-between px-3.5 py-3 ${i < arr.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#0A1EFF]" />
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-[10px] text-gray-500">{desc}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                    className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${(config as any)[key] ? 'bg-[#0A1EFF]' : 'bg-gray-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${(config as any)[key] ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/05 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#F59E0B] leading-relaxed">
                  Sniper Bot executes automated trades. All tokens are scanned by our security engine before execution. Only tokens passing honeypot, tax, and liquidity checks are sniped.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
