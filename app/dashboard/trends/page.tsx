'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, RefreshCw, Bell, Activity, BarChart3, X, ChevronRight, ExternalLink } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { AiInsightCard } from '@/components/ai/AiInsightCard';
import { trendsHowItWorks } from '@/lib/howItWorks/content/trends';
import { useNavState } from '@/lib/nav/useNavState';
import type { TrendCard, TrendAlertItem, TrendsResponse, TrendSparkpoint } from '@/app/api/intelligence/on-chain-trends/route';

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color, height = 36 }: { points: TrendSparkpoint[]; color: string; height?: number }) {
  if (!points.length) return <div style={{ height }} />;
  const vals = points.map(p => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 80, H = height;
  const coords = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * H * 0.9;
    return `${x},${y}`;
  });
  const pathD = `M ${coords.join(' L ')}`;
  const fillD = `M 0,${H} L ${coords.join(' L ')} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 flex-shrink-0" style={{ height }}>
      <defs>
        <linearGradient id={`sg-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#sg-${color.slice(1)})`} />
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Momentum badge ───────────────────────────────────────────────────────────
// Colours a 0–100 real-signal composite. 50 = neutral; green = accelerating,
// red = falling. Only shown when the API resolved at least one real signal.

function momentumColor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 58) return '#34D399';
  if (score >= 43) return '#9CA3AF';
  if (score >= 30) return '#F59E0B';
  return '#EF4444';
}

function MomentumBadge({ score, label }: { score: number; label?: string }) {
  const c = momentumColor(score);
  return (
    <div className="inline-flex items-center gap-1.5" title="Composite of real signals: TVL, native-asset price, and social sentiment">
      <div className="relative w-10 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: c }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color: c }}>{label ?? score}</span>
    </div>
  );
}

// ─── VTX Insight Card ─────────────────────────────────────────────────────────

function InsightCard({ card, onSelect }: { card: TrendCard; onSelect: (c: TrendCard) => void }) {
  const up = card.direction === 'up';
  const down = card.direction === 'down';
  const color = up ? '#10B981' : down ? '#EF4444' : '#6B7280';
  const sparkColor = card.hot ? (up ? '#10B981' : '#EF4444') : '#3B82F6';

  return (
    // Hot cards get a colored ring. The old `'border-[' + color + ']/30'`
    // string concat produced a class Tailwind never generates (no-op) — use an
    // inline boxShadow ring in the move color instead so hot cards actually glow.
    <div className="nl-glass rounded-2xl p-4 transition-all hover:border-white/[0.16] cursor-pointer active:scale-[0.99]"
      style={{ boxShadow: card.hot
        ? `0 0 0 1px ${color}55, 0 0 18px ${color}33`
        : '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
      onClick={() => onSelect(card)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold text-white">{card.chain}</span>
            {card.hot && <Zap className="w-3 h-3 text-[#F59E0B]" />}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{card.metric}</div>
        </div>
        <Sparkline points={card.sparkline} color={sparkColor} />
      </div>

      <div className="text-2xl font-bold text-white mb-2">{card.value}</div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1 text-xs font-semibold ${up ? 'text-[#10B981]' : down ? 'text-[#EF4444]' : 'text-gray-500'}`}>
          {up ? <TrendingUp className="w-3 h-3" /> : down ? <TrendingDown className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
          {card.change24h > 0 ? '+' : ''}{card.change24h.toFixed(2)}%
          <span className="text-gray-600 font-normal">24h</span>
        </div>
        <div className={`text-xs ${card.change7d >= 0 ? 'text-gray-400' : 'text-[#EF4444]'}`}>
          {card.change7d > 0 ? '+' : ''}{card.change7d.toFixed(1)}% 7d
        </div>
      </div>

      {/* Real-signal momentum + native-asset / social context */}
      {(card.momentum != null || card.priceChange24h != null || card.social) && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5 border-t border-white/[0.06]">
          {card.momentum != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider">Momentum</span>
              <MomentumBadge score={card.momentum} label={card.momentumLabel} />
            </div>
          )}
          {card.priceChange24h != null && (
            <span className={`text-[10px] font-medium ${card.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {card.chain} {card.priceChange24h > 0 ? '+' : ''}{card.priceChange24h.toFixed(1)}%
            </span>
          )}
          {card.social && (
            <span className="text-[10px] text-[#00C8FF]" title="LunarCrush Galaxy Score">◈ {card.social.galaxyScore}</span>
          )}
        </div>
      )}

      {card.alert && (
        <div className="mt-2 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-1 rounded-lg">{card.alert}</div>
      )}
      <div className="flex items-center justify-end mt-2">
        <span className="text-[9px] text-gray-600 flex items-center gap-0.5">Tap for details<ChevronRight className="w-2.5 h-2.5" /></span>
      </div>
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({ alert }: { alert: TrendAlertItem }) {
  const color = alert.severity === 'high' ? '#EF4444' : alert.severity === 'medium' ? '#F59E0B' : '#10B981';
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ background: color + '10', borderColor: color + '30' }}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold" style={{ color }}>{alert.chain} · {alert.metric}</div>
        <div className="text-[11px] text-gray-300 mt-0.5">{alert.message}</div>
      </div>
      <Bell className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color }} />
    </div>
  );
}

// ─── Trend Detail Drawer ──────────────────────────────────────────────────────

function TrendDrawer({ card, onClose }: { card: TrendCard; onClose: () => void }) {
  const up = card.direction === 'up';
  const down = card.direction === 'down';
  const color = up ? '#10B981' : down ? '#EF4444' : '#6B7280';
  const sparkColor = card.hot ? (up ? '#10B981' : '#EF4444') : '#3B82F6';

  // "Why is it moving" — the VTX Analysis panel used to render only a static
  // card.insight the API never populated (dead). Now it fetches a live,
  // data-grounded explanation on open.
  const [why, setWhy] = useState<{ narrative: string; confidence?: number } | null>(null);
  const [whyLoading, setWhyLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setWhyLoading(true);
    setWhy(null);
    fetch('/api/why-moving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chain: card.chain, metric: card.metric, label: card.metric, changePct: card.change24h }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.narrative) setWhy({ narrative: d.narrative, confidence: d.confidence }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWhyLoading(false); });
    return () => { cancelled = true; };
  }, [card.chain, card.metric, card.change24h]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 nl-glass border-t border-white/[0.08] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/[0.15] rounded-full" />
        </div>
        <div className="px-5 pb-8">
          <div className="flex items-start justify-between mb-4 pt-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-bold text-white">{card.chain}</span>
                {card.hot && <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />}
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: color + '20', color }}>{card.direction.toUpperCase()}</span>
              </div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider">{card.metric}</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Large value */}
          <div className="text-4xl font-black text-white mb-1">{card.value}</div>
          <div className="flex items-center gap-4 mb-6">
            <div className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-[#10B981]' : down ? 'text-[#EF4444]' : 'text-gray-400'}`}>
              {up ? <TrendingUp className="w-4 h-4" /> : down ? <TrendingDown className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              {card.change24h > 0 ? '+' : ''}{card.change24h.toFixed(2)}% <span className="text-xs text-gray-500 font-normal">24h</span>
            </div>
            <div className={`text-sm ${card.change7d >= 0 ? 'text-gray-400' : 'text-[#EF4444]'}`}>
              {card.change7d > 0 ? '+' : ''}{card.change7d.toFixed(1)}% <span className="text-xs text-gray-500">7d</span>
            </div>
          </div>

          {/* Large sparkline */}
          <div className="nl-glass rounded-2xl p-4 mb-4">
            <div className="text-[10px] text-gray-500 mb-3 uppercase tracking-wider">7-Day Trend</div>
            <Sparkline points={card.sparkline} color={sparkColor} height={80} />
          </div>

          {/* Alert */}
          {card.alert && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#F59E0B]">{card.alert}</p>
            </div>
          )}

          {/* Momentum breakdown — every driver is a real metric with its live
              value, so the composite score is fully traceable (no black box). */}
          {card.momentum != null && card.factors && card.factors.length > 0 && (
            <div className="nl-glass rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Momentum · real signals</span>
                <MomentumBadge score={card.momentum} label={`${card.momentumLabel ?? ''} ${card.momentum}`.trim()} />
              </div>
              <div className="space-y-2">
                {card.factors.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 w-20 flex-shrink-0">{f.label}</span>
                    <div className="relative flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f.score}%`, background: momentumColor(f.score) }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-32 flex-shrink-0 text-right truncate">{f.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Native asset + social read (real CoinGecko + LunarCrush data). */}
          {(card.priceChange24h != null || card.social) && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {card.priceChange24h != null && (
                <div className="nl-glass rounded-xl p-3">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{card.chain} price</div>
                  <div className={`text-sm font-bold ${card.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {card.priceChange24h > 0 ? '+' : ''}{card.priceChange24h.toFixed(2)}% <span className="text-[10px] text-gray-500 font-normal">24h</span>
                  </div>
                  {card.priceChange7d != null && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{card.priceChange7d > 0 ? '+' : ''}{card.priceChange7d.toFixed(1)}% 7d</div>
                  )}
                </div>
              )}
              {card.social && (
                <div className="nl-glass rounded-xl p-3">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Social · LunarCrush</div>
                  <div className="text-sm font-bold text-[#00C8FF]">Galaxy {card.social.galaxyScore}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Sentiment {card.social.sentiment > 0 ? '+' : ''}{card.social.sentiment} · {card.social.socialVolume24h.toLocaleString()} posts
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Why is it moving — live VTX explanation grounded in real
              convergence + whale-move signals for this chain. */}
          <div className="mb-4">
            <AiInsightCard
              title="Why is this moving: VTX"
              text={why?.narrative ?? (card.insight ?? '')}
              streaming={!!why?.narrative}
              loading={whyLoading}
              confidence={why?.confidence}
            />
          </div>

          <button onClick={onClose}
            className="w-full py-3 nl-glass rounded-xl text-sm font-semibold text-gray-300 hover:bg-white/[0.08] transition-colors">
            Close
          </button>
        </div>
      </div>
    </>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const router = useRouter();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedCard, setSelectedCard] = useState<TrendCard | null>(null);

  useNavState<{ chain: string }>(
    'trends',
    () => ({ chain }),
    (saved) => { if (saved.chain) setChain(saved.chain); },
  );

  async function fetchTrends(selectedChain = chain) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ chain: selectedChain });
      const res = await fetch(`/api/intelligence/on-chain-trends?${params.toString()}`);
      if (res.ok) {
        const json = await res.json() as TrendsResponse;
        setData(json);
        setLastRefresh(new Date());
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { fetchTrends(); }, []);

  function handleChain(c: string) {
    setChain(c);
    fetchTrends(c);
  }

  const chains = data?.chains ?? ['All Chains'];
  const chainTabs = ['all', ...chains.filter(c => c !== 'All Chains').map(c => c.toLowerCase())];
  const chainLabels: Record<string, string> = { all: 'All Chains' };
  chains.forEach(c => { chainLabels[c.toLowerCase()] = c; });

  // Sort cards: hot first, then by absolute change
  const sortedCards = [...(data?.cards ?? [])].sort((a, b) => {
    if (a.hot && !b.hot) return -1;
    if (!a.hot && b.hot) return 1;
    return Math.abs(b.change24h) - Math.abs(a.change24h);
  });

  return (
    <div className="min-h-screen text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#10B981] rounded-xl flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">On-Chain Trends</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 rounded font-bold">LIVE</span>
            </div>
            <span className="text-[10px] text-gray-600">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'DeFiLlama · Multi-chain metrics'}
            </span>
          </div>
          <HowItWorksButton content={trendsHowItWorks} className="ms-auto shrink-0" />
          <button onClick={() => fetchTrends()} disabled={loading}
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Chain filter tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {chainTabs.map(c => (
            <button key={c} onClick={() => handleChain(c)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                chain === c ? 'nl-btn-neon text-white' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
              }`}>
              {chainLabels[c] ?? c}
            </button>
          ))}
        </div>

        {/* Trend alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-xs font-bold text-gray-300">Trend Alerts</span>
              <span className="text-[10px] bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5 rounded-full font-bold">{data.alerts.length}</span>
            </div>
            {data.alerts.slice(0, 3).map(a => <AlertBanner key={a.id} alert={a} />)}
          </div>
        )}

        {/* Stats summary */}
        {data && (
          <div className="grid grid-cols-2 gap-2">
            <div className="nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="text-[10px] text-gray-500 mb-1">Hot Metrics</div>
              <div className="text-xl font-bold text-[#F59E0B]">{data.cards.filter(c => c.hot).length}</div>
            </div>
            <div className="nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="text-[10px] text-gray-500 mb-1">Chains Tracked</div>
              <div className="text-xl font-bold text-[#0066FF]">{data.chains.length - 1}</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* VTX Multi-Insight cards (4-6 cards) */}
        {sortedCards.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#0066FF]" />
              <span className="text-xs font-bold text-gray-300">Intelligence Cards</span>
              <span className="text-[10px] text-gray-600">{sortedCards.length} metrics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedCards.map(card => <InsightCard key={card.id} card={card} onSelect={setSelectedCard} />)}
            </div>
          </div>
        )}

        {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <TrendingUp className="w-8 h-8 text-gray-700" />
            <p className="text-sm text-gray-500">No trend data available</p>
          </div>
        )}
      </div>

      {/* Trend Detail Drawer */}
      {selectedCard && <TrendDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
