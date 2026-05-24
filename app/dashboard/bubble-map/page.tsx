'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import {
  Search, Send, Bot, Copy, Check, User,
  TrendingUp, TrendingDown, Shield, Layers, Maximize2, Minimize2,
  X, Network, GitBranch, BarChart3, ExternalLink, ChevronDown,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViewMode = 'holders' | 'network' | 'clusters';

export interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  value: number;
  percentage: number;
  type: 'token' | 'exchange' | 'whale' | 'contract' | 'unknown' | 'scammer' | 'dex' | 'team';
  entity?: string;
  verified?: boolean;
  color: string;
  entityLabel?: string | null;
  entityName?: string | null;
  entityBadge?: string | null;
  address?: string;
  clusterGroup?: string;
}

export interface BubbleLink extends d3.SimulationLinkDatum<BubbleNode> {
  value: number;
  direction?: 'in' | 'out' | 'both';
}

interface ClusterInfo { id: string; label: string; color: string; nodeIds: string[] }

// Chain-aware block-explorer mapper. Bubble map used to hardcode
// solscan for every chain — clicking "View on Solscan" for an ETH
// holder hit a dead Solana account page. This routes every chain's
// address to the canonical explorer and labels the link with the
// matching brand so users know what they're about to open.
const EXPLORER_BY_CHAIN: Record<string, { base: string; label: string }> = {
  solana:    { base: 'https://solscan.io/account/',   label: 'Solscan' },
  ethereum:  { base: 'https://etherscan.io/address/', label: 'Etherscan' },
  bsc:       { base: 'https://bscscan.com/address/',  label: 'BscScan' },
  polygon:   { base: 'https://polygonscan.com/address/', label: 'PolygonScan' },
  base:      { base: 'https://basescan.org/address/', label: 'BaseScan' },
  arbitrum:  { base: 'https://arbiscan.io/address/',  label: 'Arbiscan' },
  optimism:  { base: 'https://optimistic.etherscan.io/address/', label: 'Optimism Etherscan' },
  avalanche: { base: 'https://snowtrace.io/address/', label: 'SnowTrace' },
};
function explorerForChain(chain: string, address: string): { url: string; label: string } {
  const cfg = EXPLORER_BY_CHAIN[chain.toLowerCase()] ?? EXPLORER_BY_CHAIN.ethereum;
  return { url: `${cfg.base}${address}`, label: cfg.label };
}

interface TokenInfo {
  name: string; symbol: string; chain: string; price: number;
  priceChange24h: number; volume24h: number; marketCap: number;
  liquidity: number; totalHolders: number; topHolderConcentration: number;
}

interface RiskInfo {
  riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  riskColor: string; topHoldersConcentration: number;
}

interface BubbleMapData {
  nodes: BubbleNode[]; links: BubbleLink[]; tokenInfo: TokenInfo;
  risk?: RiskInfo; mode: ViewMode;
  clusters?: ClusterInfo[];
  error?: string;
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  token: 'Token', exchange: 'Exchange', whale: 'Whale', contract: 'Contract',
  unknown: 'Unknown', scammer: 'Scammer', dex: 'DEX', team: 'Team',
};

const CHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' }, { value: 'solana', label: 'Solana' },
  { value: 'bsc', label: 'BNB Chain' }, { value: 'base', label: 'Base' },
  { value: 'arbitrum', label: 'Arbitrum' }, { value: 'polygon', label: 'Polygon' },
];

const MODE_TABS: Array<{ id: ViewMode; label: string; icon: React.ElementType }> = [
  { id: 'holders', label: 'Token Holders', icon: BarChart3 },
  { id: 'network', label: 'Wallet Network', icon: Network },
  { id: 'clusters', label: 'Cluster View', icon: GitBranch },
];

function fmtNum(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(p: number) {
  if (p < 0.0001) return `$${p.toFixed(8)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRadius(n: BubbleNode, W: number, H: number): number {
  if (n.id === 'center') return Math.min(W, H) * 0.055;
  const minR = 6, maxR = Math.min(W, H) * 0.038;
  return Math.max(minR, Math.min(maxR, Math.sqrt(n.percentage) * 5.5));
}

// ─── Wallet Panel Slide-in ────────────────────────────────────────────────────

function WalletPanel({ node, chain, onClose }: { node: BubbleNode; chain: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const addr = node.address ?? '';

  function copy() {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#0a0e1a]/97 border-l border-white/[0.06] backdrop-blur-xl z-20 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
          <span className="text-sm font-bold truncate max-w-[160px]">
            {node.entityName || node.entity || node.label}
          </span>
          {node.verified && <Check className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded-lg transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Type badge */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Holder Type</span>
          <span className="font-semibold px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: node.color + '20', color: node.color }}>
            {TYPE_LABELS[node.type] ?? node.type}
          </span>
        </div>

        {node.entityLabel && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Entity</span>
            <span className="text-gray-200 font-medium">{node.entityLabel}</span>
          </div>
        )}

        {/* Holdings bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">Holdings</span>
            <span className="font-mono font-bold text-white">{node.percentage.toFixed(3)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, node.percentage * 3)}%`, background: node.color }} />
          </div>
        </div>

        {/* Address */}
        {addr && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">Wallet Address</span>
              <button onClick={copy} className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1">
                {copied ? <><Check className="w-3 h-3 text-[#10B981]" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
            </div>
            <code className="text-[10px] text-gray-300 break-all">{addr}</code>
          </div>
        )}

        {/* Risk flag */}
        {node.type === 'scammer' && (
          <div className="p-2.5 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl">
            <p className="text-xs text-[#EF4444] font-semibold">Flagged as malicious</p>
            <p className="text-[10px] text-[#EF4444]/70 mt-0.5">Scammer / rug puller label detected</p>
          </div>
        )}

        {/* External link — chain-aware. Was hardcoded to Solscan and
            404'd for every non-Solana holder. */}
        {addr && (() => {
          const { url, label } = explorerForChain(chain, addr);
          return (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#0A1EFF] hover:text-blue-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />View on {label}
            </a>
          );
        })()}
      </div>
    </div>
  );
}

// ─── D3 Force Graph ───────────────────────────────────────────────────────────

interface D3GraphProps {
  data: BubbleMapData;
  onNodeClick: (n: BubbleNode | null) => void;
  selected: BubbleNode | null;
  fullscreen: boolean;
  /** Address typed into the wallet-search input. When set, the
   *  matching node renders with an amber pin + thicker stroke so
   *  the user can locate a specific holder inside a busy graph. */
  pinnedAddress?: string;
}

function D3ForceGraph({ data, onNodeClick, selected, fullscreen, pinnedAddress }: D3GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<BubbleNode, BubbleLink> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;
    const el = svgRef.current;
    // BUBBLE3: derive width/height from the live container rect (handles
    // CSS resize, fullscreen toggle, and mobile rotation) instead of
    // baking in a one-shot read at first render. Keeps the SVG viewBox
    // proportional to the actual paint surface.
    const rect = el.getBoundingClientRect();
    const W = Math.max(320, rect.width || el.clientWidth || 600);
    const H = Math.max(320, rect.height || el.clientHeight || 500);

    // Clone nodes/links so D3 can mutate
    const nodes: BubbleNode[] = data.nodes.map(n => ({ ...n, x: W / 2, y: H / 2 }));
    const linkMap = new Map(nodes.map(n => [n.id, n]));
    const links: BubbleLink[] = data.links.map(l => ({
      ...l,
      source: linkMap.get(typeof l.source === 'string' ? l.source : (l.source as BubbleNode).id) ?? l.source,
      target: linkMap.get(typeof l.target === 'string' ? l.target : (l.target as BubbleNode).id) ?? l.target,
    }));

    const center = nodes.find(n => n.id === 'center');
    if (center) { center.fx = W / 2; center.fy = H / 2; }

    const svg = d3.select(el);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${W} ${H}`);

    const g = svg.append('g');

    // Zoom + pan. BUBBLE2: enable touch input — d3-zoom binds pointer
    // events by default but a `touch-action: manipulation` on the SVG
    // is required so iOS Safari doesn't intercept two-finger gestures
    // as page-scroll. The svg.style call sets the CSS attribute
    // directly so no Tailwind class is needed.
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', ev => g.attr('transform', ev.transform.toString()));
    svg.call(zoom);
    svg.style('touch-action', 'manipulation');

    // Links
    const linkSel = g.append('g').selectAll<SVGLineElement, BubbleLink>('line')
      .data(links).join('line')
      .attr('stroke', '#ffffff18').attr('stroke-width', d => Math.max(0.5, d.value * 0.05));

    // Cluster halos (cluster view)
    if (data.clusters?.length) {
      for (const cluster of data.clusters) {
        const members = nodes.filter(n => cluster.nodeIds.includes(n.id));
        const cx = members.reduce((s, n) => s + (n.x ?? W / 2), 0) / (members.length || 1);
        const cy = members.reduce((s, n) => s + (n.y ?? H / 2), 0) / (members.length || 1);
        g.append('circle').attr('cx', cx).attr('cy', cy)
          .attr('r', 80).attr('fill', cluster.color + '10').attr('stroke', cluster.color + '30')
          .attr('stroke-dasharray', '4 4').attr('pointer-events', 'none');
      }
    }

    const pinNeedle = pinnedAddress?.trim().toLowerCase() ?? '';
    const isPinned = (n: BubbleNode) =>
      pinNeedle.length > 0 && (n.address ?? '').toLowerCase() === pinNeedle;

    // Nodes
    const nodeSel = g.append('g').selectAll<SVGCircleElement, BubbleNode>('circle')
      .data(nodes).join('circle')
      .attr('r', n => getRadius(n, W, H) * (isPinned(n) ? 1.25 : 1))
      .attr('fill', n => n.color + (n.id === 'center' ? 'EE' : '99'))
      .attr('stroke', n => (isPinned(n) ? '#F59E0B' : n.color))
      .attr('stroke-width', n => (isPinned(n) ? 3 : selected?.id === n.id ? 2.5 : 0.8))
      .attr('cursor', 'pointer')
      .on('click', (_, n) => onNodeClick(n.id === 'center' ? null : n))
      .call(d3.drag<SVGCircleElement, BubbleNode>()
        .on('start', (ev, n) => { if (!ev.active) sim.alphaTarget(0.3).restart(); n.fx = n.x; n.fy = n.y; })
        .on('drag', (ev, n) => { n.fx = ev.x; n.fy = ev.y; })
        .on('end', (ev, n) => { if (!ev.active) sim.alphaTarget(0); if (n.id !== 'center') { n.fx = null; n.fy = null; } })
      );

    // Native SVG <title> hover tooltips. Zero-cost vs a custom div
    // overlay; readable by screen readers + standard browser hover.
    // Industry-standard rich D3 tooltips (positioned div with token
    // logos / sparklines) is a follow-up; this gets us the address +
    // type + holdings on hover today.
    nodeSel.append('title').text(n => {
      const lines: string[] = [];
      const name = n.entityName || n.entity || n.label || n.id;
      lines.push(name);
      if (n.entityLabel) lines.push(`Entity: ${n.entityLabel}`);
      lines.push(`Type: ${TYPE_LABELS[n.type] ?? n.type}`);
      lines.push(`Holdings: ${n.percentage.toFixed(3)}%`);
      if (n.address) lines.push(`Address: ${n.address}`);
      if (n.verified) lines.push('Verified');
      if (n.type === 'scammer') lines.push('Flagged: scammer / rug puller');
      return lines.join('\n');
    });

    // Labels
    const labelSel = g.append('g').selectAll<SVGTextElement, BubbleNode>('text')
      .data(nodes).join('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#fff').attr('font-size', n => Math.max(7, getRadius(n, W, H) * 0.55))
      .attr('font-family', 'Inter, system-ui, sans-serif').attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text(n => {
        const lbl = n.entityName || n.entity || n.label || '';
        return lbl.length > 10 ? lbl.slice(0, 10) + '…' : lbl;
      });

    const pctSel = g.append('g').selectAll<SVGTextElement, BubbleNode>('text')
      .data(nodes.filter(n => n.id !== 'center' && getRadius(n, W, H) > 14)).join('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff88').attr('font-size', n => Math.max(6, getRadius(n, W, H) * 0.42))
      .attr('font-family', 'Inter, system-ui, sans-serif').attr('pointer-events', 'none')
      .text(n => `${n.percentage.toFixed(1)}%`);

    const sim = d3.forceSimulation<BubbleNode>(nodes)
      .force('link', d3.forceLink<BubbleNode, BubbleLink>(links).id(n => n.id).distance(130).strength(0.4))
      .force('charge', d3.forceManyBody<BubbleNode>().strength(-250))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<BubbleNode>().radius(n => getRadius(n, W, H) + 8));

    simRef.current = sim;

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as BubbleNode).x ?? 0).attr('y1', d => (d.source as BubbleNode).y ?? 0)
        .attr('x2', d => (d.target as BubbleNode).x ?? 0).attr('y2', d => (d.target as BubbleNode).y ?? 0);
      nodeSel.attr('cx', n => n.x ?? W / 2).attr('cy', n => n.y ?? H / 2);
      labelSel.attr('x', n => n.x ?? W / 2).attr('y', n => (n.y ?? H / 2) - (getRadius(n, W, H) > 18 ? 5 : 0));
      pctSel.attr('x', n => n.x ?? W / 2).attr('y', n => (n.y ?? H / 2) + 8);
    });

    // If the user searched for a specific holder address and we found a
    // matching node, pull it toward the center so it doesn't end up
    // hidden behind the cluster halo.
    if (pinNeedle) {
      const target = nodes.find((n) => (n.address ?? '').toLowerCase() === pinNeedle);
      if (target) {
        target.fx = W / 2;
        target.fy = H / 2 - 80;
        setTimeout(() => {
          if (!simRef.current) return;
          target.fx = null;
          target.fy = null;
        }, 1500);
      }
    }

    return () => { sim.stop(); svg.selectAll('*').remove(); };
  }, [data, selected, onNodeClick, fullscreen, pinnedAddress]);

  return <svg ref={svgRef} className="w-full h-full" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BubbleMapPage() {
  const router = useRouter();
  const [tokenAddress, setTokenAddress] = useState('');
  const [chain, setChain] = useState('solana');
  const [mode, setMode] = useState<ViewMode>('holders');
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<BubbleMapData | null>(null);
  const [selectedNode, setSelectedNode] = useState<BubbleNode | null>(null);
  const [pinnedAddress, setPinnedAddress] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChainDrop, setShowChainDrop] = useState(false);
  // BUBBLE4: timeline scrub + signed share link. snapshotMs=null means
  // "now"; setting a value re-fetches with ?at=<ms> so the response
  // labels the view deterministically.
  const [snapshotMs, setSnapshotMs] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Bubble Map agent online. Enter a token address to visualize holder distribution. Ask me anything about the data.',
    timestamp: Date.now(),
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchMap = useCallback(async (m: ViewMode = mode) => {
    if (!tokenAddress.trim()) return;
    setLoading(true);
    setSelectedNode(null);
    try {
      const atParam = snapshotMs ? `&at=${snapshotMs}` : '';
      const res = await fetch(
        `/api/bubble-map?token=${encodeURIComponent(tokenAddress.trim())}&chain=${chain}&mode=${m}${atParam}`
      );
      const data = await res.json() as BubbleMapData;
      if (!data.error) setMapData(data);
    } catch (err) {
      // §12 — was an empty catch that swallowed every network/parse
      // failure and left the user staring at an empty bubble map with no
      // explanation. Log the underlying cause and surface a recoverable
      // error state so the existing error UI renders.
      console.error('[bubble-map] fetch failed:', err);
      setMapData({ error: err instanceof Error ? err.message : 'Failed to load bubble map' } as BubbleMapData);
    } finally { setLoading(false); }
  }, [tokenAddress, chain, mode, snapshotMs]);

  // BUBBLE4: mint a signed permalink. Server-side JWT signing — the
  // share URL is unforgeable, so a sender can't be impersonated into
  // pointing at a different token.
  const shareView = useCallback(async () => {
    if (!tokenAddress.trim()) return;
    setSharing(true);
    try {
      const res = await fetch('/api/bubble-map/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenAddress.trim(),
          chain,
          mode,
          at: snapshotMs,
        }),
      });
      if (!res.ok) return;
      const j = await res.json() as { url: string };
      setShareUrl(j.url);
      try { await navigator.clipboard.writeText(j.url); } catch { /* clipboard unavailable */ }
    } finally {
      setSharing(false);
    }
  }, [tokenAddress, chain, mode, snapshotMs]);

  function handleModeChange(m: ViewMode) {
    setMode(m);
    if (mapData) fetchMap(m);
  }

  const sendChat = useCallback(async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || chatLoading) return;
    setChatMessages(p => [...p, { role: 'user', content: msg, timestamp: Date.now() }]);
    setChatInput('');
    setChatLoading(true);
    try {
      // Phase C — dedicated bubble-map agent with structured context +
      // domain-specific system prompt, conversation persisted to
      // bubblemap_conversations. Replaces the generic /api/vtx-ai
      // call which had to infer cluster patterns from prose.
      const context = mapData ? {
        tokenName: mapData.tokenInfo.name,
        tokenSymbol: mapData.tokenInfo.symbol,
        chain: mapData.tokenInfo.chain,
        tokenAddress: tokenAddress.trim(),
        priceUsd: mapData.tokenInfo.price,
        marketCap: mapData.tokenInfo.marketCap,
        topHolderConcentration: mapData.tokenInfo.topHolderConcentration,
        totalHolders: mapData.tokenInfo.totalHolders,
        riskLevel: mapData.risk?.riskLevel,
        topHolders: mapData.nodes
          .filter(n => n.id !== 'token')
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 10)
          .map(n => ({
            address: n.address ?? n.id,
            label: n.entityLabel ?? n.entityName ?? null,
            percent: n.percentage,
            type: n.type,
          })),
      } : undefined;
      const res = await fetch('/api/bubblemap-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatMessages.slice(-8), context }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setChatMessages(p => [...p, { role: 'assistant', content: data.reply ?? data.error ?? 'No response.', timestamp: Date.now() }]);
    } catch {
      setChatMessages(p => [...p, { role: 'assistant', content: 'Connection failed.', timestamp: Date.now() }]);
    } finally { setChatLoading(false); }
  }, [chatInput, chatLoading, chatMessages, mapData, tokenAddress]);

  // Phase C — pre-canned questions surfaced above the chat input so
  // first-time users have an instant on-ramp. Tap to fill the input
  // (not auto-send) so they can edit before submitting.
  const SUGGESTED_QUESTIONS: string[] = [
    'Who are the top 3 holders?',
    'Is this token risky?',
    'Are there dev-wallet patterns?',
    'How concentrated is supply?',
  ];

  function copyMsg(i: number) {
    const m = chatMessages[i];
    if (m) { navigator.clipboard.writeText(m.content); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }
  }

  const info = mapData?.tokenInfo;
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-[#060A12] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-9 h-9 bg-gradient-to-br from-[#0A1EFF] to-[#4F46E5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0A1EFF]/20">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Bubble Map</span>
              <span className="px-1.5 py-0.5 bg-[#0A1EFF]/15 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-bold">INTEL</span>
            </div>
            <span className="text-[10px] text-gray-600">Token holder distribution · D3 force graph</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex gap-2">
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowChainDrop(v => !v)}
              className="h-11 px-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs font-medium text-gray-300 flex items-center gap-1.5 hover:border-white/[0.15] transition-colors">
              {CHAIN_OPTIONS.find(c => c.value === chain)?.label}<ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showChainDrop && <>
              <div className="fixed inset-0 z-30" onClick={() => setShowChainDrop(false)} />
              <div className="absolute top-full left-0 mt-1 w-40 bg-[#0f1320] border border-white/[0.08] rounded-xl overflow-hidden z-40 shadow-xl">
                {CHAIN_OPTIONS.map(c => (
                  <button key={c.value} onClick={() => { setChain(c.value); setShowChainDrop(false); }}
                    className={`w-full text-start px-3 py-2.5 text-xs hover:bg-white/[0.06] transition-colors ${chain === c.value ? 'text-[#0A1EFF]' : 'text-gray-400'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </>}
          </div>
          <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 focus-within:border-[#0A1EFF]/30 transition-colors">
            <Search className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchMap()}
              placeholder="Enter token contract address..."
              className="flex-1 bg-transparent py-3 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono" />
          </div>
          <button onClick={() => fetchMap()} disabled={loading || !tokenAddress.trim()}
            className="h-11 px-4 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl text-xs font-bold transition-colors disabled:opacity-30 flex-shrink-0">
            {loading ? '…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Token info + risk bar */}
      {info && (
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-sm font-bold">{info.symbol}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-bold">{fmtPrice(info.price)}</span>
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${info.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {info.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(info.priceChange24h).toFixed(2)}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
              <span>Vol: <span className="text-gray-300 font-mono">{fmtNum(info.volume24h)}</span></span>
              <span>MCap: <span className="text-gray-300 font-mono">{fmtNum(info.marketCap)}</span></span>
              <span>Liq: <span className="text-gray-300 font-mono">{fmtNum(info.liquidity)}</span></span>
              <span>Holders: <span className="text-gray-300 font-mono">{info.totalHolders}</span></span>
            </div>
          </div>
          {mapData?.risk && (
            <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg border text-xs"
              style={{ backgroundColor: mapData.risk.riskColor + '14', borderColor: mapData.risk.riskColor + '44' }}>
              <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: mapData.risk.riskColor }} />
              <span className="font-bold" style={{ color: mapData.risk.riskColor }}>Risk: {mapData.risk.riskLevel}</span>
              <span className="text-gray-400">—</span>
              <span className="text-gray-300">Top 5 wallets hold <span className="font-mono font-bold" style={{ color: mapData.risk.riskColor }}>{mapData.risk.topHoldersConcentration.toFixed(1)}%</span></span>
              <span className="ms-auto text-gray-500 font-mono">Score: {mapData.risk.riskScore}/10</span>
            </div>
          )}
          {/* Mode tabs */}
          <div className="flex gap-1 mt-3 flex-wrap items-center">
            {MODE_TABS.map(tab => (
              <button key={tab.id} onClick={() => handleModeChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${mode === tab.id ? 'bg-[#0A1EFF] text-white' : 'bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]'}`}>
                <tab.icon className="w-3 h-3" />{tab.label}
              </button>
            ))}
            {/* BUBBLE4 timeline scrub + share */}
            <label className="ms-2 flex items-center gap-1 text-[10px] text-slate-400">
              <span className="uppercase tracking-wider">Snapshot</span>
              <input
                type="datetime-local"
                value={snapshotMs ? new Date(snapshotMs).toISOString().slice(0, 16) : ''}
                onChange={(e) => setSnapshotMs(e.target.value ? new Date(e.target.value).getTime() : null)}
                onBlur={() => { if (mapData) void fetchMap(mode); }}
                className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-slate-200"
                aria-label="Snapshot timestamp"
              />
              {snapshotMs !== null && (
                <button type="button" onClick={() => { setSnapshotMs(null); if (mapData) void fetchMap(mode); }} className="text-slate-500 hover:text-white text-[10px] px-1">
                  Now
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => void shareView()}
              disabled={sharing || !tokenAddress.trim()}
              className="ms-auto bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-slate-200 disabled:opacity-50"
            >
              {sharing ? 'Signing…' : shareUrl ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className={`flex flex-col lg:flex-row flex-1 min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#060A12]' : ''}`}>
        {/* Graph pane */}
        <div className={`relative ${isFullscreen ? 'flex-1' : 'h-[420px] sm:h-[500px] lg:h-auto lg:flex-1'} border-b lg:border-b-0 lg:border-r border-white/[0.04]`}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SteinzLogoSpinner size={56} message="Loading holder data…" />
            </div>
          ) : !mapData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
              <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                <Layers className="w-10 h-10 text-gray-700" />
              </div>
              <p className="text-sm font-semibold text-gray-400">No token loaded</p>
              <p className="text-xs text-gray-600 max-w-xs text-center">Enter a token contract address above to visualize the holder distribution network</p>
            </div>
          ) : (
            <>
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/[0.04] border border-white/[0.10] rounded-lg px-2.5 py-1.5 backdrop-blur-md">
                <Search className="w-3 h-3 text-gray-500" />
                <input
                  value={pinnedAddress}
                  onChange={(e) => setPinnedAddress(e.target.value)}
                  placeholder="Find wallet…"
                  className="bg-transparent text-[11px] font-mono w-44 focus:outline-none placeholder-gray-600"
                />
                {pinnedAddress && (
                  <button
                    onClick={() => setPinnedAddress('')}
                    className="text-[10px] text-gray-500 hover:text-white"
                    aria-label="Clear pin"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <D3ForceGraph data={mapData} onNodeClick={setSelectedNode} selected={selectedNode} fullscreen={isFullscreen} pinnedAddress={pinnedAddress} />
              {selectedNode && (
                <WalletPanel
                  node={selectedNode}
                  chain={mapData.tokenInfo.chain || chain}
                  onClose={() => setSelectedNode(null)}
                />
              )}
              <button onClick={() => setIsFullscreen(v => !v)}
                className="absolute top-3 right-3 p-2 bg-[#0f1320]/80 border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors backdrop-blur-sm z-10">
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
              </button>
              {/* Legend */}
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'token').map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-[#0f1320]/80 border border-white/[0.06] rounded-md backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ({ exchange: '#10B981', whale: '#F59E0B', contract: '#8B5CF6', dex: '#06B6D4', team: '#EC4899', scammer: '#EF4444', unknown: '#6B7280' } as Record<string,string>)[key] }} />
                    <span className="text-[9px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Chat pane */}
        {!isFullscreen && (
          <div className="flex flex-col min-h-[360px] max-h-[480px] lg:max-h-none lg:h-auto lg:w-[360px] xl:w-[400px]">
            {/* Holder list */}
            {mapData && mapData.nodes.length > 1 && (
              <div className="border-b border-white/[0.04] max-h-[130px] lg:max-h-[180px] overflow-y-auto flex-shrink-0">
                <div className="px-3 py-1.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider sticky top-0 bg-[#060A12]/90">
                  <div className="grid grid-cols-[20px_1fr_55px_55px] gap-2"><span>#</span><span>Holder</span><span className="text-end">%</span><span className="text-end">Type</span></div>
                </div>
                {mapData.nodes.filter(n => n.id !== 'center').sort((a, b) => b.percentage - a.percentage).map((node, idx) => (
                  <div key={node.id} onClick={() => setSelectedNode(node.id === selectedNode?.id ? null : node)}
                    className={`px-3 py-1.5 text-[10px] cursor-pointer transition-colors hover:bg-white/[0.03] ${selectedNode?.id === node.id ? 'bg-[#0A1EFF]/[0.06]' : ''}`}>
                    <div className="grid grid-cols-[20px_1fr_55px_55px] gap-2 items-center">
                      <span className="text-gray-600 font-mono">{idx + 1}</span>
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
                        <span className="text-gray-300 truncate">{node.entityName || node.entity || node.label}</span>
                        {node.verified && <Check className="w-2.5 h-2.5 text-[#10B981] flex-shrink-0" />}
                      </div>
                      <span className="text-end text-white font-mono">{node.percentage.toFixed(2)}%</span>
                      <span className="text-end font-medium text-[9px]" style={{ color: node.color }}>{TYPE_LABELS[node.type]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VTX Chat */}
            <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2 flex-shrink-0 bg-[#060A12]/50">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 border border-[#0A1EFF]/15 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-[#0A1EFF]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Bubble Map Agent</span>
                  <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] ${msg.role === 'user' ? 'bg-[#0A1EFF]/20' : 'bg-white/[0.05]'}`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-[#0A1EFF]" /> : <Bot className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                  <div className={`relative group max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-[#0A1EFF]/15 text-gray-100' : 'bg-white/[0.04] text-gray-200'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-[9px] text-gray-600">{fmtTime(msg.timestamp)}</span>
                      <button onClick={() => copyMsg(i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/[0.06] rounded">
                        {copiedIdx === i ? <Check className="w-2.5 h-2.5 text-[#10B981]" /> : <Copy className="w-2.5 h-2.5 text-gray-500" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0"><Bot className="w-3.5 h-3.5 text-gray-400" /></div>
                  <div className="bg-white/[0.04] rounded-xl px-3 py-2 flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-white/[0.04] flex-shrink-0">
              {/* Phase C — pre-canned questions appear when the chat is
                  empty (just the welcome message). Tap to fill the
                  input; user can still edit before sending. */}
              {mapData && chatMessages.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setChatInput(q)}
                      className="text-[10px] px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-[#0A1EFF]/40 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  placeholder="Ask about holders, risk, dev wallets, cluster patterns…"
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30 transition-colors" />
                <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                  className="w-8 h-8 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 flex-shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
