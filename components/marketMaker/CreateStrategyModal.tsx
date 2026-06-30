'use client';

/**
 * #68 Market-Maker — Create Strategy modal.
 *
 * Wires to POST /api/market-maker/strategies using the route's EXACT field
 * names. Resolves a real token symbol via /api/swap/token-meta (no fabricated
 * metadata) and shows a client-side ladder preview computed with the SAME logic
 * as lib/marketMaker/engine.ts:computeLadder, so the user can sanity-check the
 * grid before saving. New strategies are created paused by design — nothing
 * trades until the user activates and funds the AA kernel.
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Bot, AlertTriangle, Check } from 'lucide-react';
import { ChainLogo } from '@/components/common/ChainLogo';
import { isEvmAddress, isSolanaAddress } from '@/lib/utils/addressNormalize';

// Inline blue-stride ring — brand neon-blue edge glow shared across surfaces.
const BLUE_STRIDE = { boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' } as const;

// The 8 chains the API accepts (route.ts CHAINS), in display order.
const MM_CHAINS = ['solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'avalanche'] as const;
type MmChain = typeof MM_CHAINS[number];

const CHAIN_LABELS: Record<MmChain, string> = {
  solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bsc: 'BSC',
  arbitrum: 'Arbitrum', optimism: 'Optimism', polygon: 'Polygon', avalanche: 'Avalanche',
};

interface GridLevel { level: number; side: 'buy' | 'sell'; targetPrice: number; }

/**
 * Mirror of lib/marketMaker/engine.ts:computeLadder — kept in sync so the
 * preview shows the exact rungs the engine will place. `numLevels` buy rungs
 * below and `numLevels` sell rungs above a reference, spaced spread→band.
 */
function computeLadder(reference: number, spreadBps: number, numLevels: number, bandPct: number): GridLevel[] {
  if (!(reference > 0) || numLevels < 1) return [];
  const halfSpread = spreadBps / 10_000;
  const band = Math.max(bandPct / 100, halfSpread);
  const levels: GridLevel[] = [];
  for (let i = 1; i <= numLevels; i++) {
    const t = numLevels === 1 ? 1 : i / numLevels;
    const offset = halfSpread + (band - halfSpread) * (t - 1 / numLevels);
    levels.push({ level: i, side: 'buy', targetPrice: reference * (1 - offset) });
    levels.push({ level: i, side: 'sell', targetPrice: reference * (1 + offset) });
  }
  return levels;
}

function validAddressForChain(chain: string, addr: string): boolean {
  return chain === 'solana' ? isSolanaAddress(addr) : isEvmAddress(addr);
}

function fmtPrice(n: number): string {
  if (!(n > 0)) return '—';
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(4)}`;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

type StrategyType = 'grid' | 'range' | 'presence';
type RefMode = 'market' | 'manual';

export function CreateStrategyModal({ onClose, onSaved }: Props) {
  const [chain, setChain] = useState<MmChain>('base');
  const [tokenAddress, setTokenAddress] = useState('');
  const [strategyType, setStrategyType] = useState<StrategyType>('grid');
  const [rangeLowerPct, setRangeLowerPct] = useState(-20);
  const [rangeUpperPct, setRangeUpperPct] = useState(20);
  const [refMode, setRefMode] = useState<RefMode>('market');
  const [manualPrice, setManualPrice] = useState('');
  const [spreadBps, setSpreadBps] = useState(100);
  const [numLevels, setNumLevels] = useState(3);
  const [orderSizeUsd, setOrderSizeUsd] = useState(50);
  const [budgetUsd, setBudgetUsd] = useState(500);
  const [maxInventoryUsd, setMaxInventoryUsd] = useState<number | ''>(250);
  const [maxSlippageBps, setMaxSlippageBps] = useState(200);
  const [bandPct, setBandPct] = useState(10);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real token-symbol resolution (no fabricated metadata) ─────────────────────
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<{ symbol: string; price: number | null } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    const addr = tokenAddress.trim();
    setResolved(null);
    setResolveError(null);
    if (!addr || !validAddressForChain(chain, addr)) return;
    let cancelled = false;
    setResolving(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/swap/token-meta?chain=${chain}&address=${encodeURIComponent(addr)}`, { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) { setResolveError('Token not found on this chain.'); return; }
        const j = await res.json();
        // token-meta does not return price; market price comes from the engine
        // server-side. We only surface the resolved symbol here.
        setResolved({ symbol: j?.symbol ?? '', price: null });
      } catch {
        if (!cancelled) setResolveError('Could not resolve token.');
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); setResolving(false); };
  }, [tokenAddress, chain]);

  // Ladder preview reference: manual price when set, otherwise a normalized 1.0
  // reference so the user sees the relative grid shape (real market reference is
  // applied server-side at execution from DexScreener).
  const previewRef = useMemo(() => {
    if (refMode === 'manual') { const p = Number(manualPrice); return p > 0 ? p : 0; }
    return 1; // relative preview when pricing off live market
  }, [refMode, manualPrice]);

  const ladder = useMemo(
    () => computeLadder(previewRef, spreadBps, numLevels, bandPct),
    [previewRef, spreadBps, numLevels, bandPct],
  );
  const sellRungs = ladder.filter((l) => l.side === 'sell').sort((a, b) => a.targetPrice - b.targetPrice);
  const buyRungs = ladder.filter((l) => l.side === 'buy').sort((a, b) => b.targetPrice - a.targetPrice);

  const validationError = useMemo<string | null>(() => {
    const addr = tokenAddress.trim();
    if (!addr) return 'Enter the token address.';
    if (!validAddressForChain(chain, addr)) return `That address isn't valid for ${CHAIN_LABELS[chain]}.`;
    if (!(orderSizeUsd > 0)) return 'Order size must be greater than $0.';
    if (!(budgetUsd > 0)) return 'Budget must be greater than $0.';
    if (orderSizeUsd > budgetUsd) return 'Order size cannot exceed budget.';
    if (refMode === 'manual' && !(Number(manualPrice) > 0)) return 'Enter a manual reference price.';
    return null;
  }, [tokenAddress, chain, orderSizeUsd, budgetUsd, refMode, manualPrice]);
  const canSave = validationError === null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        chain,
        token_address: tokenAddress.trim(),
        token_symbol: resolved?.symbol || null,
        strategy_type: strategyType,
        reference_price_mode: refMode,
        manual_reference_price: refMode === 'manual' ? Number(manualPrice) : null,
        spread_bps: spreadBps,
        num_levels: numLevels,
        order_size_usd: orderSizeUsd,
        budget_usd: budgetUsd,
        max_inventory_usd: maxInventoryUsd === '' ? null : Number(maxInventoryUsd),
        max_slippage_bps: maxSlippageBps,
        band_pct: bandPct,
        ...(strategyType === 'range' ? { range_lower_pct: rangeLowerPct, range_upper_pct: rangeUpperPct } : {}),
      };
      const res = await fetch('/api/market-maker/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError(j?.error || 'Could not create strategy.');
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create strategy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={BLUE_STRIDE}
        className="nl-glass w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 z-10 bg-[var(--nl-canvas-base,#050816)]/80 backdrop-blur">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" /> New Strategy</h2>
            <p className="text-xs text-white/50 mt-0.5">Configure a grid market-making strategy. Created paused — nothing trades until you activate.</p>
          </div>
          <button onClick={onClose} aria-label="Close strategy editor" className="nl-button nl-button--ghost !p-2"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── LEFT: target + grid params ──────────────────────────── */}
            <div className="space-y-4">
              {/* Chain */}
              <Panel>
                <Field label="Chain" required hint="EVM chains auto-execute via the AA session key. Solana strategies are persisted but not auto-executed yet.">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MM_CHAINS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChain(c)}
                        className={SEG_CLS(chain === c) + ' flex items-center gap-1.5 text-xs font-semibold'}
                      >
                        <ChainLogo chain={c} size={16} />
                        <span className="truncate">{CHAIN_LABELS[c]}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </Panel>

              {/* Token address */}
              <Panel>
                <Field label="Token Address" required>
                  <input
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder={chain === 'solana' ? 'Token mint…' : '0x… contract'}
                    className={INPUT_CLS + ' font-mono text-sm'}
                  />
                  <div className="mt-1.5 min-h-[18px] text-[11px]">
                    {resolving && <span className="text-white/50 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Resolving…</span>}
                    {!resolving && resolved?.symbol && (
                      <span className="text-emerald-300 inline-flex items-center gap-1"><Check className="w-3 h-3" /> {resolved.symbol}</span>
                    )}
                    {!resolving && resolveError && <span className="text-amber-400">{resolveError}</span>}
                  </div>
                </Field>
              </Panel>

              {/* Strategy type */}
              <Panel>
                <Field label="Strategy Type" hint="Grid & Range are live. Presence (volume) is intentionally not offered — single-account self-trading is wash trading.">
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'grid' as const, label: 'Grid', sub: 'Live', disabled: false },
                      { id: 'range' as const, label: 'Range', sub: 'Live', disabled: false },
                      { id: 'presence' as const, label: 'Presence', sub: 'Not offered', disabled: true },
                    ]).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={o.disabled}
                        onClick={() => !o.disabled && setStrategyType(o.id)}
                        className={`${SEG_CLS(strategyType === o.id)} text-center ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title={o.disabled ? 'Not offered — single-account self-trading is wash trading' : undefined}
                      >
                        <div className={`text-sm font-semibold ${strategyType === o.id ? 'text-blue-100' : 'text-white/80'}`}>{o.label}</div>
                        <div className="text-[10px] uppercase tracking-wide text-white/40">{o.sub}</div>
                      </button>
                    ))}
                  </div>
                  {strategyType === 'range' && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div>
                        <label className="text-[11px] text-white/50">Lower bound %</label>
                        <input type="number" value={rangeLowerPct} onChange={(e) => setRangeLowerPct(Number(e.target.value))} className={INPUT_CLS} />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/50">Upper bound %</label>
                        <input type="number" value={rangeUpperPct} onChange={(e) => setRangeUpperPct(Number(e.target.value))} className={INPUT_CLS} />
                      </div>
                      <p className="col-span-2 text-[11px] text-white/40">Accumulate at/below the lower bound, distribute at/above the upper bound (relative to the reference price).</p>
                    </div>
                  )}
                </Field>
              </Panel>

              {/* Reference price mode */}
              <Panel>
                <Field label="Reference Price" hint="Market = live DexScreener mid; Manual = a fixed reference you set.">
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'market' as const, label: 'Market', sub: 'Live DexScreener' },
                      { id: 'manual' as const, label: 'Manual', sub: 'Fixed price' },
                    ]).map((o) => (
                      <button key={o.id} type="button" onClick={() => setRefMode(o.id)} className={SEG_CLS(refMode === o.id) + ' text-start'}>
                        <div className={`text-sm font-semibold ${refMode === o.id ? 'text-blue-100' : 'text-white/80'}`}>{o.label}</div>
                        <div className="text-[11px] text-white/45">{o.sub}</div>
                      </button>
                    ))}
                  </div>
                  {refMode === 'manual' && (
                    <div className="mt-3">
                      <Field label="Manual Reference Price (USD)" required>
                        <input type="number" step="any" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.0001" className={INPUT_CLS} />
                      </Field>
                    </div>
                  )}
                </Field>
              </Panel>
            </div>

            {/* ── RIGHT: sizing + guards + preview ────────────────────── */}
            <div className="space-y-4">
              <Panel>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Spread (bps)" hint="Closest rung offset.">
                    <input type="number" value={spreadBps} onChange={(e) => setSpreadBps(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Levels per side" hint="Buy + sell rungs (1–10).">
                    <input type="number" min={1} max={10} value={numLevels} onChange={(e) => setNumLevels(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Band (%)" hint="Furthest rung offset.">
                    <input type="number" value={bandPct} onChange={(e) => setBandPct(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Max Slippage (bps)">
                    <input type="number" value={maxSlippageBps} onChange={(e) => setMaxSlippageBps(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Size (USD)" required>
                    <input type="number" value={orderSizeUsd} onChange={(e) => setOrderSizeUsd(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Budget (USD)" required hint="Total spend cap.">
                    <input type="number" value={budgetUsd} onChange={(e) => setBudgetUsd(Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                  <Field label="Max Inventory (USD)" hint="Empty = no inventory cap.">
                    <input type="number" value={maxInventoryUsd} onChange={(e) => setMaxInventoryUsd(e.target.value === '' ? '' : Number(e.target.value))} className={INPUT_CLS} />
                  </Field>
                </div>
              </Panel>

              {/* Ladder preview */}
              <div className="nl-card p-4" style={BLUE_STRIDE}>
                <div className="text-xs uppercase tracking-wider text-white/60 font-bold mb-2">Ladder Preview</div>
                <p className="text-[11px] text-white/40 mb-3">
                  {refMode === 'manual'
                    ? `${numLevels} buy rung${numLevels === 1 ? '' : 's'} below / ${numLevels} sell above your reference.`
                    : 'Relative grid shape (×reference). Live market reference is applied at execution.'}
                </p>
                <div className="space-y-1 text-xs font-mono">
                  {sellRungs.slice().reverse().map((l) => (
                    <div key={`s${l.level}`} className="flex items-center justify-between rounded px-2 py-1 bg-red-500/[0.07]">
                      <span className="text-red-300 font-semibold uppercase tracking-wider text-[10px]">Sell · L{l.level}</span>
                      <span className="text-red-200">{refMode === 'manual' ? fmtPrice(l.targetPrice) : `×${l.targetPrice.toFixed(4)}`}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded px-2 py-1 bg-white/[0.06] my-1">
                    <span className="text-white/50 uppercase tracking-wider text-[10px] font-semibold">Reference</span>
                    <span className="text-white/80">{refMode === 'manual' ? fmtPrice(previewRef) : '×1.0000'}</span>
                  </div>
                  {buyRungs.map((l) => (
                    <div key={`b${l.level}`} className="flex items-center justify-between rounded px-2 py-1 bg-emerald-500/[0.07]">
                      <span className="text-emerald-300 font-semibold uppercase tracking-wider text-[10px]">Buy · L{l.level}</span>
                      <span className="text-emerald-200">{refMode === 'manual' ? fmtPrice(l.targetPrice) : `×${l.targetPrice.toFixed(4)}`}</span>
                    </div>
                  ))}
                  {ladder.length === 0 && (
                    <div className="text-white/40 text-center py-2">Set a positive reference + levels to preview the grid.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 sticky bottom-0 bg-[var(--nl-canvas-base,#050816)]/80 backdrop-blur">
          <button onClick={onClose} className="nl-button nl-button--ghost">Cancel</button>
          {validationError && <span className="flex-1 text-center text-[11px] text-amber-400 px-2">{validationError}</span>}
          <button onClick={handleSave} disabled={!canSave || saving} className="nl-btn-neon !px-6 !py-2.5 !text-sm font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {saving ? 'Creating…' : 'Create Strategy'}
          </button>
        </div>

        {/* Created-paused note */}
        <div className="px-5 pb-5">
          <p className="text-[11px] text-white/50 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
            New strategies are created paused — activate when your kernel is funded on this chain.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styling helpers (mirrors the design-system patterns) ──────────────

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder:text-white/40 focus:border-[var(--nl-blue,#0066FF)] focus:outline-none transition';

function SEG_CLS(active: boolean): string {
  return `px-3 py-2 rounded-lg border transition ${
    active
      ? 'border-[var(--nl-blue,#0066FF)]/60 bg-[var(--nl-blue,#0066FF)]/15 text-blue-100'
      : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20'
  }`;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="nl-card p-4" style={BLUE_STRIDE}>{children}</div>;
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
