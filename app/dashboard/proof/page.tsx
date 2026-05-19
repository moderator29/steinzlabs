'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, ThumbsUp, ThumbsDown, Eye, Link2, Heart, TrendingUp, ExternalLink, Shield, Activity, X } from 'lucide-react';
import { z } from 'zod';
import BackButton from '@/components/ui/BackButton';
import TradingViewChart, { getTradingViewSymbol, isKnownTradingViewSymbol } from '@/components/TradingViewChart';
import { SwapCard, type SwapCardData } from '@/components/vtx/SwapCard';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';

// §11 — lightweight-charts wrapper for the proof modal. Lazy-loaded
// so the chart bundle ships only when a user opens the proof drawer.
const ProofAdvancedChart = dynamic(
  () => import('@/components/trading/AdvancedChart').then(m => {
    const C = m.AdvancedChart;
    return function ProofChart({ chain, token }: { chain: string; token: string }) {
      return <C chain={chain} token={token} tf="1h" chartType="candlestick" indicators={{ ema21: true, ema50: true, volume: true }} height={400} />;
    };
  }),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Loading chart…</div> },
);

// Bounded string — caps every user-visible text field so a malicious
// sessionStorage payload can't blow out the layout or smuggle a
// multi-megabyte string into React render. Trims to a sane length and
// strips HTML-ish characters; we never dangerouslySetInnerHTML, but
// belt-and-braces against future regressions.
const safeText = (max: number) => z
  .string()
  .max(max)
  .transform((s) => s.replace(/<[^>]*>/g, '').trim());

const safeUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'http(s) only')
  .optional();

// Audit P0 — proof event used to be JSON.parsed straight out of
// sessionStorage and rendered as-is. An attacker who could trigger any
// JS on the origin (XSS chain, browser extension) could craft a fake
// event with overlong fields, malicious URLs, or invalid structure
// that crashed React or smuggled an attacker-controlled link past the
// trust badge. Zod schema rejects malformed events at parse time.
//
// Note: tokenAddress carries the contract for the bubble-viz holder
// fetch (see BubbleVisualization). Added alongside the Zod hardening
// so on-chain top-holder data renders instead of fabricated seeds.
const ProofEventSchema = z.object({
  id: safeText(128),
  title: safeText(280),
  summary: safeText(2000),
  from: safeText(128),
  to: safeText(128),
  value: z.number().finite(),
  valueUsd: z.number().finite(),
  chain: safeText(32),
  trustScore: z.number().min(0).max(100),
  txHash: safeText(128),
  timestamp: safeText(64),
  sentiment: safeText(32),
  views: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  pairAddress: safeText(128).optional(),
  tokenAddress: safeText(128).optional(),
  dexUrl: safeUrl,
  tokenName: safeText(128).optional(),
  tokenSymbol: safeText(32).optional(),
  tokenPrice: safeText(64).optional(),
  platform: safeText(64).optional(),
  tokenVolume24h: z.number().finite().optional(),
  tokenLiquidity: z.number().finite().optional(),
  tokenMarketCap: z.number().finite().optional(),
  tokenPriceChange24h: z.number().finite().optional(),
});

type ProofEvent = z.infer<typeof ProofEventSchema>;

// Build the SwapCard payload from a context-feed proof event. The
// receive-side (toToken) comes from the event; the pay-side defaults
// to a sensible quote per chain. SwapCard fetches the real quote +
// balance once it mounts, so these initial numbers are placeholders
// the card overwrites within ~200ms.
function buildProofSwapData(event: ProofEvent): SwapCardData | null {
  // Deep-dive fix — the card needs at least a destination identity. Without
  // tokenSymbol AND pairAddress AND tokenName the card mounts with 'TOKEN'
  // as the receive ticker, which is a fake state the user should never see.
  // Return null instead and let the caller hide the Buy block.
  if (!event.tokenSymbol && !event.pairAddress && !event.tokenName) return null;
  const chain = (event.chain || 'ethereum').toLowerCase();
  const fromToken = chain === 'solana' ? 'SOL' : 'USDC';
  const toToken = (event.tokenSymbol || event.tokenName || '').trim();
  return {
    fromToken,
    toToken: toToken || 'TOKEN', // last-resort label — never null
    toTokenAddress: event.pairAddress,
    fromAmount: '0',
    toAmount: '0',
    rate: '—',
    priceImpact: 0,
    platformFee: '0.30%',
    chain,
  };
}

function BubbleVisualization({ event }: { event: ProofEvent }) {
  const tokenAddress = event.tokenAddress;
  const chain = event.chain || 'ethereum';

  type Holder = { label: string; pct: number; color: string; address?: string };
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenAddress);
  const [errored, setErrored] = useState<boolean>(false);

  useEffect(() => {
    if (!tokenAddress) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const palette = ['#0A1EFF', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];
    (async () => {
      try {
        const res = await fetch(
          `/api/bubble-map?address=${encodeURIComponent(tokenAddress)}&chain=${encodeURIComponent(chain)}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const top = Array.isArray(data?.holders) ? data.holders.slice(0, 5) : [];
        if (top.length === 0) throw new Error('empty holders');
        const totalTop = top.reduce((s: number, h: { percent?: number }) => s + (h.percent ?? 0), 0);
        const rest = Math.max(0, 100 - totalTop);
        const mapped: Holder[] = top.map((h: { percent?: number; address?: string; label?: string }, i: number) => ({
          label: h.label || `Holder ${i + 1}`,
          pct: h.percent ?? 0,
          color: palette[i % palette.length],
          address: h.address,
        }));
        if (rest > 0) mapped.push({ label: 'Others', pct: rest, color: '#6B7280' });
        if (!cancelled) setHolders(mapped);
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, chain]);

  if (!tokenAddress || errored || (!loading && !holders)) {
    return (
      <div className="glass rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-[#0A1EFF]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><circle cx="5" cy="18" r="3.5"/><circle cx="19" cy="18" r="3.5"/></svg>
          <h3 className="font-bold text-sm">Token Distribution</h3>
        </div>
        <p className="text-[11px] text-gray-400">
          Holder distribution unavailable for this event.
        </p>
      </div>
    );
  }

  if (loading || !holders) {
    return (
      <div className="glass rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-[#0A1EFF]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><circle cx="5" cy="18" r="3.5"/><circle cx="19" cy="18" r="3.5"/></svg>
          <h3 className="font-bold text-sm">Token Distribution</h3>
        </div>
        <p className="text-[11px] text-gray-500">Loading on-chain holders…</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[#0A1EFF]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><circle cx="5" cy="18" r="3.5"/><circle cx="19" cy="18" r="3.5"/></svg>
        <h3 className="font-bold text-sm">Token Distribution</h3>
        <span className="text-[10px] text-emerald-400/80 ms-auto">On-chain (top 5 + rest)</span>
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap py-4">
        {holders.map((h, i) => {
          const size = Math.max(36, Math.min(90, h.pct * 1.2));
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-transform hover:scale-110"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: `${h.color}20`,
                  borderColor: `${h.color}60`,
                  color: h.color,
                }}
              >
                {h.pct.toFixed(1)}%
              </div>
              <span className="text-[9px] text-gray-400">{h.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {holders.slice(0, 3).map((h, i) => (
          <div key={i} className="bg-[#111827] rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-400">{h.label}</div>
            <div className="text-xs font-bold" style={{ color: h.color }}>{h.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ViewProofPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<ProofEvent | null>(null);
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);
  const [yesVotes, setYesVotes] = useState(0);
  const [noVotes, setNoVotes] = useState(0);
  // Inline swap card — when the user clicks Buy we expand the same
  // SwapCard that VTX AI uses (components/vtx/SwapCard.tsx) instead of
  // routing them away to /dashboard/swap. The card auto-detects balance,
  // fetches a live quote on mount, and signs in-place; user never leaves
  // the proof modal.
  const [showSwapCard, setShowSwapCard] = useState(false);
  const naka = useNakaWallet();
  const walletAddress = naka.address;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('steinz_proof_event');
      if (stored) {
        const raw = JSON.parse(stored);
        // Validate structure before rendering. If a field is malformed
        // we fall through to the "Event not found" screen rather than
        // crashing or rendering attacker-shaped data.
        const parsed = ProofEventSchema.safeParse(raw);
        if (parsed.success) setEvent(parsed.data);
      }
    } catch {
      // Malformed JSON — fall through to not-found state.
    }
    // Bug §6.3 — testers reported the Explain button scrolling them to
    // the middle of the AI view with no scrollbar. The page itself was
    // fine; what was missing was an explicit scroll-to-top on mount so
    // the view always starts at the title, never mid-content.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  if (!event) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Event not found</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-[#0A1EFF] rounded-lg text-sm font-semibold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const trustColor = event.trustScore >= 70 ? '#10B981' : event.trustScore >= 40 ? '#F59E0B' : '#EF4444';
  const trustLabel = event.trustScore >= 70 ? 'TRUSTED' : event.trustScore >= 40 ? 'CAUTION' : 'DANGER';
  const chainId = event.chain || 'ethereum';
  const tvSymbol = getTradingViewSymbol(event.tokenSymbol || '', event.chain);
  const useTradingView = !!tvSymbol && isKnownTradingViewSymbol(event.tokenSymbol || '');
  // §11 — dexChartUrl removed; AdvancedChart fetches its own OHLCV
  // via /api/market/ohlcv. We still need to know whether to render
  // the chart container at all (avoids an empty 400px hole).
  const hasChart = useTradingView || !!event.pairAddress;

  const explorerUrl = chainId === 'ethereum'
    ? `https://etherscan.io/tx/${event.txHash}`
    : chainId === 'solana'
    ? `https://solscan.io/tx/${event.txHash}`
    : chainId === 'bsc'
    ? `https://bscscan.com/tx/${event.txHash}`
    : `https://etherscan.io/tx/${event.txHash}`;

  const totalVotes = yesVotes + noVotes;
  const yesPct = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50;

  const handleVote = (vote: 'yes' | 'no') => {
    if (voted) return;
    setVoted(vote);
    if (vote === 'yes') setYesVotes(prev => prev + 1);
    else setNoVotes(prev => prev + 1);
  };

  const timeAgo = () => {
    const diff = Date.now() - new Date(event.timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const sentimentColor = event.sentiment === 'BULLISH' ? '#10B981' : event.sentiment === 'BEARISH' ? '#EF4444' : '#F59E0B';

  return (
    <div className="min-h-screen text-white">
      <div className="fixed top-0 w-full z-40 bg-[#0A0E27]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Bug §6.3 — testers wanted an explicit "Back to Feed" path so
              they don't land on dashboard overview after explaining a
              signal. Routes through ?subtab=context which the dashboard
              page reads on mount and switches to the Context Feed sub-tab.
              The Context Feed itself restores its own scroll/filter state
              from sessionStorage (Bug §6.2). */}
          <BackButton href="/dashboard?subtab=context" label="Back to Feed" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">View Proof</h1>
            <p className="text-[10px] text-gray-500">{event.tokenSymbol ? `$${event.tokenSymbol}` : 'Intelligence Report'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: sentimentColor }}></div>
            <span className="text-[10px] font-semibold" style={{ color: sentimentColor }}>{event.sentiment}</span>
          </div>
        </div>
      </div>

      <div className="pt-[68px] pb-8 px-4 max-w-3xl mx-auto space-y-4">
        <div className="glass rounded-xl p-4 border border-white/10">
          <h2 className="text-lg font-bold mb-2">{event.title}</h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-3">{event.summary}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{timeAgo()}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${sentimentColor}15`, color: sentimentColor }}>
              {chainId.toUpperCase()}
            </span>
            {event.platform && <span>{event.platform}</span>}
          </div>
        </div>

        {event.tokenSymbol && (
          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0A1EFF]" />
              AI Intelligence Analysis
            </h3>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <p>
                {event.tokenSymbol} on {chainId} chain is showing {event.sentiment?.toLowerCase()} signals.
                {event.tokenPrice ? ` Currently trading at ${event.tokenPrice}.` : ''}
                {event.tokenPriceChange24h ? ` 24-hour price change: ${event.tokenPriceChange24h > 0 ? '+' : ''}${event.tokenPriceChange24h.toFixed(2)}%.` : ''}
              </p>
              {event.tokenVolume24h && event.tokenVolume24h > 0 && (
                <p>24-hour trading volume stands at ${event.tokenVolume24h.toLocaleString()}, {event.tokenVolume24h > 1000000 ? 'indicating strong institutional-grade market activity with deep order book depth' : 'suggesting moderate retail trading interest with some volatility potential'}. Volume-to-market-cap ratio {event.tokenMarketCap && event.tokenMarketCap > 0 ? `is ${((event.tokenVolume24h / event.tokenMarketCap) * 100).toFixed(1)}%` : 'suggests active trading'}, which is {event.tokenVolume24h > (event.tokenMarketCap || 1) * 0.1 ? 'above average, signaling heightened interest' : 'within normal range'}.</p>
              )}
              {event.tokenLiquidity && event.tokenLiquidity > 0 && (
                <p>Liquidity pool depth: ${event.tokenLiquidity.toLocaleString()}. {event.tokenLiquidity > 500000 ? 'Deep liquidity pools ensure minimal slippage for trades up to $50K. Multiple LP providers are contributing to price stability.' : 'Lower liquidity detected. Trades above $5K may experience 1-3% slippage. Consider splitting larger orders across multiple transactions.'}</p>
              )}
              {event.tokenMarketCap && event.tokenMarketCap > 0 && (
                <p>Market capitalization: ${event.tokenMarketCap.toLocaleString()}. {event.tokenMarketCap > 1e9 ? 'Large-cap asset with established market presence and institutional coverage.' : event.tokenMarketCap > 100e6 ? 'Mid-cap asset with growth potential and increasing market attention.' : 'Small-cap asset with higher volatility. Risk-reward ratio is elevated.'}</p>
              )}
              <p>
                Trust assessment: {event.trustScore}% confidence rating ({trustLabel}).
                {event.trustScore >= 70 ? ' On-chain indicators support the reliability of this signal. Contract verification, holder distribution, and trading patterns all pass our security checks.' : event.trustScore >= 40 ? ' Exercise standard due diligence before acting on this signal. Some on-chain metrics show mixed signals that warrant closer monitoring.' : ' Multiple risk factors detected. Holder concentration, contract permissions, or trading patterns show concerning patterns. Proceed with extreme caution and use small position sizes.'}
              </p>
              <div className="bg-white/[0.03] rounded-lg p-3 mt-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Signal Assessment</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-gray-500">Confidence</span><span className="font-semibold" style={{ color: trustColor }}>{event.trustScore}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sentiment</span><span className="font-semibold" style={{ color: sentimentColor }}>{event.sentiment}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Chain</span><span className="font-semibold text-white">{chainId}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Value</span><span className="font-semibold text-white">${event.valueUsd?.toLocaleString()}</span></div>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">Analysis powered by Naka Labs on-chain verification. Data refreshed in real-time.</p>
            </div>
          </div>
        )}

        {(event.tokenVolume24h || event.tokenLiquidity || event.tokenMarketCap) && (
          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              Market Data
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {event.tokenPrice && (
                <div className="bg-[#111827] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-1">Price</div>
                  <div className="text-sm font-bold font-mono text-white">{event.tokenPrice}</div>
                  {event.tokenPriceChange24h !== undefined && (
                    <div className={`text-[10px] font-semibold mt-0.5 ${event.tokenPriceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {event.tokenPriceChange24h >= 0 ? '+' : ''}{event.tokenPriceChange24h.toFixed(2)}% (24h)
                    </div>
                  )}
                </div>
              )}
              {event.tokenMarketCap && event.tokenMarketCap > 0 && (
                <div className="bg-[#111827] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-1">Market Cap</div>
                  <div className="text-sm font-bold font-mono text-white">${event.tokenMarketCap >= 1000000000 ? `${(event.tokenMarketCap / 1000000000).toFixed(2)}B` : event.tokenMarketCap >= 1000000 ? `${(event.tokenMarketCap / 1000000).toFixed(1)}M` : event.tokenMarketCap.toLocaleString()}</div>
                </div>
              )}
              {event.tokenVolume24h && event.tokenVolume24h > 0 && (
                <div className="bg-[#111827] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-1">24h Volume</div>
                  <div className="text-sm font-bold font-mono text-white">${event.tokenVolume24h >= 1000000 ? `${(event.tokenVolume24h / 1000000).toFixed(1)}M` : event.tokenVolume24h >= 1000 ? `${(event.tokenVolume24h / 1000).toFixed(0)}K` : event.tokenVolume24h.toLocaleString()}</div>
                </div>
              )}
              {event.tokenLiquidity && event.tokenLiquidity > 0 && (
                <div className="bg-[#111827] rounded-lg p-3">
                  <div className="text-[10px] text-gray-500 mb-1">Liquidity</div>
                  <div className="text-sm font-bold font-mono text-white">${event.tokenLiquidity >= 1000000 ? `${(event.tokenLiquidity / 1000000).toFixed(1)}M` : event.tokenLiquidity >= 1000 ? `${(event.tokenLiquidity / 1000).toFixed(0)}K` : event.tokenLiquidity.toLocaleString()}</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${event.tokenLiquidity > 500000 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                    {event.tokenLiquidity > 500000 ? 'Deep liquidity' : 'Low liquidity'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {hasChart && (
          <div className="glass rounded-xl border border-white/10 overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <h3 className="font-bold text-sm">Price Chart</h3>
            </div>
            <div style={{ height: 400 }}>
              {/* §11 — replaced DexScreener iframe with native
                  AdvancedChart (lightweight-charts). Falls back to
                  TradingViewChart for known top-50 symbols since the
                  TV widget is a script-loader (heavier but already
                  loaded for the trading page) — DexScreener iframe
                  is unconditionally removed. */}
              {useTradingView && tvSymbol ? (
                <TradingViewChart symbol={tvSymbol} />
              ) : event.pairAddress ? (
                <ProofAdvancedChart chain={chainId} token={event.pairAddress} />
              ) : null}
            </div>
          </div>
        )}

        <BubbleVisualization event={event} />

        <div className="glass rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: trustColor }} className="text-lg"><Shield className="w-5 h-5" /></span>
            <h3 className="font-bold text-sm">Trust Score</h3>
          </div>
          <div className="flex items-center justify-center mb-3">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={trustColor} strokeWidth="8" strokeDasharray={`${event.trustScore * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: trustColor }}>{event.trustScore}%</span>
              </div>
            </div>
          </div>
          <div className="text-center mb-3">
            <span className="text-sm font-bold" style={{ color: trustColor }}>{trustLabel}</span>
          </div>
        </div>

        <div className="glass rounded-xl p-4 border border-white/10">
          <h3 className="font-bold text-sm mb-3">Blockchain Verification</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#111827] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Token</div>
              <div className="text-xs font-mono truncate">{event.tokenSymbol ? `$${event.tokenSymbol}` : `${event.txHash.slice(0, 8)}...${event.txHash.slice(-4)}`}</div>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Chain</div>
              <div className="text-xs font-mono">{chainId}</div>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Time</div>
              <div className="text-xs font-mono">{timeAgo()}</div>
            </div>
            <div className="bg-[#111827] rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Value</div>
              <div className="text-xs font-mono">${event.valueUsd.toLocaleString()}</div>
            </div>
          </div>
          {event.txHash && event.txHash.startsWith('0x') && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 border border-[#0A1EFF]/30 rounded-lg text-[#0A1EFF] text-xs font-semibold hover:bg-[#0A1EFF]/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on {chainId === 'solana' ? 'Solscan' : 'Etherscan'}
            </a>
          )}
        </div>

        {(event.tokenSymbol || event.pairAddress) && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSwapCard((v) => !v)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all"
              >
                {showSwapCard ? <X className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                {showSwapCard ? 'Hide swap' : `Buy ${event.tokenSymbol ? `$${event.tokenSymbol}` : 'Token'}`}
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (event.tokenSymbol) params.set('symbol', event.tokenSymbol);
                  if (event.chain) params.set('chain', event.chain);
                  router.push(`/dashboard/swap?${params.toString()}`);
                }}
                className="flex items-center justify-center gap-1.5 px-5 py-3 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                Open full swap
              </button>
            </div>
            {showSwapCard && (() => {
              // Deep-dive fix — buildProofSwapData can now return null when
              // the event lacks a coherent destination token. Render a
              // friendly "swap data unavailable" panel instead of mounting
              // SwapCard with a placeholder 'TOKEN' ticker that would let a
              // user click Sign on garbage.
              const swap = buildProofSwapData(event);
              if (!swap) {
                return (
                  <div className="glass rounded-xl p-3 border border-amber-400/30 text-[11px] text-amber-300">
                    Swap unavailable — this signal doesn&apos;t carry a
                    resolvable token. Open the full swap if you want to pick
                    a token manually.
                  </div>
                );
              }
              return (
                <div className="glass rounded-xl p-3 border border-white/10">
                  {/*
                    Inline swap — uses the same SwapCard component VTX AI
                    renders inside agent messages. fromToken defaults to
                    the chain's native quote (USDC for EVM, SOL for Solana
                    context — SOL is the routing native and the card flips
                    to USDC if needed). toToken / toTokenAddress / chain
                    come straight from the context-feed event so there's
                    no DexScreener iframe and no page navigation.
                  */}
                  <SwapCard
                    swap={swap}
                    walletAddress={walletAddress ?? undefined}
                    onCancel={() => setShowSwapCard(false)}
                  />
                </div>
              );
            })()}
          </>
        )}

        {/* Bug §6.5 — "Go With This Signal?" was ambiguous to testers
            (does it execute a trade? follow? upvote?). It is a community
            sentiment poll. Renamed to "Endorse Signal" with subtitle and
            tooltip making the action explicit, and the buttons relabeled
            from "Yes, Go! / Skip This" to "Bullish / Bearish" so the
            semantic is unmistakable. */}
        <div
          className="glass rounded-xl p-4 border border-white/10"
          title="Endorse Signal: vote bullish or bearish to share your read with the community. This is a sentiment poll, not a trade."
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm">Endorse Signal</h3>
            {totalVotes > 0 && <span className="text-xs text-gray-500">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>}
          </div>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            Community sentiment poll — this does not place a trade. Use Swap above to act.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => handleVote('yes')}
              className={`py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'yes' ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'border border-white/10 text-[#10B981] hover:bg-[#10B981]/10'}`}
            >
              <ThumbsUp className="w-4 h-4" /> Bullish
            </button>
            <button
              onClick={() => handleVote('no')}
              className={`py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'no' ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'border border-white/10 text-[#EF4444] hover:bg-[#EF4444]/10'}`}
            >
              <ThumbsDown className="w-4 h-4" /> Bearish
            </button>
          </div>
          {totalVotes > 0 && (
            <>
              <div className="flex rounded-full h-2 overflow-hidden">
                <div className="bg-[#10B981]" style={{ width: `${yesPct}%` }}></div>
                <div className="bg-[#EF4444]" style={{ width: `${100 - yesPct}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] mt-1">
                <span className="text-[#10B981]">{yesPct}% Bullish ({yesVotes})</span>
                <span className="text-[#EF4444]">{100 - yesPct}% Bearish ({noVotes})</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pb-4">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {(event.views ?? 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> {(event.shares ?? 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {(event.likes ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
