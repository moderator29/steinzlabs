'use client';

import { X, ExternalLink, CheckCircle, ThumbsUp, ThumbsDown, Eye, Link2, Heart, ShoppingCart, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import TradingViewChart, { getTradingViewSymbol, isKnownTradingViewSymbol } from './TradingViewChart';

interface ViewProofEvent {
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
  views: number;
  comments: number;
  shares: number;
  likes: number;
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

interface ViewProofModalProps {
  event: ViewProofEvent;
  onClose: () => void;
}

export default function ViewProofModal({ event, onClose }: ViewProofModalProps) {
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);
  const [yesVotes, setYesVotes] = useState(0);
  const [noVotes, setNoVotes] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const totalVotes = yesVotes + noVotes;
  const yesPct = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50;

  const trustColor = event.trustScore >= 70 ? '#10B981' : event.trustScore >= 40 ? '#F59E0B' : '#EF4444';
  const trustLabel = event.trustScore >= 70 ? 'TRUSTED' : event.trustScore >= 40 ? 'CAUTION' : 'DANGER';

  const chainId = event.chain || 'solana';
  const hasPair = !!event.pairAddress;
  const tvSymbol = getTradingViewSymbol(event.tokenSymbol || '', event.chain);
  const useTradingView = !!tvSymbol && isKnownTradingViewSymbol(event.tokenSymbol || '');
  const dexChartUrl = hasPair
    ? `https://dexscreener.com/${chainId}/${event.pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;
  const hasChart = useTradingView || !!dexChartUrl;

  const dexPageUrl = event.dexUrl || (hasPair ? `https://dexscreener.com/${chainId}/${event.pairAddress}` : null);

  const explorerUrl = chainId === 'ethereum'
    ? `https://etherscan.io/tx/${event.txHash}`
    : chainId === 'solana'
    ? `https://solscan.io/tx/${event.txHash}`
    : chainId === 'bsc'
    ? `https://bscscan.com/tx/${event.txHash}`
    : `https://etherscan.io/tx/${event.txHash}`;

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

  const fmtNum = (n: number) => {
    if (!n) return '$0';
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const chartHeight = isFullScreen ? 520 : 420;

  if (isFullScreen && hasChart) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center"
        onClick={() => setIsFullScreen(false)}
      >
        <div
          className="bg-[#0B0D14] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold">{event.tokenName || event.tokenSymbol || 'Chart'}</h2>
                <p className="text-[10px] text-gray-500">
                  {event.tokenSymbol ? `$${event.tokenSymbol}` : ''} · {useTradingView ? 'TradingView Advanced' : 'DexScreener'} · Full Screen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullScreen(false)}
                className="hover:bg-white/10 p-2 rounded-lg transition-colors"
                title="Exit Full Screen"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="w-full" style={{ height: `${chartHeight}px` }}>
            {useTradingView && tvSymbol ? (
              <TradingViewChart symbol={tvSymbol} height={chartHeight} showTools />
            ) : dexChartUrl ? (
              <iframe
                src={dexChartUrl}
                className="w-full h-full border-0"
                title="DexScreener Chart"
                allow="clipboard-write"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            ) : null}
          </div>
          {(event.tokenVolume24h || event.tokenLiquidity || event.tokenMarketCap) && (
            <div className="flex items-center gap-3 px-5 py-3 border-t border-white/10">
              {event.tokenPrice && <span className="text-sm font-mono text-white">{event.tokenPrice}</span>}
              {event.tokenPriceChange24h ? (
                <span className={`text-sm font-semibold ${(event.tokenPriceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {(event.tokenPriceChange24h || 0) >= 0 ? '+' : ''}{event.tokenPriceChange24h?.toFixed(1)}%
                </span>
              ) : null}
              {event.tokenVolume24h ? <span className="text-xs text-gray-400">Vol: {fmtNum(event.tokenVolume24h)}</span> : null}
              {event.tokenLiquidity ? <span className="text-xs text-gray-400">Liq: {fmtNum(event.tokenLiquidity)}</span> : null}
              {event.tokenMarketCap ? <span className="text-xs text-gray-400">MCap: {fmtNum(event.tokenMarketCap)}</span> : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#0B0D14] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0B0D14] border-b border-white/10 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-[#00D4AA] to-[#6366F1] rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">{event.tokenName || 'On-Chain Proof'}</h2>
              <p className="text-[10px] text-gray-500 truncate">
                {event.tokenSymbol ? `$${event.tokenSymbol}` : 'Verified by Naka AI'}
                {event.tokenPrice ? ` · ${event.tokenPrice}` : ''}
                {event.platform ? ` · ${event.platform}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="glass rounded-xl p-4 border border-white/10 overflow-hidden">
            <div className="flex items-start justify-between mb-2 gap-2">
              <h3 className="font-bold text-sm flex-1 break-words line-clamp-2">{event.title}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0" style={{ backgroundColor: `${trustColor}20`, color: trustColor }}>
                VERIFIED
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed break-words line-clamp-3">{event.summary}</p>

            {(event.tokenVolume24h || event.tokenLiquidity || event.tokenMarketCap) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {event.tokenVolume24h ? (
                  <span className="px-2 py-1 bg-[#111827] rounded text-[10px] text-gray-300">Vol: {fmtNum(event.tokenVolume24h)}</span>
                ) : null}
                {event.tokenLiquidity ? (
                  <span className="px-2 py-1 bg-[#111827] rounded text-[10px] text-gray-300">Liq: {fmtNum(event.tokenLiquidity)}</span>
                ) : null}
                {event.tokenMarketCap ? (
                  <span className="px-2 py-1 bg-[#111827] rounded text-[10px] text-gray-300">MCap: {fmtNum(event.tokenMarketCap)}</span>
                ) : null}
                {event.tokenPriceChange24h ? (
                  <span className={`px-2 py-1 bg-[#111827] rounded text-[10px] ${(event.tokenPriceChange24h || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {(event.tokenPriceChange24h || 0) >= 0 ? '+' : ''}{event.tokenPriceChange24h?.toFixed(1)}% 24h
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {hasChart && (
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Live Chart</h3>
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[9px] font-bold">LIVE</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{event.tokenSymbol ? `$${event.tokenSymbol}` : chainId} · {useTradingView ? 'TradingView' : 'DexScreener'}</span>
                  <button
                    onClick={() => setIsFullScreen(true)}
                    className="hover:bg-white/10 p-1.5 rounded-lg transition-colors text-gray-400 hover:text-white"
                    title="Full Screen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {useTradingView && tvSymbol ? (
                <TradingViewChart symbol={tvSymbol} height={420} showTools />
              ) : dexChartUrl ? (
                <div className="w-full" style={{ height: '380px' }}>
                  <iframe
                    src={dexChartUrl}
                    className="w-full h-full border-0"
                    title="DexScreener Chart"
                    allow="clipboard-write"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              ) : null}
            </div>
          )}

          {dexPageUrl && (
            <div className="flex gap-2">
              <a
                href={dexPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#00D4AA] to-[#6366F1] rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Buy {event.tokenSymbol ? `$${event.tokenSymbol}` : 'Token'}
              </a>
              <a
                href={dexPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-3 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                DexScreener
              </a>
            </div>
          )}

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: trustColor }} className="text-lg">✅</span>
              <h3 className="font-bold text-sm">Trust Score</h3>
            </div>
            <div className="flex items-center justify-center mb-2">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2235" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={trustColor} strokeWidth="8" strokeDasharray={`${event.trustScore * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: trustColor }}>{event.trustScore}%</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <span className="text-sm font-bold" style={{ color: trustColor }}>{trustLabel}</span>
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <h3 className="font-bold text-sm mb-3">Blockchain Verification</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Tx / Token</div>
                <div className="text-xs font-mono truncate">{event.tokenSymbol ? `$${event.tokenSymbol}` : `${event.txHash.slice(0, 8)}...${event.txHash.slice(-4)}`}</div>
              </div>
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Chain</div>
                <div className="text-xs font-mono">{chainId}</div>
              </div>
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Timestamp</div>
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
                className="flex items-center justify-center gap-1.5 py-2 border border-[#00D4AA]/30 rounded-lg text-[#00D4AA] text-xs font-semibold hover:bg-[#00D4AA]/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on {chainId === 'solana' ? 'Solscan' : 'Etherscan'}
              </a>
            )}
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">Go With This Signal?</h3>
              {totalVotes > 0 && <span className="text-xs text-gray-500">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => handleVote('yes')}
                className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'yes' ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'border border-white/10 text-[#10B981] hover:bg-[#10B981]/10'}`}
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Yes, Go!
              </button>
              <button
                onClick={() => handleVote('no')}
                className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${voted === 'no' ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'border border-white/10 text-[#EF4444] hover:bg-[#EF4444]/10'}`}
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Skip This
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

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 glass px-4 py-3 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">
              Close
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500 pb-2">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(event.views ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> {(event.shares ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {(event.likes ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
