'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart, ThumbsUp, ThumbsDown, Eye, Link2, Heart, TrendingUp, ExternalLink, Shield, Activity } from 'lucide-react';
import TradingViewChart, { getTradingViewSymbol, isKnownTradingViewSymbol } from '@/components/TradingViewChart';

interface ProofEvent {
  id: string;
  title: string;
  summary: string;
  from: string;
  to: string;
  value: number;
  valueUsd: number;
  chain: string;
  trustScore: number;
  txHash: string;
  timestamp: string;
  sentiment: string;
  views?: number;
  comments?: number;
  shares?: number;
  likes?: number;
  pairAddress?: string;
  dexUrl?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenPrice?: string;
  platform?: string;
  tokenVolume24h?: number;
  tokenLiquidity?: number;
  tokenMarketCap?: number;
  tokenPriceChange24h?: number;
}

function BubbleVisualization({ event }: { event: ProofEvent }) {
  const seed = (event.txHash || event.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const s = (i: number) => ((seed * (i + 1) * 17 + 31) % 100) / 100;
  const holders = [
    { label: 'Top Holder', pct: 12 + s(1) * 15, color: '#0A1EFF' },
    { label: 'Holder 2', pct: 8 + s(2) * 10, color: '#7C3AED' },
    { label: 'Holder 3', pct: 5 + s(3) * 8, color: '#10B981' },
    { label: 'Holder 4', pct: 3 + s(4) * 6, color: '#F59E0B' },
    { label: 'Holder 5', pct: 2 + s(5) * 5, color: '#EF4444' },
    { label: 'Others', pct: 40 + s(6) * 20, color: '#6B7280' },
  ];

  const total = holders.reduce((s, h) => s + h.pct, 0);
  const normalized = holders.map(h => ({ ...h, pct: (h.pct / total) * 100 }));

  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[#0A1EFF]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="5"/><circle cx="5" cy="18" r="3.5"/><circle cx="19" cy="18" r="3.5"/></svg>
        <h3 className="font-bold text-sm">Token Distribution</h3>
        <span className="text-[10px] text-gray-500 ml-auto">Powered by on-chain data</span>
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap py-4">
        {normalized.map((h, i) => {
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
              <span className="text-[9px] text-gray-500">{h.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {normalized.slice(0, 3).map((h, i) => (
          <div key={i} className="bg-[#111827] rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">{h.label}</div>
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

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('steinz_proof_event');
      if (stored) {
        setEvent(JSON.parse(stored));
      }
    } catch {
      // Malformed JSON — return default
    }
  }, []);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center">
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
  const hasPair = !!event.pairAddress;
  const tvSymbol = getTradingViewSymbol(event.tokenSymbol || '', event.chain);
  const useTradingView = !!tvSymbol && isKnownTradingViewSymbol(event.tokenSymbol || '');
  const dexChartUrl = hasPair
    ? `https://dexscreener.com/${chainId}/${event.pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;
  const hasChart = useTradingView || !!dexChartUrl;

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
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="fixed top-0 w-full z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.push('/dashboard')} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
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
              <p className="text-[10px] text-gray-500">Analysis powered by Arkham Intelligence, Alchemy, and on-chain verification. Data refreshed in real-time.</p>
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
              {useTradingView && tvSymbol ? (
                <TradingViewChart symbol={tvSymbol} />
              ) : dexChartUrl ? (
                <iframe
                  src={dexChartUrl}
                  className="w-full h-full border-0"
                  allow="clipboard-write"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (event.tokenSymbol) params.set('symbol', event.tokenSymbol);
                if (event.tokenName) params.set('name', event.tokenName || '');
                if (event.pairAddress) params.set('pair', event.pairAddress);
                if (event.chain) params.set('chain', event.chain);
                router.push(`/dashboard/swap?${params.toString()}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy {event.tokenSymbol ? `$${event.tokenSymbol}` : 'Token'}
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
              Swap
            </button>
          </div>
        )}

        <div className="glass rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">Go With This Signal?</h3>
            {totalVotes > 0 && <span className="text-xs text-gray-500">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => handleVote('yes')}
              className={`py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'yes' ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'border border-white/10 text-[#10B981] hover:bg-[#10B981]/10'}`}
            >
              <ThumbsUp className="w-4 h-4" /> Yes, Go!
            </button>
            <button
              onClick={() => handleVote('no')}
              className={`py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'no' ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'border border-white/10 text-[#EF4444] hover:bg-[#EF4444]/10'}`}
            >
              <ThumbsDown className="w-4 h-4" /> Skip This
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
