'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { X, Loader2, Zap, Shield, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CHAIN_CONFIGS, SNIPER_CHAINS, type SniperChain } from '@/lib/sniper/chains';
import { LAUNCHPADS, launchpadIconUrl } from '@/lib/sniper/launchpads';
import { SecurityGate } from '@/components/security/SecurityGate';
import { Toggle as SquareToggle } from '@/components/ui/Toggle';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

// §11 — lazy-loaded so the chart bundle only ships when the user
// actually opens the modal AND enters a token address.
const AdvancedChart = dynamic(
  () => import('@/components/trading/AdvancedChart').then(m => m.AdvancedChart),
  { ssr: false, loading: () => <div className="h-[180px] rounded-lg border border-white/10 flex items-center justify-center text-[11px] text-white/50">Loading chart…</div> },
);

// Inline blue-stride ring shared across the modal shell + every inner panel so
// every surface carries the brand neon-blue edge glow.
const BLUE_STRIDE = { boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' } as const;

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

// Canonical trigger values — must match the live sniper_criteria.trigger_type
// CHECK constraint (new_token_launch, whale_buy, price_target).
type Trigger = 'new_token_launch' | 'whale_buy' | 'price_target';

// EVM-only: Solana/TON can't do capped, revocable session-key automation.
const EVM_SNIPER_CHAINS = SNIPER_CHAINS.filter((c) => c !== 'solana' && c !== 'ton');

// Snipe-protection launchpads shown MEVX-style. Persisted to
// sniper_criteria.launchpads_allowed (null = all pads allowed) and enforced by
// the matcher against the detected token's launchpad.
const SNIPE_PROTECTION_LAUNCHPADS = LAUNCHPADS.filter((l) => l.id !== 'dex');

export function NewSniperModal({ onClose, onSaved, userId }: Props) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<Trigger>('new_token_launch');
  // EVM-only non-custodial sniping — Solana/TON can't do capped session-key
  // automation, so the config is restricted to EVM chains.
  const [chains, setChains] = useState<SniperChain[]>(['ethereum']);
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
  // Which wallet signs the snipe. 'builtin' = the user's in-app Naka wallet
  // (manual confirm → password-sign, already wired through pendingSigner);
  // 'external' = a connected MetaMask/Phantom wallet (session-key authorized).
  const [walletMode, setWalletMode] = useState<'builtin' | 'external'>('builtin');

  // Launchpad allowlist — persisted as sniper_criteria.launchpads_allowed.
  const [protectedLaunchpads, setProtectedLaunchpads] = useState<string[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showReview, setShowReview] = useState(false);
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

  const toggleLaunchpad = (id: string) => {
    setProtectedLaunchpads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Inline validation — returns the first reason the form can't be saved (shown
  // to the user) or null when valid, so they know exactly what to fix.
  const validationError = useMemo<string | null>(() => {
    if (!name.trim()) return 'Give your sniper a name.';
    if (chains.length === 0) return 'Select at least one chain.';
    if (!(amountUsd > 0)) return 'Per-snipe amount must be greater than $0.';
    if (trigger === 'whale_buy') {
      if (!whaleAddress.trim()) return 'Enter the whale address to follow.';
      if (!isPlausibleAddress(whaleAddress)) return 'That whale address isn\'t a valid EVM (0x…) or Solana address.';
    }
    if (trigger === 'price_target') {
      if (!priceTarget) return 'Enter a price target.';
      if (!(Number(priceTarget) > 0)) return 'Price target must be greater than 0.';
      if (tokenAddress && !isPlausibleAddress(tokenAddress)) return 'That token address isn\'t valid.';
    }
    if (Number(maxBuyTaxPct) > 100 || Number(maxSellTaxPct) > 100) return 'Max tax can\'t exceed 100%.';
    return null;
  }, [name, chains, amountUsd, trigger, whaleAddress, priceTarget, tokenAddress, maxBuyTaxPct, maxSellTaxPct]);
  const canSave = validationError === null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Route through the API so the server enforces the tier gate, wallet
      // ownership, address canonicalization, and the DB-valid enums. A direct
      // client insert bypassed all of that AND sent enum values the live CHECK
      // constraints reject (trigger_type / wallet_source), so every save failed.
      const payload = {
        name: name.trim(),
        enabled: true,
        paused: false,
        trigger_type: trigger,
        chains_allowed: chains,
        min_liquidity_usd: minLiqUsd || undefined,
        max_buy_tax_bps: Math.round(maxBuyTaxPct * 100),
        max_sell_tax_bps: Math.round(maxSellTaxPct * 100),
        min_holder_count: minHolders || undefined,
        min_security_score: minSecurityScore || undefined,
        block_honeypots: blockHoneypots,
        launchpads_allowed: protectedLaunchpads.length ? protectedLaunchpads : null,
        trigger_whale_address: trigger === 'whale_buy' ? (normalizeAddress(whaleAddress.trim()) ?? whaleAddress.trim()) : null,
        trigger_price_target: trigger === 'price_target' ? Number(priceTarget) : null,
        // The target token + direction were never persisted, so the cron had
        // nothing to evaluate. "Buy When ≤" ⇒ direction 'below'.
        trigger_token_address: trigger === 'price_target'
          ? (normalizeAddress(tokenAddress.trim()) ?? tokenAddress.trim())
          : null,
        trigger_price_direction: trigger === 'price_target' ? 'below' : null,
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
        // Explicit wallet choice: 'builtin' = Naka in-app wallet (manual
        // password-sign), 'metamask' = a connected external wallet that
        // authorized a non-custodial session key.
        // Key off the explicit mode alone — "External" with no specific wallet
        // picked means "use my primary external wallet" (empty addresses), NOT
        // a silent fall-back to the built-in wallet.
        wallet_source: walletMode === 'external' ? 'metamask' : 'builtin',
        wallet_addresses: walletMode === 'external' ? walletAddresses : [],
        expiry_hours: expiryHours === '' ? null : Number(expiryHours),
      };

      const res = await fetch('/api/sniper/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || 'Save failed');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={BLUE_STRIDE}
        className="nl-glass w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 z-10 bg-[var(--nl-canvas-base,#050816)]/80 backdrop-blur">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" /> New Sniper</h2>
            <p className="text-xs text-white/50 mt-0.5">Configure a rule that triggers a buy when conditions match.</p>
          </div>
          <button onClick={onClose} aria-label="Close sniper rule editor" className="nl-button nl-button--ghost !p-2"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name spans full width above the two-column grid. */}
          <Panel>
            <Field label="Sniper Name" required>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. ETH uniswap memecoin sniper"
                className={INPUT_CLS}
              />
            </Field>
          </Panel>

          {/* MEVX-style two columns: targeting on the left, execution + risk on
              the right. Stacks to a single scrolling column on mobile. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── LEFT: Wallets + Targeting ─────────────────────────────── */}
            <div className="space-y-4">
              {/* Wallet source — Naka built-in vs external */}
              <Panel>
                <Field label="Wallet" hint={walletMode === 'builtin'
                  ? 'Your in-app Naka wallet signs each snipe (you confirm with your wallet password). Non-custodial — keys never leave your browser.'
                  : 'A connected external wallet (MetaMask / Phantom) signs via its authorized session key.'}>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'builtin' as const, label: 'Naka Wallet', sub: 'In-app · you confirm' },
                      { id: 'external' as const, label: 'External Wallet', sub: 'MetaMask / Phantom' },
                    ]).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setWalletMode(opt.id); if (opt.id === 'builtin') setWalletAddresses([]); }}
                        className={SEG_CLS(walletMode === opt.id) + ' text-start'}
                      >
                        <div className={`text-sm font-semibold ${walletMode === opt.id ? 'text-blue-100' : 'text-white/80'}`}>{opt.label}</div>
                        <div className="text-[11px] text-white/45">{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                {/* External wallet multi-select — only when External is chosen */}
                {walletMode === 'external' && userWallets.length > 0 && (
                  <div className="mt-3">
                    <Field label="Wallets" hint="Pick which connected wallets this sniper uses. Empty = primary only.">
                      <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-white/10 p-2 bg-white/[0.03]">
                        {userWallets.map(w => (
                          <label key={w.address} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05] cursor-pointer">
                            <input type="checkbox" checked={walletAddresses.includes(w.address)} onChange={() => toggleWallet(w.address)} className="accent-[var(--nl-blue,#0066FF)]" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{w.label ?? `${w.address.slice(0, 8)}…${w.address.slice(-4)}`}</div>
                              <div className="text-xs text-white/40 font-mono">{w.address.slice(0, 14)}… · {w.chain ?? 'evm'}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}
              </Panel>

              {/* Chains */}
              <Panel>
                <Field label="Chains" required hint="EVM-only — non-custodial session-key automation. The first chain's defaults populate priority fee.">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EVM_SNIPER_CHAINS.map(c => {
                      const cfg = CHAIN_CONFIGS[c];
                      const active = chains.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleChain(c)} className={SEG_CLS(active) + ' flex items-center gap-1.5 text-sm font-semibold'}>
                          <img src={cfg.logo} alt="" className="w-5 h-5 rounded-full" />
                          {cfg.symbol}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Panel>

              {/* Trigger (Targeted / Mass via New Pair, plus Whale + Price) */}
              <Panel>
                <Field label="Trigger" hint="What event should fire this sniper?">
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'new_token_launch', label: 'New Pair', sub: 'Mass' },
                      { id: 'whale_buy', label: 'Whale Buys', sub: 'Dev / wallet' },
                      { id: 'price_target', label: 'Price Target', sub: 'Targeted' },
                    ] as { id: Trigger; label: string; sub: string }[]).map(t => (
                      <button key={t.id} type="button" onClick={() => setTrigger(t.id)} className={SEG_CLS(trigger === t.id) + ' text-center'}>
                        <div className={`text-sm font-semibold ${trigger === t.id ? 'text-blue-100' : 'text-white/80'}`}>{t.label}</div>
                        <div className="text-[10px] uppercase tracking-wide text-white/40">{t.sub}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                {trigger === 'whale_buy' && (
                  <div className="mt-3">
                    <Field label="Dev / Whale Address" required hint="Mirror this wallet — snipe whatever it buys.">
                      <input value={whaleAddress} onChange={e => setWhaleAddress(e.target.value)} placeholder="0x… or solana address" className={INPUT_CLS + ' font-mono text-sm'} />
                    </Field>
                  </div>
                )}
                {trigger === 'price_target' && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Token / Symbol" required>
                        <input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} placeholder="0x… or mint" className={INPUT_CLS + ' font-mono text-sm'} />
                      </Field>
                      <Field label="Buy When ≤ (USD)" required>
                        <input type="number" value={priceTarget} onChange={e => setPriceTarget(e.target.value)} placeholder="0.0001" className={INPUT_CLS} />
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
              </Panel>

              {/* Snipe Protection — per-launchpad allowlist (MEVX reference),
                  persisted to sniper_criteria.launchpads_allowed. */}
              <Panel>
                <Field
                  label="Snipe Protection"
                  hint="Restrict which launchpads this rule will snipe. Empty = all launchpads allowed."
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SNIPE_PROTECTION_LAUNCHPADS.map(lp => {
                      const active = protectedLaunchpads.includes(lp.id);
                      const icon = launchpadIconUrl(lp.id);
                      return (
                        <button key={lp.id} type="button" onClick={() => toggleLaunchpad(lp.id)} className={SEG_CLS(active) + ' flex items-center gap-1.5 text-xs font-semibold'}>
                          {icon
                            ? <img src={icon} alt="" className="w-4 h-4 rounded-full flex-shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            : <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] flex-shrink-0">{lp.label[0]}</span>}
                          <span className="truncate">{lp.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                    Leave all off to allow every launchpad; select some to restrict snipes to those only.
                  </p>
                </Field>
              </Panel>
            </div>

            {/* ── RIGHT: Execution + Advanced ──────────────────────────── */}
            <div className="space-y-4">
              {/* Snipe amount + slippage + priority fee */}
              <Panel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Snipe Amount (USD)" required>
                    <input type="number" value={amountUsd} onChange={e => setAmountUsd(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Slippage / Min Recv (%)">
                    <input type="number" step="0.1" value={slippagePct} onChange={e => setSlippagePct(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label={`Priority Fee${primaryChainCfg ? ` (${primaryChainCfg.symbol === 'SOL' ? 'µLamp' : 'gwei'})` : ''}`}>
                    <input type="number" value={priorityFee ?? ''} onChange={e => setPriorityFee(e.target.value === '' ? null : Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                </div>
              </Panel>

              {/* Anti-MEV + Auto-execute toggles */}
              <Panel>
                <div className="space-y-3">
                  <ToggleRow
                    label="Anti-MEV"
                    hint={primaryChainCfg ? primaryChainCfg.mevProtect.label : 'Routes through anti-front-run RPCs'}
                    checked={mevProtect}
                    onChange={setMevProtect}
                    disabled={primaryChainCfg ? !primaryChainCfg.mevProtect.available : false}
                    icon={Shield}
                  />
                  <ToggleRow
                    label="Auto-Execute"
                    hint="On a match: the Naka wallet auto-buys while it's unlocked and Naka is open (non-custodial — keys stay in your browser); otherwise it's staged for one-tap approval. External wallets always need your one-tap sign. Off = alert only."
                    checked={autoExecute}
                    onChange={setAutoExecute}
                    icon={Zap}
                  />
                </div>
              </Panel>

              {/* Max block / daily limits / expiry */}
              <Panel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Max Block / Snipes per day" hint="Daily snipe cap.">
                    <input type="number" value={dailyMaxSnipes} onChange={e => setDailyMaxSnipes(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Daily Max Spend (USD)">
                    <input type="number" value={dailyMaxSpend} onChange={e => setDailyMaxSpend(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Expiry (hours)" hint="Empty = never expires">
                    <input type="number" value={expiryHours} onChange={e => setExpiryHours(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                </div>
              </Panel>

              {/* Auto TP / SL — Advance */}
              <Section title="Auto TP / SL · Auto Sell" expanded={showAdvanced} onToggle={() => setShowAdvanced(v => !v)}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Take Profit (%)">
                    <input type="number" value={tp} onChange={e => setTp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="200" className={INPUT_CLS} />
                  </Field>
                  <Field label="Stop Loss (%)">
                    <input type="number" value={sl} onChange={e => setSl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" className={INPUT_CLS} />
                  </Field>
                  <Field label="Trailing Stop (%)">
                    <input type="number" value={trailingStop} onChange={e => setTrailingStop(e.target.value === '' ? '' : Number(e.target.value))} placeholder="15" className={INPUT_CLS} />
                  </Field>
                </div>
                <div className="mt-3">
                  <ToggleRow label="Auto-sell on target hit" hint="Sell Immediately when TP / SL is reached." checked={autoSellOnTarget} onChange={setAutoSellOnTarget} icon={Target} compact />
                </div>
              </Section>

              {/* Safety filters */}
              <Section title="Safety Filters" expanded={showFilters} onToggle={() => setShowFilters(v => !v)}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Min Liquidity (USD)">
                    <input type="number" value={minLiqUsd} onChange={e => setMinLiqUsd(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Max Buy Tax (%)">
                    <input type="number" step="0.1" value={maxBuyTaxPct} onChange={e => setMaxBuyTaxPct(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Max Sell Tax (%)">
                    <input type="number" step="0.1" value={maxSellTaxPct} onChange={e => setMaxSellTaxPct(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Min Holders">
                    <input type="number" value={minHolders} onChange={e => setMinHolders(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Min Security Score">
                    <input type="number" min={0} max={100} value={minSecurityScore} onChange={e => setMinSecurityScore(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                </div>
                <div className="mt-3">
                  <ToggleRow label="Block Honeypots" hint="Auto-abort if GoPlus flags as honeypot." checked={blockHoneypots} onChange={setBlockHoneypots} icon={AlertTriangle} compact />
                </div>
              </Section>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 sticky bottom-0 bg-[var(--nl-canvas-base,#050816)]/80 backdrop-blur">
          <button onClick={onClose} className="nl-button nl-button--ghost">Cancel</button>
          {/* Tells the user exactly why Review & Create is disabled. */}
          {validationError && <span className="flex-1 text-center text-[11px] text-amber-400 px-2">{validationError}</span>}
          {/* §12 — Pre-create security gate. Only fires for the price_target
              trigger because that's the only path with a known token at
              criteria-creation time. Other triggers (new_pair / whale_buy /
              manual) discover the token at webhook-match time, where
              relayer.ts already runs the GoPlus + trust-score check on the
              actual trade. SecurityGate fail-opens for missing token, so
              non-price-target paths render the bare button. */}
          <SecurityGate
            action="snipe"
            chain={trigger === 'price_target' ? (chains[0] ?? undefined) : undefined}
            token={trigger === 'price_target' ? tokenAddress.trim() : undefined}
          >
            <button
              onClick={() => setShowReview(true)}
              disabled={!canSave || saving}
              className="nl-btn-neon !px-6 !py-2.5 !text-sm font-bold"
            >
              <Zap className="w-4 h-4" />
              Review &amp; Create
            </button>
          </SecurityGate>
        </div>

        {showReview && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => !saving && setShowReview(false)}>
            <div
              onClick={e => e.stopPropagation()}
              style={BLUE_STRIDE}
              className="nl-glass w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" /> Confirm sniper</h3>
                <button onClick={() => !saving && setShowReview(false)} disabled={saving} aria-label="Close confirm sniper" className="nl-button nl-button--ghost !p-1.5"><X className="w-4 h-4" aria-hidden="true" /></button>
              </div>
              <p className="text-xs text-white/60 mb-4">Review every value before this rule goes live. Once saved, it watches the chain on every match.</p>
              <dl className="space-y-2 text-sm">
                <ReviewRow k="Name" v={name} />
                <ReviewRow k="Trigger" v={trigger.replace('_', ' ')} />
                <ReviewRow k="Chains" v={chains.join(', ')} />
                <ReviewRow k="Wallet" v={walletMode === 'builtin' ? 'Naka Wallet (in-app)' : 'External wallet'} />
                {trigger === 'whale_buy' && <ReviewRow k="Whale" v={`${whaleAddress.slice(0, 8)}…${whaleAddress.slice(-4)}`} />}
                {trigger === 'price_target' && <ReviewRow k="Price target" v={`$${priceTarget}`} />}
                <ReviewRow k="Amount / snipe" v={`$${amountUsd}`} />
                <ReviewRow k="Slippage" v={`${slippagePct}%`} />
                <ReviewRow k="Priority fee" v={priorityFee != null ? String(priorityFee) : '—'} />
                <ReviewRow k="Anti-MEV" v={mevProtect ? 'on' : 'off'} />
                <ReviewRow k="Take profit" v={tp === '' ? '—' : `+${tp}%`} />
                <ReviewRow k="Stop loss" v={sl === '' ? '—' : `-${sl}%`} />
                <ReviewRow k="Trailing stop" v={trailingStop === '' ? '—' : `${trailingStop}%`} />
                <ReviewRow k="Auto-sell on target" v={autoSellOnTarget ? 'yes' : 'no'} />
                <ReviewRow k="Daily cap" v={`${dailyMaxSnipes} snipes · $${dailyMaxSpend}`} />
                <ReviewRow k="Auto-execute" v={autoExecute ? 'yes' : 'manual confirm'} highlight={autoExecute} />
                <ReviewRow k="Min liquidity" v={`$${minLiqUsd.toLocaleString()}`} />
                <ReviewRow k="Max tax (buy / sell)" v={`${maxBuyTaxPct}% / ${maxSellTaxPct}%`} />
                <ReviewRow k="Block honeypots" v={blockHoneypots ? 'yes' : 'no'} highlight={!blockHoneypots} />
              </dl>
              {error && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
              )}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setShowReview(false)} disabled={saving} className="nl-button nl-button--ghost !text-xs">Back to edit</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="nl-btn-neon !px-5 !text-xs font-bold"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Snipe Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5">
      <dt className="text-xs uppercase tracking-wider text-white/50">{k}</dt>
      <dd className={`text-sm font-semibold tabular-nums text-right ${highlight ? 'text-amber-300' : 'text-white'}`}>{v}</dd>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Shared input styling — translucent glass field, no raw hex boxes.
const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder:text-white/40 focus:border-[var(--nl-blue,#0066FF)] focus:outline-none transition';

// Segmented / selectable button styling shared by chains, triggers, wallet
// mode, and launchpad chips.
function SEG_CLS(active: boolean): string {
  return `px-3 py-2 rounded-lg border transition ${
    active
      ? 'border-[var(--nl-blue,#0066FF)]/60 bg-[var(--nl-blue,#0066FF)]/15 text-blue-100'
      : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20'
  }`;
}

// nl-card field-group wrapper carrying the blue-stride ring.
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="nl-card p-4" style={BLUE_STRIDE}>
      {children}
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs uppercase tracking-wider text-white/60 font-bold">
          {label}{required && <span className="text-red-400 ms-1">*</span>}
        </label>
      </div>
      {children}
      {hint && <p className="text-[11px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

// Row wrapper around the shared square Toggle (components/ui/Toggle).
function ToggleRow({ label, hint, checked, onChange, disabled, icon: Icon, compact }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: React.ComponentType<{ className?: string }>; compact?: boolean }) {
  return (
    <div className={`w-full flex items-center justify-between gap-3 ${compact ? 'px-3 py-2' : 'px-4 py-3'} rounded-lg border border-white/10 bg-white/[0.03] ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2.5 min-w-0 text-start">
        {Icon && <Icon className="w-4 h-4 text-white/60 flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          {hint && <div className="text-[11px] text-white/50">{hint}</div>}
        </div>
      </div>
      <SquareToggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="nl-card" style={BLUE_STRIDE}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-wider text-white/80 hover:bg-white/[0.03] transition rounded-t-xl">
        {title}
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
