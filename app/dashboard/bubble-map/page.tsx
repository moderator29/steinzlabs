'use client';

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as d3 from 'd3';
import {
  Search, Send, Bot, Copy, Check, User, AlertTriangle,
  TrendingUp, TrendingDown, Shield, Layers, Maximize2, Minimize2,
  X, Network, GitBranch, BarChart3, ExternalLink, ChevronDown,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { bubbleMapHowItWorks } from '@/lib/howItWorks/content/bubble-map';

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
  dataSource?: string;
}

// Matches the `security` block the /api/bubble-map route actually returns.
// The page previously read `mapData.risk`, a field the API never sent, so
// the risk strip silently never rendered.
interface SecurityInfo {
  riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  riskColor: string; topHoldersConcentration: number;
  isHoneypot: boolean; buyTax: number; sellTax: number;
  ownershipRenounced: boolean;
  checks: Array<{ label: string; status: 'pass' | 'fail' | 'warn' }>;
}

interface BubbleMapData {
  nodes: BubbleNode[]; links: BubbleLink[]; tokenInfo: TokenInfo;
  security?: SecurityInfo; mode: ViewMode;
  clusters?: ClusterInfo[];
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  token: 'Token', exchange: 'Exchange', whale: 'Whale', contract: 'Contract',
  unknown: 'Unknown', scammer: 'Scammer', dex: 'DEX', team: 'Team',
};

// Single source of truth for node-type colors (legend, holder list, panels).
const NODE_TYPE_COLORS: Record<string, string> = {
  exchange: '#10B981', whale: '#F59E0B', contract: '#8B5CF6', dex: '#06B6D4',
  team: '#EC4899', scammer: '#EF4444', unknown: '#6B7280',
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
    <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[88%] nl-glass border-l border-white/[0.06] backdrop-blur-xl z-20 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
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
              className="flex items-center gap-2 text-xs text-[#0066FF] hover:text-blue-400 transition-colors">
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
  // BUBBLE half-render fix: track the live paint-surface size so the SVG
  // viewBox always matches the container's real aspect ratio. Reading the rect
  // once at mount (before flex/`h-full` settled, or before a mobile rotation)
  // produced a viewBox whose ratio differed from the container, so
  // preserveAspectRatio="meet" letterboxed the graph into a band in the middle
  // — the "map shows half" symptom (IMG_1928). A ResizeObserver re-syncs.
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width || el.clientWidth || 0);
      const h = Math.round(r.height || el.clientHeight || 0);
      if (w > 0 && h > 0) setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;
    const el = svgRef.current;
    // Use the observed paint-surface size; fall back to a live rect read the
    // first time (before the observer has fired).
    const rect = el.getBoundingClientRect();
    const W = Math.max(320, dims.w || rect.width || el.clientWidth || 600);
    const H = Math.max(320, dims.h || rect.height || el.clientHeight || 500);

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
    // §10 — keep the map stable and professional: a tighter zoom range
    // (was [0.3,4] which let it zoom out tiny / blow up huge) and a
    // translateExtent that clamps panning to a bounded region around the
    // graph so it can no longer be dragged off into empty space.
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2.5])
      .translateExtent([[-W * 0.3, -H * 0.3], [W * 1.3, H * 1.3]])
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
  }, [data, selected, onNodeClick, fullscreen, pinnedAddress, dims.w, dims.h]);

  return <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="xMidYMid meet" />;
}

// ─── Concentration Read ───────────────────────────────────────────────────────

/** Computed purely from the real holder nodes the API returned — no
 *  fabricated splits. `tracked` is the share of supply covered by the
 *  holders the intel pipeline resolved (top ~20); the remainder is
 *  labelled honestly as untracked supply. */
function computeConcentration(nodes: BubbleNode[]) {
  const holders = nodes
    .filter(n => n.id !== 'center')
    .map(n => n.percentage)
    .sort((a, b) => b - a);
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const top1 = sum(holders.slice(0, 1));
  const top2to5 = sum(holders.slice(1, 5));
  const top6to10 = sum(holders.slice(5, 10));
  const rest = sum(holders.slice(10));
  const tracked = top1 + top2to5 + top6to10 + rest;
  return { top1, top2to5, top6to10, rest, tracked, untracked: Math.max(0, 100 - tracked), count: holders.length };
}

function ConcentrationCard({ nodes, security, totalHolders, dataSource }: {
  nodes: BubbleNode[];
  security?: SecurityInfo;
  totalHolders: number;
  dataSource?: string;
}) {
  const c = useMemo(() => computeConcentration(nodes), [nodes]);
  if (c.count === 0) return null;

  const segments = [
    { label: 'Top 1', value: c.top1, color: '#EF4444' },
    { label: 'Top 2–5', value: c.top2to5, color: '#F97316' },
    { label: 'Top 6–10', value: c.top6to10, color: '#F59E0B' },
    { label: `Others tracked (${Math.max(0, c.count - 10)})`, value: c.rest, color: '#0066FF' },
    { label: 'Untracked supply', value: c.untracked, color: '#374151' },
  ].filter(s => s.value > 0.01);

  return (
    <GlassCard className="rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: security?.riskColor ?? '#0066FF' }} />
          <h2 className="text-sm font-bold">Concentration Risk</h2>
        </div>
        {security && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: security.riskColor + '1A', color: security.riskColor, border: `1px solid ${security.riskColor}44` }}>
            {security.riskLevel} · {security.riskScore}/10
          </span>
        )}
      </div>

      {/* Stacked supply-distribution bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-white/[0.04]">
        {segments.map(s => (
          <div key={s.label} title={`${s.label}: ${s.value.toFixed(2)}%`}
            style={{ width: `${s.value}%`, background: s.color }} className="h-full min-w-[2px]" />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            {s.label} <span className="text-gray-200 font-mono">{s.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {security && (
        <p className="mt-3 text-xs text-gray-400 leading-relaxed">
          Top 5 tracked wallets hold{' '}
          <span className="font-mono font-bold" style={{ color: security.riskColor }}>
            {security.topHoldersConcentration.toFixed(1)}%
          </span>{' '}
          of supply — {security.riskLevel.toLowerCase()} concentration risk
          {totalHolders > 0 && <> across {totalHolders.toLocaleString()} total holders</>}.
        </p>
      )}

      {/* Contract security checks from GoPlus via the intel pipeline */}
      {security && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SecurityChip label={security.isHoneypot ? 'Honeypot detected' : 'Not a honeypot'} status={security.isHoneypot ? 'fail' : 'pass'} />
          <SecurityChip label={security.ownershipRenounced ? 'Ownership renounced' : 'Owner retains control'} status={security.ownershipRenounced ? 'pass' : 'warn'} />
          {(security.buyTax > 0 || security.sellTax > 0) && (
            <SecurityChip label={`Tax ${security.buyTax}% buy / ${security.sellTax}% sell`}
              status={security.buyTax > 10 || security.sellTax > 10 ? 'fail' : 'warn'} />
          )}
          {security.checks.map(chk => <SecurityChip key={chk.label} label={chk.label} status={chk.status} />)}
        </div>
      )}

      {dataSource && (
        <p className="mt-3 text-[10px] text-gray-600">Holder data: {dataSource}</p>
      )}
    </GlassCard>
  );
}

function SecurityChip({ label, status }: { label: string; status: 'pass' | 'fail' | 'warn' }) {
  const palette = {
    pass: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', bd: 'rgba(16,185,129,0.25)' },
    warn: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.25)' },
    fail: { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)', bd: 'rgba(239,68,68,0.25)' },
  }[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ color: palette.fg, background: palette.bg, border: `1px solid ${palette.bd}` }}>
      {status === 'pass' ? <Check className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function BubbleMapInner() {
  const searchParams = useSearchParams();
  const deepLinkDone = useRef(false);
  const autoFired = useRef(false);
  const [tokenAddress, setTokenAddress] = useState('');
  const [chain, setChain] = useState('solana');
  const [mode, setMode] = useState<ViewMode>('holders');
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<BubbleMapData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<BubbleNode | null>(null);
  const [pinnedAddress, setPinnedAddress] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChainDrop, setShowChainDrop] = useState(false);
  // BUBBLE4: signed share link. The holder-intel pipeline is LIVE-ONLY —
  // there is no historical holder snapshot store wired yet — so the old
  // datetime "snapshot" scrubber was misleading: picking a past time still
  // returned current data. It's been replaced with an honest "Live" badge
  // until a real holder_snapshots source is wired.
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

  const fetchMap = useCallback(async (m: ViewMode = mode, addrOverride?: string, chainOverride?: string) => {
    // Allow an explicit address/chain (e.g. when the agent pastes a CA) so we
    // don't race React state — reading tokenAddress right after setTokenAddress
    // would still see the previous value.
    const addr = (addrOverride ?? tokenAddress).trim();
    const ch = chainOverride ?? chain;
    if (!addr) return;
    setLoading(true);
    setSelectedNode(null);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/bubble-map?token=${encodeURIComponent(addr)}&chain=${ch}&mode=${m}`
      );
      const data = await res.json().catch(() => null) as (BubbleMapData & { error?: string }) | null;
      // Honest error states — the old code silently dropped API errors
      // (including the pro-tier 403) and left the user staring at the
      // empty "no token loaded" screen with no explanation.
      if (!res.ok || !data || data.error || !Array.isArray(data.nodes)) {
        setMapData(null);
        if (res.status === 401) setErrorMsg('Sign in to use the Bubble Map.');
        else if (res.status === 403) setErrorMsg('Bubble Map requires a Pro subscription. Upgrade to analyze holder distribution.');
        else setErrorMsg(data?.error && data.error !== 'upgrade_required'
          ? data.error
          : 'Could not build the bubble map for this token. Verify the contract address and chain, then try again.');
        return;
      }
      setMapData(data);
    } catch {
      setMapData(null);
      setErrorMsg('Network error — could not reach the holder-intel service. Check your connection and retry.');
    } finally { setLoading(false); }
  }, [tokenAddress, chain, mode]);

  // BUBBLE4: mint a signed permalink. Server-side JWT signing — the
  // share URL is unforgeable, so a sender can't be impersonated into
  // pointing at a different token.
  // Deep-link entry: ?address=<addr> (from the VTX "view full bubble map" CTA)
  // or ?share=<jwt> (share link). Without this, both landed on the empty
  // "no token loaded" state.
  useEffect(() => {
    if (deepLinkDone.current) return;
    const share = searchParams.get('share');
    const addr = searchParams.get('address');
    if (share) {
      deepLinkDone.current = true;
      (async () => {
        try {
          const r = await fetch(`/api/bubble-map/share?t=${encodeURIComponent(share)}`);
          if (!r.ok) return;
          const p = (await r.json()) as { token?: string; chain?: string; mode?: ViewMode };
          if (p.token) setTokenAddress(p.token);
          if (p.chain) setChain(p.chain);
          if (p.mode) setMode(p.mode);
          // `at` (legacy snapshot timestamp) is ignored — holder intel is live-only.
        } catch { /* ignore bad/expired share token */ }
      })();
    } else if (addr) {
      deepLinkDone.current = true;
      setTokenAddress(addr);
      const c = searchParams.get('chain');
      if (c) setChain(c);
    }
  }, [searchParams]);

  // Auto-fire the map exactly once when a deep link populates the address.
  // (The old `!mapData && !loading` guard re-fired forever when the fetch
  // errored, hammering the API in a loop.)
  useEffect(() => {
    if (deepLinkDone.current && tokenAddress.trim() && !autoFired.current) {
      autoFired.current = true;
      void fetchMap();
    }
  }, [tokenAddress, fetchMap]);

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
        }),
      });
      if (!res.ok) return;
      const j = await res.json() as { url: string };
      setShareUrl(j.url);
      try { await navigator.clipboard.writeText(j.url); } catch { /* clipboard unavailable */ }
    } finally {
      setSharing(false);
    }
  }, [tokenAddress, chain, mode]);

  function handleModeChange(m: ViewMode) {
    setMode(m);
    if (mapData) fetchMap(m);
  }

  const sendChat = useCallback(async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || chatLoading) return;

    // If the user pasted a bare token address into the agent, LOAD the bubble
    // map for it instead of treating it as a question — that's exactly what the
    // agent's welcome message promises ("Enter a token address to visualize
    // holder distribution"). Previously this fell through to the chat API with
    // no map context, so it just replied "No bubble map data has been loaded".
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(msg);
    const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(msg) && !msg.startsWith('0x');
    if ((isEvm || isSol) && msg !== tokenAddress.trim()) {
      const nextChain = isSol ? 'solana' : (chain === 'solana' ? 'ethereum' : chain);
      const shortCa = `${msg.slice(0, 6)}…${msg.slice(-4)}`;
      setChatMessages(p => [...p,
        { role: 'user', content: msg, timestamp: Date.now() },
        { role: 'assistant', content: `Loading the bubble map for ${shortCa} on ${nextChain}. Give me a second — then ask me anything about the holders, clusters, or risk.`, timestamp: Date.now() },
      ]);
      setChatInput('');
      setTokenAddress(msg);
      setChain(nextChain);
      void fetchMap(mode, msg, nextChain);
      return;
    }

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
        riskLevel: mapData.security?.riskLevel,
        topHolders: mapData.nodes
          .filter(n => n.id !== 'center')
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
  }, [chatInput, chatLoading, chatMessages, mapData, tokenAddress, chain, mode, fetchMap]);

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
  const holderNodes = useMemo(
    () => (mapData?.nodes ?? []).filter(n => n.id !== 'center').sort((a, b) => b.percentage - a.percentage),
    [mapData],
  );
  const maxHolderPct = holderNodes[0]?.percentage ?? 0;
  // Legend shows only the holder types actually present in this token's
  // graph, with live counts — not a static list of every possible type.
  const legendEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of holderNodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, color: NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLORS.unknown }));
  }, [holderNodes]);
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3 px-4 h-14 max-w-[1440px] mx-auto">
          <BackButton />
          <div className="w-9 h-9 bg-gradient-to-br from-[#0066FF] to-[#4F46E5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0066FF]/20 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Bubble Map</span>
              <span className="px-1.5 py-0.5 bg-[#0066FF]/15 border border-[#0066FF]/30 rounded text-[9px] text-[#0066FF] font-bold">INTEL</span>
            </div>
            <span className="text-[10px] text-gray-600 truncate block">Token holder distribution · D3 force graph</span>
          </div>
          <HowItWorksButton content={bubbleMapHowItWorks} className="ms-auto shrink-0" />
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4 pb-8">
        {/* Token entry */}
        <GlassCard className="rounded-2xl p-3 sm:p-4">
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowChainDrop(v => !v)}
                className="h-11 px-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs font-medium text-gray-300 flex items-center gap-1.5 hover:border-white/[0.15] transition-colors">
                {CHAIN_OPTIONS.find(c => c.value === chain)?.label}<ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              {showChainDrop && <>
                <div className="fixed inset-0 z-30" onClick={() => setShowChainDrop(false)} />
                <div className="absolute top-full left-0 mt-1 w-40 nl-glass rounded-xl overflow-hidden z-40 shadow-xl">
                  {CHAIN_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => { setChain(c.value); setShowChainDrop(false); }}
                      className={`w-full text-start px-3 py-2.5 text-xs hover:bg-white/[0.06] transition-colors ${chain === c.value ? 'text-[#0066FF]' : 'text-gray-400'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </>}
            </div>
            <div className="flex-1 min-w-0 flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 focus-within:border-[#0066FF]/30 transition-colors">
              <Search className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchMap()}
                placeholder="Token contract address…"
                className="w-full min-w-0 bg-transparent py-3 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono" />
            </div>
            <button onClick={() => fetchMap()} disabled={loading || !tokenAddress.trim()}
              className="h-11 px-4 nl-btn-neon rounded-xl text-xs font-bold disabled:opacity-30 flex-shrink-0">
              {loading ? '…' : 'Analyze'}
            </button>
          </div>
        </GlassCard>

        {/* Error state */}
        {errorMsg && !loading && (
          <GlassCard className="rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#EF4444]">Bubble map unavailable</p>
                <p className="text-xs text-gray-400 mt-0.5">{errorMsg}</p>
                <button onClick={() => fetchMap()}
                  className="mt-2.5 px-3 py-1.5 nl-btn-neon rounded-lg text-[11px] font-bold">
                  Retry
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Token overview + controls */}
        {info && (
          <GlassCard className="rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="min-w-0">
                <span className="text-sm font-bold">{info.symbol || info.name}</span>
                {info.name && info.symbol && (
                  <span className="ms-2 text-[10px] text-gray-500 truncate">{info.name}</span>
                )}
              </div>
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
                <span>Holders: <span className="text-gray-300 font-mono">{info.totalHolders > 0 ? info.totalHolders.toLocaleString() : '—'}</span></span>
              </div>
            </div>

            {/* Mode tabs + live badge + share */}
            <div className="flex gap-1.5 mt-3 flex-wrap items-center">
              {MODE_TABS.map(tab => (
                <button key={tab.id} onClick={() => handleModeChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${mode === tab.id ? 'nl-btn-neon' : 'nl-button--ghost'}`}>
                  <tab.icon className="w-3 h-3" />{tab.label}
                </button>
              ))}
              {/* BUBBLE4 — holder intel is live-only (no historical snapshot
                  store wired yet), so we show an honest "Live" badge instead of
                  a datetime scrubber that would imply time travel it can't do. */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400"
                title="Holder distribution reflects current on-chain data. Historical snapshots are coming."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                Live
              </span>
              <button
                type="button"
                onClick={() => void shareView()}
                disabled={sharing || !tokenAddress.trim()}
                className="ms-auto bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[10px] text-slate-200 disabled:opacity-50 transition-colors"
              >
                {sharing ? 'Signing…' : shareUrl ? 'Copied!' : 'Share'}
              </button>
            </div>
          </GlassCard>
        )}

        {/* Main area */}
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch">
          {/* Left column: graph + concentration */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            <GlassCard
              className={isFullscreen
                ? 'fixed inset-0 z-50 rounded-none bg-[#05080F] overflow-hidden'
                : 'relative rounded-2xl overflow-hidden h-[420px] sm:h-[500px]'}
            >
              <div className={isFullscreen ? 'absolute inset-0' : 'relative w-full h-full'}>
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SteinzLogoSpinner size={56} message="Loading holder data…" />
                  </div>
                ) : !mapData ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
                    <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                      <Layers className="w-10 h-10 text-gray-700" />
                    </div>
                    <p className="text-sm font-semibold text-gray-400">No token loaded</p>
                    <p className="text-xs text-gray-600 max-w-xs text-center">Paste a token contract address in the search above — or drop it into the agent below — to visualize the holder distribution network.</p>
                  </div>
                ) : holderNodes.length === 0 ? (
                  /* Honest empty state — the intel pipeline resolved the token
                     but returned zero holders (e.g. indexer gap on this chain).
                     Never draw a fabricated graph. */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
                    <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                      <Network className="w-8 h-8 text-gray-700" />
                    </div>
                    <p className="text-sm font-semibold text-gray-400">No holder data available</p>
                    <p className="text-xs text-gray-600 max-w-xs text-center">
                      The holder indexer returned no wallets for this token on {CHAIN_OPTIONS.find(c => c.value === chain)?.label ?? chain}. Try again shortly or verify the chain selection.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#060A12]/80 border border-white/[0.10] rounded-lg px-2.5 py-1.5 backdrop-blur-md max-w-[calc(100%-70px)]">
                      <Search className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      <input
                        value={pinnedAddress}
                        onChange={(e) => setPinnedAddress(e.target.value)}
                        placeholder="Find wallet…"
                        className="bg-transparent text-[11px] font-mono w-32 sm:w-44 min-w-0 focus:outline-none placeholder-gray-600"
                      />
                      {pinnedAddress && (
                        <button
                          onClick={() => setPinnedAddress('')}
                          className="text-[10px] text-gray-500 hover:text-white flex-shrink-0"
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
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                      className="absolute top-3 right-3 p-2 bg-[#060A12]/80 border border-white/[0.10] rounded-lg transition-colors backdrop-blur-sm z-10 hover:border-white/[0.2]">
                      {isFullscreen ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
                    </button>
                    {/* Legend — only the holder types present in this graph, with counts */}
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5 pointer-events-none">
                      {legendEntries.map(({ type, count, color }) => (
                        <div key={type} className="flex items-center gap-1.5 px-2 py-1 bg-[#060A12]/80 border border-white/[0.08] rounded-md backdrop-blur-sm">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[9px] text-gray-400">{TYPE_LABELS[type] ?? type} <span className="text-gray-600">({count})</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </GlassCard>

            {mapData && holderNodes.length > 0 && (
              <ConcentrationCard
                nodes={mapData.nodes}
                security={mapData.security}
                totalHolders={mapData.tokenInfo.totalHolders}
                dataSource={mapData.tokenInfo.dataSource}
              />
            )}
          </div>

          {/* Right column: holders + agent */}
          <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 space-y-3 sm:space-y-4">
            {/* Holder distribution list */}
            {holderNodes.length > 0 && (
              <GlassCard className="rounded-2xl overflow-hidden">
                <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#0066FF]" />Top Holders
                  </h2>
                  <span className="text-[10px] text-gray-500 font-mono">{holderNodes.length} tracked</span>
                </div>
                <div className="px-4 py-1.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider border-b border-white/[0.04]">
                  <div className="grid grid-cols-[20px_minmax(0,1fr)_55px_55px] gap-2"><span>#</span><span>Holder</span><span className="text-end">%</span><span className="text-end">Type</span></div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {holderNodes.map((node, idx) => (
                    <div key={node.id} onClick={() => setSelectedNode(node.id === selectedNode?.id ? null : node)}
                      className={`px-4 py-2 text-[10px] cursor-pointer transition-colors hover:bg-white/[0.03] ${selectedNode?.id === node.id ? 'bg-[#0066FF]/[0.06]' : ''}`}>
                      <div className="grid grid-cols-[20px_minmax(0,1fr)_55px_55px] gap-2 items-center">
                        <span className="text-gray-600 font-mono">{idx + 1}</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
                          <span className="text-gray-300 truncate">{node.entityName || node.entity || node.label}</span>
                          {node.verified && <Check className="w-2.5 h-2.5 text-[#10B981] flex-shrink-0" />}
                        </div>
                        <span className="text-end text-white font-mono">{node.percentage.toFixed(2)}%</span>
                        <span className="text-end font-medium text-[9px]" style={{ color: node.color }}>{TYPE_LABELS[node.type]}</span>
                      </div>
                      {/* Distribution bar — relative to the largest tracked holder */}
                      <div className="mt-1.5 ms-[28px] h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${maxHolderPct > 0 ? Math.max(1.5, (node.percentage / maxHolderPct) * 100) : 0}%`, background: node.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Bubble Map Agent */}
            <GlassCard className="rounded-2xl overflow-hidden flex flex-col h-[440px]">
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2 flex-shrink-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0066FF]/20 to-[#4F46E5]/20 border border-[#0066FF]/15 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[#0066FF]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Bubble Map Agent</span>
                  <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] ${msg.role === 'user' ? 'bg-[#0066FF]/20' : 'bg-white/[0.05]'}`}>
                      {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-[#0066FF]" /> : <Bot className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <div className={`relative group max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-[#0066FF]/15 text-gray-100' : 'bg-white/[0.04] text-gray-200'}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
                        className="text-[10px] px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-[#0066FF]/40 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="Ask about holders, risk, dev wallets…"
                    className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/30 transition-colors" />
                  <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                    className="w-9 h-9 nl-btn-neon rounded-xl flex items-center justify-center disabled:opacity-30 flex-shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BubbleMapPage() {
  return (
    <Suspense fallback={null}>
      <BubbleMapInner />
    </Suspense>
  );
}
