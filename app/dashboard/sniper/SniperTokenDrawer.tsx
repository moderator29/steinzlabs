'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X, Loader2, ShieldCheck, ExternalLink, Copy, Check, ArrowUpRight, ArrowDownRight,
  Users, Layers, TrendingUp, TrendingDown, Bell,
} from 'lucide-react';
import { ChainLogo } from '@/components/common/ChainLogo';
import { type DetectedToken, fmtCompact, shortAddr } from './sniperShared';

const EXPLORER: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  bsc: 'https://bscscan.com',
  polygon: 'https://polygonscan.com',
  avalanche: 'https://snowtrace.io',
};
const addrLink = (chain: string, a: string) => `${EXPLORER[chain] ?? 'https://etherscan.io'}/address/${a}`;

interface SecurityDetail {
  score: number;
  level: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  honeypot: boolean;
  buyTax: number;
  sellTax: number;
  verified: boolean;
  mintable: boolean;
  holderCount: number;
  checks: { label: string; status: 'pass' | 'fail' | 'warn' }[];
  creatorAddress: string;
  creatorHoldingPct: number;
  relatedWallets: { address: string; percent: number; tag: string | null; isContract: boolean; isLocked: boolean }[];
}
interface MarketDetail {
  priceUsd: number | null; liquidity: number; marketCap: number | null; volume24h: number;
  priceChange24h: number; priceChange1h: number; pairCreatedAt: number | null;
  dexId: string; url: string; websites: { label: string; url: string }[];
}
interface SimilarToken {
  address: string; symbol: string; name: string; chain: string;
  priceUsd: number | null; liquidity: number; marketCap: number | null; logo: string | null; url: string;
}

function levelColor(level?: string) {
  return level === 'SAFE' ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
    : level === 'CAUTION' ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
    : level === 'WARNING' ? 'text-orange-300 border-orange-500/40 bg-orange-500/10'
    : 'text-red-300 border-red-500/40 bg-red-500/10';
}

export function SniperTokenDrawer({ token, onClose, onSnipe }: { token: DetectedToken; onClose: () => void; onSnipe: (t: DetectedToken) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [security, setSecurity] = useState<SecurityDetail | null>(null);
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [similar, setSimilar] = useState<SimilarToken[]>([]);
  const [copied, setCopied] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');
  const [alertState, setAlertState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams({ chain: token.chain, address: token.address, symbol: token.symbol });
    fetch(`/api/sniper/token-detail?${params.toString()}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) {
          setErr(r.status === 403 ? 'Sniper is a MAX-tier feature.' : (j?.error || 'Could not load token details.'));
          return;
        }
        setSecurity(j.security ?? null);
        setMarket(j.market ?? null);
        setSimilar(Array.isArray(j.similar) ? j.similar : []);
      })
      .catch(() => { if (alive) setErr('Network error loading token details.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token.chain, token.address, token.symbol]);

  const copyAddr = () => {
    navigator.clipboard?.writeText(token.address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const goBuy = () => router.push(`/dashboard/swap?buyToken=${token.address}&chain=${token.chain}`);
  const goSell = () => router.push(`/dashboard/swap?sellToken=${token.address}&chain=${token.chain}`);

  const saveAlert = async () => {
    const target = parseFloat(alertPrice);
    if (!isFinite(target) || target <= 0) { setAlertState('error'); return; }
    setAlertState('saving');
    try {
      const res = await fetch('/api/market/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: token.address, token_symbol: token.symbol, target_price: target, direction: alertDir, notify_email: false }),
      });
      if (!res.ok) throw new Error('failed');
      setAlertState('saved');
      window.setTimeout(() => { setAlertOpen(false); setAlertState('idle'); setAlertPrice(''); }, 1200);
    } catch {
      setAlertState('error');
    }
  };

  const price = market?.priceUsd ?? token.price ?? null;
  const change24 = market?.priceChange24h ?? 0;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto nl-glass border-l border-white/10 rounded-none p-5 animate-[slideIn_.18s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes slideIn{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {token.logo ? <img src={token.logo} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-white/70">{token.symbol.slice(0, 2)}</div>}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold truncate">{token.symbol}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40"><ChainLogo chain={token.chain} size={12} />{token.chain}</span>
              </div>
              <p className="text-xs text-white/50 truncate">{token.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Address row */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={copyAddr} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-white/60 hover:text-white">
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}{shortAddr(token.address)}
          </button>
          <a href={addrLink(token.chain, token.address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-blue-300 hover:text-blue-200">Explorer <ExternalLink className="w-3 h-3" /></a>
          {market?.url && <a href={market.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-blue-300 hover:text-blue-200">Chart <ExternalLink className="w-3 h-3" /></a>}
        </div>

        {/* Price + stats */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 mb-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Price</div>
              <div className="text-2xl font-extrabold">{price != null ? `$${price < 0.01 ? price.toPrecision(3) : price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : '—'}</div>
            </div>
            <div className={`inline-flex items-center gap-1 text-sm font-bold ${change24 >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {change24 >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{change24 >= 0 ? '+' : ''}{change24.toFixed(1)}%
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Stat label="Liquidity" value={fmtCompact(market?.liquidity ?? token.liquidity)} />
            <Stat label="Market Cap" value={fmtCompact(market?.marketCap ?? token.marketCap)} />
            <Stat label="24h Vol" value={fmtCompact(market?.volume24h ?? token.volume24h)} />
          </div>
        </div>

        {/* Buy / Sell */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={goBuy} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 font-bold text-sm hover:bg-emerald-500/25 transition"><ArrowUpRight className="w-4 h-4" /> Buy</button>
          <button onClick={goSell} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/12 border border-red-500/35 text-red-200 font-bold text-sm hover:bg-red-500/22 transition"><ArrowDownRight className="w-4 h-4" /> Sell</button>
        </div>
        <button onClick={() => onSnipe(token)} className="nl-btn-neon w-full py-2.5 rounded-xl font-bold text-sm mb-2">Create Sniper for {token.symbol}</button>

        {/* Set Alert */}
        {!alertOpen ? (
          <button onClick={() => setAlertOpen(true)} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 font-semibold text-sm hover:text-white hover:border-white/20 transition mb-4">
            <Bell className="w-4 h-4" /> Set Price Alert
          </button>
        ) : (
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
                <button onClick={() => setAlertDir('above')} className={`px-2.5 py-1.5 text-xs font-bold ${alertDir === 'above' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'}`}>Above</button>
                <button onClick={() => setAlertDir('below')} className={`px-2.5 py-1.5 text-xs font-bold ${alertDir === 'below' ? 'bg-red-500/20 text-red-300' : 'text-white/50'}`}>Below</button>
              </div>
              <input type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder={price ? String(price) : 'Target price $'} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#0066FF]/50 min-w-0" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveAlert} disabled={alertState === 'saving'} className="nl-btn-neon flex-1 py-2 rounded-lg font-bold text-xs disabled:opacity-50">
                {alertState === 'saving' ? 'Saving…' : alertState === 'saved' ? 'Saved ✓' : alertState === 'error' ? 'Try again' : 'Save Alert'}
              </button>
              <button onClick={() => { setAlertOpen(false); setAlertState('idle'); }} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 text-xs font-semibold">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-blue-400" /></div>
        ) : err ? (
          <div className="py-8 text-center text-sm text-white/55 rounded-xl border border-white/10 bg-white/[0.02]">{err}</div>
        ) : (
          <>
            {/* Shadow Guardian */}
            {security && (
              <Section icon={ShieldCheck} title="Shadow Guardian">
                <div className={`flex items-center justify-between rounded-lg border px-3 py-2 mb-2 ${levelColor(security.level)}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{security.level}</span>
                  <span className="text-sm font-extrabold">{security.score}/100</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {security.checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'pass' ? 'bg-emerald-400' : c.status === 'warn' ? 'bg-amber-400' : 'bg-red-400'}`} />
                      <span className="text-white/65 truncate">{c.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-white/55">
                  <span>Buy tax {security.buyTax}%</span><span>·</span><span>Sell tax {security.sellTax}%</span><span>·</span><span>{security.holderCount.toLocaleString()} holders</span>
                </div>
              </Section>
            )}

            {/* Related wallets (top holders) */}
            {security && security.relatedWallets.length > 0 && (
              <Section icon={Users} title="Related Wallets">
                <div className="space-y-1">
                  {security.relatedWallets.map((w) => (
                    <a key={w.address} href={addrLink(token.chain, w.address)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] text-xs">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span className="text-white/70 truncate">{shortAddr(w.address)}</span>
                        {w.tag && <span className="px-1 py-0.5 rounded bg-white/10 text-[9px] text-white/60">{w.tag}</span>}
                        {w.isContract && <span className="px-1 py-0.5 rounded bg-blue-500/15 text-[9px] text-blue-300">contract</span>}
                        {w.isLocked && <span className="px-1 py-0.5 rounded bg-emerald-500/15 text-[9px] text-emerald-300">locked</span>}
                      </span>
                      <span className="text-white/50 shrink-0">{w.percent.toFixed(2)}%</span>
                    </a>
                  ))}
                </div>
                {security.creatorAddress && (
                  <div className="mt-2 text-[10px] text-white/40">Creator {shortAddr(security.creatorAddress)} holds {security.creatorHoldingPct}%</div>
                )}
              </Section>
            )}

            {/* Similar tokens */}
            {similar.length > 0 && (
              <Section icon={Layers} title="Similar Tokens">
                <div className="space-y-1">
                  {similar.map((s) => (
                    <a key={`${s.chain}:${s.address}`} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
                      {s.logo ? <img src={s.logo} alt="" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-white/10" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{s.symbol} <span className="text-white/40 font-normal">{s.chain}</span></div>
                        <div className="text-[10px] text-white/45">Liq {fmtCompact(s.liquidity)} · MC {fmtCompact(s.marketCap)}</div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-white/30 shrink-0" />
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
