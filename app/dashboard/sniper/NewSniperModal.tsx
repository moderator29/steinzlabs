'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { X, Loader2, Zap, Shield, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CHAIN_CONFIGS, SNIPER_CHAINS, type SniperChain } from '@/lib/sniper/chains';

// §11 — lazy-loaded so the chart bundle only ships when the user
// actually opens the modal AND enters a token address.
const AdvancedChart = dynamic(
  () => import('@/components/trading/AdvancedChart').then(m => m.AdvancedChart),
  { ssr: false, loading: () => <div className="h-[180px] rounded-lg border border-white/10 flex items-center justify-center text-[11px] text-white/50">Loading chart…</div> },
);

// Detect EVM (0x-prefixed, 42 chars) vs Solana (base58, 32-44 chars,
// no 0x prefix). Same pattern used in app/dashboard/swap/page.tsx so
// resolution stays consistent across the platform.
function detectChainFromAddress(addr: string, fallback: SniperChain): string {
  const t = addr.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return fallback === 'solana' ? 'ethereum' : fallback;
  if (t.length >= 32 && t.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t)) return 'solana';
  return fallback;
}

function isPlausibleAddress(addr: string): boolean {
  const t = addr.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(t) || (t.length >= 32 && t.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t));
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

type Trigger = 'new_pair' | 'whale_buy' | 'price_target' | 'manual';

export function NewSniperModal({ onClose, onSaved, userId }: Props) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<Trigger>('new_pair');
  const [chains, setChains] = useState<SniperChain[]>(['solana']);
  const [tokenAddress, setTokenAddress] = useState('');
  const [whaleAddress, setWhaleAddress] = useState('');
  const [priceTarget, setPriceTarget] = useState('');
  const [amountUsd, setAmountUsd] = useState(50);
  const [slippagePct, setSlippagePct] = useState(5);
  const [priorityFee, setPriorityFee] = useState<number | null>(null);
  const [mevProtect, setMevProtect] = useState(true);

  const [tp, setTp] = useState<number | ''>('');
  const [sl, setSl] = useState<number | ''>('');
  const [trailingStop, setTrailingStop] = useState<number | ''>('');
  const [autoSellOnTarget, setAutoSellOnTarget] = useState(false);

  const [minLiqUsd, setMinLiqUsd] = useState(50000);
  const [maxBuyTaxPct, setMaxBuyTaxPct] = useState(10);
  const [maxSellTaxPct, setMaxSellTaxPct] = useState(10);
  const [minHolders, setMinHolders] = useState(50);
  const [minSecurityScore, setMinSecurityScore] = useState(60);
  const [blockHoneypots, setBlockHoneypots] = useState(true);

  const [dailyMaxSnipes, setDailyMaxSnipes] = useState(10);
  const [dailyMaxSpend, setDailyMaxSpend] = useState(500);
  const [autoExecute, setAutoExecute] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | ''>(168);
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userWallets, setUserWallets] = useState<{ address: string; chain?: string; label?: string }[]>([]);

  // §11 audit fix: debounce tokenAddress before passing to AdvancedChart so
  // we don't fire an OHLCV request on every keystroke (40 chars typed at
  // 50ms cadence = ~30 wasted /api/market/ohlcv calls). 400ms feels live
  // for paste, slow enough to skip mid-type churn.
  const [debouncedTokenAddress, setDebouncedTokenAddress] = useState(tokenAddress);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTokenAddress(tokenAddress), 400);
    return () => clearTimeout(t);
  }, [tokenAddress]);

  // Pull user's wallets so the multi-wallet picker isn't a free-text field
  // (typing the wrong address into a sniper config that auto-executes is
  // exactly the kind of footgun we don't want.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_wallets_v2')
        .select('wallets')
        .eq('user_id', userId)
        .maybeSingle();
      const ws = (data?.wallets as { address: string; chain?: string; label?: string }[] | null) ?? [];
      if (!cancelled) setUserWallets(ws);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Default priority fee from selected chain
  const primaryChainCfg = chains[0] ? CHAIN_CONFIGS[chains[0]] : null;
  useEffect(() => {
    if (primaryChainCfg && priorityFee == null) {
      setPriorityFee(primaryChainCfg.defaultPriorityFee);
    }
  }, [primaryChainCfg, priorityFee]);

  const toggleChain = (c: SniperChain) => {
    setChains(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const toggleWallet = (addr: string) => {
    setWalletAddresses(prev => prev.includes(addr) ? prev.filter(x => x !== addr) : [...prev, addr]);
  };

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (chains.length === 0) return false;
    if (amountUsd <= 0) return false;
    if (trigger === 'whale_buy' && !whaleAddress.trim()) return false;
    if (trigger === 'price_target' && !priceTarget) return false;
    return true;
  }, [name, chains, amountUsd, trigger, whaleAddress, priceTarget]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        user_id: userId,
        name: name.trim(),
        enabled: true,
        paused: false,
        trigger_type: trigger,
        chains_allowed: chains,
        min_liquidity_usd: minLiqUsd || null,
        max_buy_tax_bps: Math.round(maxBuyTaxPct * 100),
        max_sell_tax_bps: Math.round(maxSellTaxPct * 100),
        min_holder_count: minHolders || null,
        min_security_score: minSecurityScore || null,
        block_honeypots: blockHoneypots,
        trigger_whale_address: trigger === 'whale_buy' ? whaleAddress.trim().toLowerCase() : null,
        trigger_price_target: trigger === 'price_target' ? Number(priceTarget) : null,
        amount_per_snipe_usd: amountUsd,
        max_slippage_bps: Math.round(slippagePct * 100),
        priority_fee_native: priorityFee,
        mev_protect: mevProtect,
        daily_max_snipes: dailyMaxSnipes,
        daily_max_spend_usd: dailyMaxSpend,
        auto_execute: autoExecute,
        take_profit_pct: tp === '' ? null : Number(tp),
        stop_loss_pct: sl === '' ? null : Number(sl),
        trailing_stop_pct: trailingStop === '' ? null : Number(trailingStop),
        auto_sell_on_target: autoSellOnTarget,
        wallet_source: walletAddresses.length > 0 ? 'selected' : 'primary',
        wallet_addresses: walletAddresses,
        expiry_hours: expiryHours === '' ? null : Number(expiryHours),
      };

      const { error: insErr } = await supabase.from('sniper_criteria').insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-white/10 bg-[#0a0d18] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#0a0d18] z-10">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-blue-400" /> New Sniper</h2>
            <p className="text-xs text-white/50 mt-0.5">Configure a rule that triggers a buy when conditions match.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name */}
          <Field label="Sniper Name" required>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. SOL pump.fun memecoin sniper"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none transition"
            />
          </Field>

          {/* Chains */}
          <Field label="Chains" required hint="Pick one or more. The first chain's defaults populate priority fee.">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SNIPER_CHAINS.map(c => {
                const cfg = CHAIN_CONFIGS[c];
                const active = chains.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleChain(c)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                      active ? 'border-blue-400/60 bg-blue-500/15 text-blue-100' : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20'
                    }`}
                  >
                    <img src={cfg.logo} alt="" className="w-5 h-5 rounded-full" />
                    {cfg.symbol}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Trigger */}
          <Field label="Trigger" hint="What event should fire this sniper?">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { id: 'new_pair', label: 'New Pair' },
                { id: 'whale_buy', label: 'Whale Buys' },
                { id: 'price_target', label: 'Price Target' },
                { id: 'manual', label: 'Manual' },
              ] as { id: Trigger; label: string }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTrigger(t.id)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${
                    trigger === t.id ? 'border-blue-400/60 bg-blue-500/15 text-blue-100' : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {trigger === 'whale_buy' && (
            <Field label="Whale Address" required>
              <input value={whaleAddress} onChange={e => setWhaleAddress(e.target.value)} placeholder="0x... or solana address" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none font-mono text-sm transition" />
            </Field>
          )}
          {trigger === 'price_target' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Token Address" required>
                  <input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} placeholder="0x... or mint" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none font-mono text-sm transition" />
                </Field>
                <Field label="Buy When ≤ (USD)" required>
                  <input type="number" value={priceTarget} onChange={e => setPriceTarget(e.target.value)} placeholder="0.0001" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none transition" />
                </Field>
              </div>
              {/* §11 — Live preview chart so the user can sanity-check the
                  price target against the actual token. Only renders when
                  the address looks plausible (EVM or base58); otherwise the
                  modal stays clean. AdvancedChart handles its own loading
                  + error states (gracefully shows "Failed to load chart"
                  when the OHLCV API can't resolve the token). */}
              {isPlausibleAddress(debouncedTokenAddress) && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1.5">Token preview</div>
                  <AdvancedChart
                    chain={detectChainFromAddress(debouncedTokenAddress, chains[0] ?? 'ethereum')}
                    token={debouncedTokenAddress.trim()}
                    tf="1h"
                    chartType="candlestick"
                    indicators={{ ema21: true, volume: true }}
                    height={180}
                    className="rounded-lg border border-white/10 overflow-hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* Amount + Slippage + Priority */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Per Snipe (USD)" required>
              <input type="number" value={amountUsd} onChange={e => setAmountUsd(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
            <Field label="Max Slippage (%)">
              <input type="number" step="0.1" value={slippagePct} onChange={e => setSlippagePct(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
            <Field label={`Priority Fee${primaryChainCfg ? ` (${primaryChainCfg.symbol === 'SOL' ? 'µLamp' : 'gwei'})` : ''}`}>
              <input type="number" value={priorityFee ?? ''} onChange={e => setPriorityFee(e.target.value === '' ? null : Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
          </div>

          {/* MEV protect */}
          <Toggle
            label="MEV Protection"
            hint={primaryChainCfg ? primaryChainCfg.mevProtect.label : 'Routes through anti-front-run RPCs'}
            value={mevProtect}
            onChange={setMevProtect}
            disabled={primaryChainCfg ? !primaryChainCfg.mevProtect.available : false}
            icon={Shield}
          />

          {/* Auto-execute */}
          <Toggle
            label="Auto-Execute"
            hint="Fire automatically when matched. Off = alert only."
            value={autoExecute}
            onChange={setAutoExecute}
            icon={Zap}
            color="amber"
          />

          {/* TP / SL */}
          <Section title="Take Profit / Stop Loss" expanded={showAdvanced} onToggle={() => setShowAdvanced(v => !v)}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Take Profit (%)">
                <input type="number" value={tp} onChange={e => setTp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="200" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Stop Loss (%)">
                <input type="number" value={sl} onChange={e => setSl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Trailing Stop (%)">
                <input type="number" value={trailingStop} onChange={e => setTrailingStop(e.target.value === '' ? '' : Number(e.target.value))} placeholder="15" className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none transition" />
              </Field>
            </div>
            <div className="mt-3">
              <Toggle label="Auto-sell on target hit" value={autoSellOnTarget} onChange={setAutoSellOnTarget} icon={Target} compact />
            </div>
          </Section>

          {/* Filters */}
          <Section title="Safety Filters" expanded={showFilters} onToggle={() => setShowFilters(v => !v)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Min Liquidity (USD)">
                <input type="number" value={minLiqUsd} onChange={e => setMinLiqUsd(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Max Buy Tax (%)">
                <input type="number" step="0.1" value={maxBuyTaxPct} onChange={e => setMaxBuyTaxPct(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Max Sell Tax (%)">
                <input type="number" step="0.1" value={maxSellTaxPct} onChange={e => setMaxSellTaxPct(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Min Holders">
                <input type="number" value={minHolders} onChange={e => setMinHolders(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
              </Field>
              <Field label="Min Security Score">
                <input type="number" min={0} max={100} value={minSecurityScore} onChange={e => setMinSecurityScore(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
              </Field>
            </div>
            <div className="mt-3">
              <Toggle label="Block Honeypots" hint="Auto-abort if GoPlus flags as honeypot." value={blockHoneypots} onChange={setBlockHoneypots} icon={AlertTriangle} compact color="red" />
            </div>
          </Section>

          {/* Daily limits + expiry */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Daily Max Snipes">
              <input type="number" value={dailyMaxSnipes} onChange={e => setDailyMaxSnipes(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
            <Field label="Daily Max Spend (USD)">
              <input type="number" value={dailyMaxSpend} onChange={e => setDailyMaxSpend(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
            <Field label="Expire After (hours)" hint="Empty = never expires">
              <input type="number" value={expiryHours} onChange={e => setExpiryHours(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white focus:border-blue-400 focus:outline-none transition" />
            </Field>
          </div>

          {/* Wallets */}
          {userWallets.length > 0 && (
            <Field label="Wallets" hint="Pick which wallets this sniper uses. Empty = primary only.">
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-white/10 p-2 bg-white/[0.02]">
                {userWallets.map(w => (
                  <label key={w.address} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer">
                    <input type="checkbox" checked={walletAddresses.includes(w.address)} onChange={() => toggleWallet(w.address)} className="accent-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{w.label ?? `${w.address.slice(0, 8)}…${w.address.slice(-4)}`}</div>
                      <div className="text-xs text-white/40 font-mono">{w.address.slice(0, 14)}… · {w.chain ?? 'evm'}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 sticky bottom-0 bg-[#0a0d18]">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 font-semibold text-sm hover:bg-white/[0.1] transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 font-bold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/30"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Create Sniper'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs uppercase tracking-wider text-white/60 font-bold">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
      </div>
      {children}
      {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, value, onChange, disabled, icon: Icon, compact, color = 'blue' }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: React.ComponentType<{ className?: string }>; compact?: boolean; color?: 'blue' | 'amber' | 'red' }) {
  const colorMap = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-full flex items-center justify-between gap-3 ${compact ? 'px-3 py-2' : 'px-4 py-3'} rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-2.5 min-w-0 text-left">
        {Icon && <Icon className="w-4 h-4 text-white/60 flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          {hint && <div className="text-[11px] text-white/50 truncate">{hint}</div>}
        </div>
      </div>
      <div className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${value ? colorMap[color] : 'bg-white/10'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

function Section({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-wider text-white/80 hover:bg-white/[0.03] transition">
        {title}
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
