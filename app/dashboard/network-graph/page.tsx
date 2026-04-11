'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Network,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import * as d3 from 'd3';
import type { NetworkNode, NetworkEdge, NetworkStats, NetworkGraphResponse } from '@/app/api/network-graph/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NetworkNode['type'], string> = {
  'high-activity': '#10D9B0',
  'bridge':        '#7C3AED',
  'usdc':          '#4F8EF7',
  'usdt':          '#10B981',
  'regular':       '#4B5563',
};

const LEGEND_ITEMS: { type: NetworkNode['type']; label: string }[] = [
  { type: 'usdc',          label: 'USDC Transfer' },
  { type: 'usdt',          label: 'USDT Transfer' },
  { type: 'high-activity', label: 'High-Activity Wallet' },
  { type: 'bridge',        label: 'Bridge / Protocol' },
  { type: 'regular',       label: 'Regular Wallet' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
}

function fmtVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TooltipState {
  node: NetworkNode;
  screenX: number;
  screenY: number;
  connectedIds: Set<string>;
}

interface D3Node extends NetworkNode {
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
}

interface D3Link {
  source: D3Node;
  target: D3Node;
  type: 'usdc' | 'usdt';
  amount: number;
  count: number;
}

// ─── Sidebar Section (collapsible on mobile) ─────────────────────────────────

function SideSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <button
        className="w-full flex items-center justify-between py-2 px-0 lg:cursor-default group"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest">
          {title}
        </span>
        <span className="lg:hidden text-gray-600 group-hover:text-gray-400 transition-colors">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block pb-3`}>{children}</div>
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-10 mt-1">
      {data.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all duration-300"
          style={{
            height: `${Math.max(8, (val / max) * 100)}%`,
            backgroundColor: i === Math.floor(data.length / 2) ? '#0A1EFF' : '#1E3A8A',
          }}
        />
      ))}
    </div>
  );
}

// ─── D3 Graph Component ───────────────────────────────────────────────────────

function ForceGraph({
  nodes,
  edges,
  onNodeHover,
  onNodeClick,
  selectedNodeId,
  highlightIds,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  onNodeHover: (node: NetworkNode | null, x: number, y: number, connectedIds: Set<string>) => void;
  onNodeClick: (node: NetworkNode | null) => void;
  selectedNodeId: string | null;
  highlightIds: Set<string>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Compute radius from volume
    const maxVol = Math.max(...nodes.map(n => n.volume), 1);
    const radiusScale = d3.scaleSqrt().domain([0, maxVol]).range([6, 28]);

    const d3Nodes: D3Node[] = nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      radius: radiusScale(n.volume),
    }));

    const nodeById = new Map(d3Nodes.map(n => [n.id, n]));

    const d3Links: D3Link[] = edges
      .map(e => ({
        source: nodeById.get(e.source)!,
        target: nodeById.get(e.target)!,
        type: e.type,
        amount: e.amount,
        count: e.count,
      }))
      .filter(l => l.source && l.target);

    // Build connection map for adjacency
    const connectionMap = new Map<string, Set<string>>();
    d3Links.forEach(l => {
      const s = (l.source as D3Node).id;
      const t = (l.target as D3Node).id;
      if (!connectionMap.has(s)) connectionMap.set(s, new Set());
      if (!connectionMap.has(t)) connectionMap.set(t, new Set());
      connectionMap.get(s)!.add(t);
      connectionMap.get(t)!.add(s);
    });

    // Defs (glow filters + arrow markers)
    const defs = svg.append('defs');

    defs.append('filter').attr('id', 'glow').html(`
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    `);

    defs.append('filter').attr('id', 'glow-strong').html(`
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    `);

    defs.append('marker')
      .attr('id', 'arrow-usdc')
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('refX', 5).attr('refY', 3)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L0,6 L6,3 z')
      .attr('fill', '#4F8EF750');

    defs.append('marker')
      .attr('id', 'arrow-usdt')
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('refX', 5).attr('refY', 3)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L0,6 L6,3 z')
      .attr('fill', '#10B98150');

    // Main group (for zoom/pan)
    const g = svg.append('g').attr('class', 'graph-root');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Initial zoom to fit
    const initialScale = Math.min(width, height) / 700;
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale).translate(-width / 2, -height / 2));

    // Links layer
    const linkGroup = g.append('g').attr('class', 'links');
    const linkEls = linkGroup
      .selectAll<SVGLineElement, D3Link>('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', d => d.type === 'usdc' ? '#4F8EF730' : '#10B98130')
      .attr('stroke-width', d => Math.max(1, Math.min(3, Math.log(d.count + 1))))
      .attr('stroke-dasharray', '5 3')
      .attr('marker-end', d => `url(#arrow-${d.type})`);

    // Nodes layer
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeEls = nodeGroup
      .selectAll<SVGGElement, D3Node>('g.node')
      .data(d3Nodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Halo ring for high-value nodes
    nodeEls
      .filter(d => d.type === 'high-activity' || d.type === 'bridge')
      .append('circle')
      .attr('class', 'halo')
      .attr('r', d => d.radius + 10)
      .attr('fill', 'none')
      .attr('stroke', d => NODE_COLORS[d.type])
      .attr('stroke-width', 1)
      .attr('opacity', 0.2);

    // Main circles
    nodeEls.append('circle')
      .attr('class', 'main-circle')
      .attr('r', d => d.radius)
      .attr('fill', d => `${NODE_COLORS[d.type]}22`)
      .attr('stroke', d => NODE_COLORS[d.type])
      .attr('stroke-width', d => (d.type === 'high-activity' || d.type === 'bridge') ? 2 : 1.2)
      .attr('filter', d => (d.type === 'high-activity' || d.type === 'bridge') ? 'url(#glow-strong)' : 'url(#glow)');

    // Labels
    nodeEls.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 10)
      .attr('font-size', '9')
      .attr('fill', '#6B7280')
      .attr('font-family', 'monospace')
      .attr('pointer-events', 'none')
      .text(d => shortAddr(d.address));

    // Drag behavior
    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeEls.call(drag as any);

    // Hover + click
    nodeEls
      .on('mouseenter', function (event, d) {
        const rect = svgRef.current!.getBoundingClientRect();
        const connectedIds = connectionMap.get(d.id) || new Set<string>();
        onNodeHover(d, event.clientX - rect.left, event.clientY - rect.top, connectedIds);
      })
      .on('mouseleave', function () {
        onNodeHover(null, 0, 0, new Set());
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        onNodeClick(d);
      });

    svg.on('click', () => onNodeClick(null));

    // Force simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id(d => d.id)
        .distance(d => {
          const s = d.source as D3Node;
          const t = d.target as D3Node;
          return (s.radius + t.radius) * 2.5 + 20;
        })
        .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-220).distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide<D3Node>().radius(d => d.radius + 8).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      linkEls
        .attr('x1', d => (d.source as D3Node).x)
        .attr('y1', d => (d.source as D3Node).y)
        .attr('x2', d => (d.target as D3Node).x)
        .attr('y2', d => (d.target as D3Node).y);

      nodeEls.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Apply highlight/dim whenever selection changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGGElement, D3Node>('g.node').each(function (d) {
      const el = d3.select(this);
      const isHighlighted = highlightIds.size === 0 || highlightIds.has(d.id);
      el.select('.main-circle')
        .attr('fill', isHighlighted ? `${NODE_COLORS[d.type]}33` : `${NODE_COLORS[d.type]}08`)
        .attr('stroke', isHighlighted ? NODE_COLORS[d.type] : '#374151')
        .attr('stroke-width', d.id === selectedNodeId ? 3 : (d.type === 'high-activity' || d.type === 'bridge') ? 2 : 1.2);
      el.select('text')
        .attr('fill', isHighlighted ? '#9CA3AF' : '#374151');
      el.select('.halo')
        .attr('opacity', isHighlighted ? 0.25 : 0.05);
    });

    svg.selectAll<SVGLineElement, D3Link>('line').each(function (d) {
      const s = (d.source as D3Node).id;
      const t = (d.target as D3Node).id;
      const isHighlighted = highlightIds.size === 0 ||
        (highlightIds.has(s) && highlightIds.has(t));
      d3.select(this)
        .attr('stroke', isHighlighted
          ? (d.type === 'usdc' ? '#4F8EF755' : '#10B98155')
          : '#ffffff05')
        .attr('stroke-width', isHighlighted ? Math.max(1.2, Math.min(3, Math.log((d.count || 1) + 1))) : 0.5);
    });
  }, [highlightIds, selectedNodeId]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetworkGraphPage() {
  const router = useRouter();
  const [walletInput, setWalletInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NetworkGraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (wallet?: string) => {
    setLoading(true);
    setSelectedNode(null);
    setHighlightIds(new Set());
    setTooltip(null);
    try {
      const url = wallet ? `/api/network-graph?wallet=${encodeURIComponent(wallet)}` : '/api/network-graph';
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const json: NetworkGraphResponse = await res.json();
      setData(json);
    } catch {
      // Will show empty state — API should always return mock fallback
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAnalyze = useCallback(() => {
    const trimmed = walletInput.trim();
    if (trimmed) fetchData(trimmed);
    else fetchData();
  }, [walletInput, fetchData]);

  const handleNodeHover = useCallback((
    node: NetworkNode | null,
    x: number,
    y: number,
    connectedIds: Set<string>,
  ) => {
    if (!node) {
      setTooltip(null);
      if (!selectedNode) setHighlightIds(new Set());
      return;
    }
    const allHighlight = new Set([node.id, ...connectedIds]);
    setTooltip({ node, screenX: x, screenY: y, connectedIds: allHighlight });
    if (!selectedNode) setHighlightIds(allHighlight);
  }, [selectedNode]);

  const handleNodeClick = useCallback((node: NetworkNode | null) => {
    if (!node) {
      setSelectedNode(null);
      setHighlightIds(new Set());
      return;
    }
    setSelectedNode(node);
    // highlight will be driven by the graph's connection map passed via hover
    // but here we at minimum highlight the node itself
    setHighlightIds(prev => {
      // keep current tooltip highlights
      if (tooltip?.connectedIds) return new Set(tooltip.connectedIds);
      return new Set([node.id]);
    });
  }, [tooltip]);

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  const stats: NetworkStats = data?.stats || {
    clusters: 0, avgDegree: 0, density: 0,
    usdcTxns: 0, usdtTxns: 0, totalVolume: 0, timelineData: [],
  };

  const topWallets = [...nodes]
    .map(n => ({
      ...n,
      linkCount: edges.filter(e => e.source === n.id || e.target === n.id).length,
    }))
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, 6);

  const tooltipWidth = 180;
  const containerW = graphContainerRef.current?.clientWidth || 800;
  const tooltipX = tooltip
    ? Math.min(tooltip.screenX + 14, containerW - tooltipWidth - 8)
    : 0;
  const tooltipY = tooltip ? tooltip.screenY - 20 : 0;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <Network className="w-4 h-4 text-[#0A1EFF] flex-shrink-0" />
        <h1 className="font-bold text-sm flex-1 truncate">Network Graph</h1>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Nodes {nodes.length}
          </span>
          <span className="text-white/20 text-xs">|</span>
          <span className="text-[10px] text-gray-400">Edges {edges.length}</span>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-[#0D1117]">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="Enter wallet address or token CA..."
              className="w-full bg-[#0A0E1A] border border-white/[0.08] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0A1EFF]/50 focus:bg-[#0A0E1A] transition-all"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-[#0A1EFF] hover:bg-[#0A1EFF]/80 text-white text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0 whitespace-nowrap"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3 sm:block hidden" />
            )}
            <span className="hidden sm:inline">Analyze</span>
            <span className="sm:hidden">Go</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

        {/* ── Left Panel ── */}
        <aside className="lg:w-56 flex-shrink-0 bg-[#0D1117] border-b lg:border-b-0 lg:border-r border-white/[0.06] flex flex-col overflow-hidden">
          {/* Mobile toggle */}
          <button
            className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] text-xs text-gray-400 hover:text-white transition-colors"
            onClick={() => setPanelOpen(o => !o)}
          >
            <span className="font-semibold">Stats &amp; Legend</span>
            {panelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className={`${panelOpen ? 'flex' : 'hidden'} lg:flex flex-col gap-0 overflow-y-auto flex-1 p-3 pt-2`}>

            {/* Network Overview */}
            <SideSection title="Network Overview">
              <div className="space-y-0">
                {[
                  { label: 'Clusters',   value: stats.clusters },
                  { label: 'Avg Degree', value: stats.avgDegree },
                  { label: 'Density',    value: stats.density },
                  { label: 'USDC Txns',  value: stats.usdcTxns },
                  { label: 'USDT Txns',  value: stats.usdtTxns },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-[10px] text-gray-500">{label}</span>
                    <span className="text-[10px] font-semibold text-white tabular-nums">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </span>
                  </div>
                ))}
              </div>
            </SideSection>

            {/* Top Wallets */}
            <SideSection title="Top Wallets by Connections">
              <div className="space-y-0">
                {topWallets.length === 0 ? (
                  <p className="text-[10px] text-gray-600 italic">No data</p>
                ) : topWallets.map(w => (
                  <div key={w.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] gap-1">
                    <span className="text-[10px] font-mono text-gray-400 truncate">
                      {shortAddr(w.address)}
                    </span>
                    <span className="text-[9px] font-bold text-[#4F8EF7] flex-shrink-0">
                      {w.linkCount} links
                    </span>
                  </div>
                ))}
              </div>
            </SideSection>

            {/* Transfer Timeline */}
            <SideSection title="Transfer Timeline" defaultOpen={false}>
              {stats.timelineData && stats.timelineData.length > 0 ? (
                <MiniBarChart data={stats.timelineData} />
              ) : (
                <div className="h-10 flex items-center">
                  <span className="text-[10px] text-gray-600 italic">No timeline data</span>
                </div>
              )}
            </SideSection>

            {/* Legend */}
            <SideSection title="Legend">
              <div className="space-y-2 pt-0.5">
                {LEGEND_ITEMS.map(({ type, label }) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: NODE_COLORS[type] }}
                    />
                    <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </SideSection>

            {/* Source badge */}
            {data?.source && (
              <div className="mt-auto pt-3">
                <span className="text-[9px] text-gray-700 uppercase tracking-widest">
                  Source: {data.source}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* ── Graph Area ── */}
        <div
          ref={graphContainerRef}
          className="flex-1 relative overflow-hidden"
          style={{ minHeight: '400px' }}
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0A0E1A]">
              <Loader2 className="w-8 h-8 animate-spin text-[#0A1EFF]" />
              <p className="text-xs text-gray-500">Building network graph...</p>
            </div>
          ) : !data || nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0A0E1A]">
              <Network className="w-10 h-10 text-gray-700" />
              <p className="text-sm text-gray-500">No network data available</p>
              <button
                onClick={() => fetchData()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg hover:border-white/20 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Reload
              </button>
            </div>
          ) : (
            <ForceGraph
              nodes={nodes}
              edges={edges}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id || null}
              highlightIds={highlightIds}
            />
          )}

          {/* Floating Tooltip */}
          {tooltip && !loading && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{ left: tooltipX, top: tooltipY }}
            >
              <div className="bg-[#0D1117] border border-white/[0.1] rounded-xl p-3 shadow-2xl min-w-[160px]">
                <p className="text-[9px] text-gray-500 font-mono mb-1 truncate max-w-[160px]">
                  {shortAddr(tooltip.node.address)}
                </p>
                <p className="text-sm font-bold text-white mb-0.5">
                  {fmtVolume(tooltip.node.volume)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: NODE_COLORS[tooltip.node.type] }}
                  />
                  <span className="text-[10px] text-gray-400 capitalize">{tooltip.node.type}</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">
                  {tooltip.node.txCount} txns · {tooltip.connectedIds.size - 1} connected
                </p>
              </div>
            </div>
          )}

          {/* Selected node side panel */}
          {selectedNode && !loading && (
            <div className="absolute top-3 right-3 z-20 w-52 bg-[#0D1117] border border-white/[0.1] rounded-xl p-3 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
                  />
                  <span className="text-[10px] font-semibold capitalize text-white">
                    {selectedNode.type}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedNode(null); setHighlightIds(new Set()); }}
                  className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-[9px] font-mono text-gray-500 mb-2 break-all">
                {selectedNode.address.length > 20
                  ? `${selectedNode.address.slice(0, 10)}...${selectedNode.address.slice(-8)}`
                  : selectedNode.address}
              </p>

              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Volume</span>
                  <span className="font-bold text-white">{fmtVolume(selectedNode.volume)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Transactions</span>
                  <span className="font-bold text-white">{selectedNode.txCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Connections</span>
                  <span className="font-bold text-[#4F8EF7]">
                    {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Zoom hint */}
          {!loading && nodes.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10">
              <span className="text-[9px] text-gray-700 bg-[#0D1117]/80 px-2 py-1 rounded-lg border border-white/[0.04]">
                Scroll to zoom · Drag to pan · Click node to select
              </span>
            </div>
          )}

          {/* Refresh button */}
          {!loading && (
            <button
              onClick={() => fetchData(walletInput.trim() || undefined)}
              className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-gray-500 hover:text-gray-300 bg-[#0D1117]/80 border border-white/[0.06] rounded-lg hover:border-white/[0.12] transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
