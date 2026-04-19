'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Crosshair, Shield, AlertTriangle, Play, Pause, ExternalLink, CheckCircle, XCircle, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, effectiveTier } from '@/lib/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';

interface SniperConfig {
  maxBudget: number;
  slippage: number;
  minLiquidity: number;
  maxRiskScore: number;
  autoExecute: boolean;
  chains: string[];
}

interface DetectedToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  chain: string;
  age: string;
  liquidity: number;
  securityScore: number;
  riskLevel: 'safe' | 'caution' | 'danger';
  detectedAt: number;
}

interface SniperExecution {
  id: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  amount_usd: number;
  entry_price: number;
  current_price?: number;
  pnl?: number;
  status: 'pending' | 'confirmed' | 'failed';
  tx_hash?: string;
  created_at: string;
}

const DEFAULT_CONFIG: SniperConfig = {
  maxBudget: 100,
  slippage: 1,
  minLiquidity: 50000,
  maxRiskScore: 60,
  autoExecute: false,
  chains: ['ethereum', 'base'],
};

const CHAINS = ['ETH', 'SOL', 'BASE', 'ARB', 'BNB'];

function getRiskColor(level: 'safe' | 'caution' | 'danger') {
  if (level === 'safe') return 'text-green-400 bg-green-400/10 border-green-400/20';
  if (level === 'caution') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
  return 'text-red-400 bg-red-400/10 border-red-400/20';
}

export default function SniperPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userTier = effectiveTier(user);
  const loadingTier = authLoading;
  const [config, setConfig] = useState<SniperConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [detectedTokens, setDetectedTokens] = useState<DetectedToken[]>([]);
  const [executions, setExecutions] = useState<SniperExecution[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [killSwitchStatus, setKillSwitchStatus] = useState<boolean | null>(null);

  useEffect(() => {

    fetch('/api/sniper/config').then(r => r.json()).then(d => {
      if (d.config) setConfig({ ...DEFAULT_CONFIG, ...d.config });
    }).catch(() => {});

    fetch('/api/sniper/executions').then(r => r.json()).then(d => {
      if (d.executions) setExecutions(d.executions);
    }).catch(() => {});

    fetch('/api/sniper/status').then(r => r.json()).then(d => {
      if (typeof d.enabled === 'boolean') setKillSwitchStatus(d.enabled);
    }).catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await fetch('/api/sniper/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
    } catch (err) {
      console.error('[Sniper] Config save failed:', err instanceof Error ? err.message : err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSnipe = async (token: DetectedToken) => {
    setExecuting(token.id);
    try {
      const res = await fetch('/api/sniper/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: token.address,
          chain: token.chain,
          amount: config.maxBudget,
          slippage: config.slippage,
        }),
      });
      const data = await res.json();
      if (data.blocked) {
        alert(`Blocked: ${data.reason}`);
      } else if (data.txHash) {
        setDetectedTokens(prev => prev.filter(t => t.id !== token.id));
        const refetch = await fetch('/api/sniper/executions');
        const d = await refetch.json();
        if (d.executions) setExecutions(d.executions);
      }
    } catch (err) {
      console.error('[Sniper] Execute failed:', err instanceof Error ? err.message : err);
    } finally {
      setExecuting(null);
    }
  };

  if (loadingTier) {
    return <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;
  }

  if (userTier !== 'max') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-6 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-[#F59E0B]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#F59E0B]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Max Plan Required</h2>
          <p className="text-gray-400 mb-6">The Sniper Bot is exclusive to Max plan subscribers. Upgrade to access real-time token detection and automated sniping.</p>
          <button
            onClick={() => router.push('/dashboard/pricing')}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Upgrade to Max - $15/mo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <PageHeader title="Sniper Bot" description="Automated new token detection and trading" />
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${killSwitchStatus === false ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-green-400 bg-green-400/10 border-green-400/20'}`}>
              {killSwitchStatus === false ? 'Kill Switch Active' : 'System Online'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#141824] rounded-xl border border-[#1E2433] p-5">
              <h3 className="text-white font-bold mb-4">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max Budget Per Snipe: ${config.maxBudget}</label>
                  <input type="range" min={10} max={500} value={config.maxBudget}
                    onChange={e => setConfig(p => ({ ...p, maxBudget: Number(e.target.value) }))}
                    className="w-full accent-[#F59E0B]" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-0.5"><span>$10</span><span>$500</span></div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Slippage</label>
                  <div className="flex gap-2">
                    {[0.5, 1, 2, 5].map(s => (
                      <button key={s} onClick={() => setConfig(p => ({ ...p, slippage: s }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${config.slippage === s ? 'bg-[#F59E0B] text-black font-bold' : 'bg-[#0D1117] text-gray-400 border border-[#1E2433]'}`}>
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Min Liquidity</label>
                  <div className="flex gap-2">
                    {[10000, 50000, 100000].map(l => (
                      <button key={l} onClick={() => setConfig(p => ({ ...p, minLiquidity: l }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${config.minLiquidity === l ? 'bg-[#0A1EFF] text-white font-bold' : 'bg-[#0D1117] text-gray-400 border border-[#1E2433]'}`}>
                        {l >= 1000 ? `$${l / 1000}K` : `$${l}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Max Risk Score: {config.maxRiskScore}</label>
                  <input type="range" min={0} max={100} value={config.maxRiskScore}
                    onChange={e => setConfig(p => ({ ...p, maxRiskScore: Number(e.target.value) }))}
                    className="w-full accent-[#0A1EFF]" />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-2">Chains to Monitor</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CHAINS.map(c => {
                      const key = c.toLowerCase();
                      const active = config.chains.includes(key);
                      return (
                        <button key={c} onClick={() => setConfig(p => ({
                          ...p,
                          chains: active ? p.chains.filter(x => x !== key) : [...p.chains, key],
                        }))}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${active ? 'bg-[#0A1EFF] text-white' : 'bg-[#0D1117] text-gray-500 border border-[#1E2433]'}`}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-[#1E2433]">
                  <div>
                    <div className="text-sm text-white">Auto-Execute</div>
                    <div className="text-xs text-gray-500">Buys automatically on safe tokens</div>
                  </div>
                  <button onClick={() => setConfig(p => ({ ...p, autoExecute: !p.autoExecute }))}
                    className={`w-11 h-6 rounded-full transition-colors ${config.autoExecute ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-all mx-1 ${config.autoExecute ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button onClick={handleSaveConfig} disabled={savingConfig}
                  className="w-full py-2.5 bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-colors">
                  {savingConfig ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </div>

            <div className="bg-[#141824] rounded-xl border border-[#1E2433] p-5">
              <h3 className="text-white font-bold mb-3 text-sm">Safety Gates</h3>
              <div className="space-y-2">
                {[
                  { label: 'GoPlus Security Check', active: true },
                  { label: 'Liquidity Threshold', active: config.minLiquidity > 0 },
                  { label: 'Budget Cap', active: config.maxBudget <= 500 },
                  { label: 'Risk Score Filter', active: config.maxRiskScore < 100 },
                  { label: 'Admin Kill Switch', active: killSwitchStatus !== false },
                ].map(gate => (
                  <div key={gate.label} className="flex items-center gap-2">
                    {gate.active
                      ? <CheckCircle size={12} className="text-green-400 shrink-0" />
                      : <XCircle size={12} className="text-red-400 shrink-0" />}
                    <span className={`text-xs ${gate.active ? 'text-gray-300' : 'text-gray-500'}`}>{gate.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#141824] rounded-xl border border-[#1E2433] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Live Token Scanner</h3>
                <button
                  onClick={() => setIsRunning(p => !p)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isRunning ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                  {isRunning ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Start</>}
                </button>
              </div>

              {detectedTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-[#F59E0B]" />
                      <span className="text-sm">Scanning for new token launches...</span>
                    </div>
                  ) : (
                    <span className="text-sm">Start the scanner to detect new token launches in real time.</span>
                  )}
                </div>
              ) : (
                <div className="space-y-3 overflow-x-auto">
                  {detectedTokens.map(token => (
                    <div key={token.id} className="flex items-center gap-3 p-3 bg-[#0D1117] rounded-lg border border-[#1E2433]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{token.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRiskColor(token.riskLevel)}`}>{token.riskLevel}</span>
                        </div>
                        <div className="text-gray-500 text-xs truncate">{token.address}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-400">{token.age}</div>
                        <div className="text-xs text-gray-300">${(token.liquidity / 1000).toFixed(0)}K liq</div>
                      </div>
                      <button
                        onClick={() => handleSnipe(token)}
                        disabled={executing === token.id || token.riskLevel === 'danger'}
                        className="px-3 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-black font-bold text-xs rounded-lg transition-colors shrink-0">
                        {executing === token.id ? <Loader2 size={12} className="animate-spin" /> : 'Snipe'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#141824] rounded-xl border border-[#1E2433] p-5">
              <h3 className="text-white font-bold mb-4">Execution History</h3>
              {executions.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No executions yet. Start the scanner and snipe your first token.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-[#1E2433]">
                        <th className="text-left pb-2 pr-3">Token</th>
                        <th className="text-left pb-2 pr-3">Chain</th>
                        <th className="text-right pb-2 pr-3">Amount</th>
                        <th className="text-right pb-2 pr-3">PnL</th>
                        <th className="text-left pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map(ex => (
                        <tr key={ex.id} className="border-b border-[#1E2433]/50 hover:bg-[#1E2433]/30">
                          <td className="py-2 pr-3 text-white font-semibold">{ex.token_symbol}</td>
                          <td className="py-2 pr-3 text-gray-400 capitalize">{ex.chain}</td>
                          <td className="py-2 pr-3 text-right text-gray-300">${ex.amount_usd}</td>
                          <td className={`py-2 pr-3 text-right font-semibold ${(ex.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {ex.pnl !== undefined ? `${ex.pnl >= 0 ? '+' : ''}$${ex.pnl.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${ex.status === 'confirmed' ? 'bg-green-400/10 text-green-400' : ex.status === 'failed' ? 'bg-red-400/10 text-red-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                                {ex.status}
                              </span>
                              {ex.tx_hash && (
                                <a href={`https://etherscan.io/tx/${ex.tx_hash}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink size={10} className="text-gray-500 hover:text-white" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
