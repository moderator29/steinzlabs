'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Network, RefreshCw, Pause, Play, Plus, Filter } from 'lucide-react';

interface WalletNode {
  id: string;
  address: string;
  shortAddr: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'usdc' | 'usdt' | 'high-activity' | 'bridge' | 'regular';
  volume: number;
  connections: number;
}

interface TransferEdge {
  from: string;
  to: string;
  type: 'usdc' | 'usdt';
  amount: number;
}

const NODE_COLORS: Record<string, string> = {
  'usdc': '#4F8EF7',
  'usdt': '#10B981',
  'high-activity': '#10D9B0',
  'bridge': '#7C3AED',
  'regular': '#4B5563',
};

const LEGEND_ITEMS = [
  { type: 'usdc', label: 'USDC Transfer', color: '#4F8EF7' },
  { type: 'usdt', label: 'USDT Transfer', color: '#10B981' },
  { type: 'high-activity', label: 'High-Activity Wallet', color: '#10D9B0' },
  { type: 'bridge', label: 'Bridge / Protocol', color: '#7C3AED' },
  { type: 'regular', label: 'Regular Wallet', color: '#4B5563' },
];

function generateNodes(count: number, width: number, height: number): WalletNode[] {
  const types: WalletNode['type'][] = ['usdc', 'usdt', 'high-activity', 'bridge', 'regular'];
  const nodes: WalletNode[] = [];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const isHighValue = type === 'high-activity' || type === 'bridge';
    const volume = isHighValue ? Math.random() * 5000000 + 500000 : Math.random() * 200000 + 10000;
    const radius = isHighValue ? 18 + Math.random() * 12 : 8 + Math.random() * 8;
    const hex = Math.random() > 0.5
      ? '0x' + Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')).join('').slice(0, 8) + '...' + Math.random().toString(16).slice(2, 6)
      : Array.from({ length: 4 }, () => Math.floor(Math.random() * 9999).toString().padStart(4, '0')).join('').slice(0, 6) + '...' + Math.floor(Math.random() * 9999).toString().slice(0, 4);

    nodes.push({
      id: `node-${i}`,
      address: hex,
      shortAddr: hex,
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius,
      type,
      volume,
      connections: Math.floor(Math.random() * 5) + 1,
    });
  }
  return nodes;
}

function generateEdges(nodes: WalletNode[]): TransferEdge[] {
  const edges: TransferEdge[] = [];
  const count = Math.min(nodes.length * 1.2, 22);
  for (let i = 0; i < count; i++) {
    const from = nodes[Math.floor(Math.random() * nodes.length)];
    let to = nodes[Math.floor(Math.random() * nodes.length)];
    while (to.id === from.id) to = nodes[Math.floor(Math.random() * nodes.length)];
    edges.push({
      from: from.id,
      to: to.id,
      type: Math.random() > 0.5 ? 'usdc' : 'usdt',
      amount: Math.random() * 500000 + 1000,
    });
  }
  return edges;
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function NetworkGraphPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'usdc' | 'usdt'>('all');
  const [tooltip, setTooltip] = useState<{ node: WalletNode; x: number; y: number } | null>(null);
  const [nodes, setNodes] = useState<WalletNode[]>([]);
  const [edges, setEdges] = useState<TransferEdge[]>([]);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  const nodesRef = useRef<WalletNode[]>([]);
  const pausedRef = useRef(false);

  useEffect(() => {
    const w = window.innerWidth;
    const h = Math.min(window.innerHeight * 0.55, 500);
    setDims({ w, h });
    const initialNodes = generateNodes(18, w, h);
    const initialEdges = generateEdges(initialNodes);
    nodesRef.current = initialNodes;
    setNodes([...initialNodes]);
    setEdges(initialEdges);
  }, []);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Physics simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const tick = () => {
      if (!pausedRef.current) {
        nodesRef.current = nodesRef.current.map(node => {
          let vx = node.vx;
          let vy = node.vy;

          // Center gravity
          const cx = dims.w / 2;
          const cy = dims.h / 2;
          vx += (cx - node.x) * 0.0002;
          vy += (cy - node.y) * 0.0002;

          // Node repulsion
          for (const other of nodesRef.current) {
            if (other.id === node.id) continue;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = node.radius + other.radius + 30;
            if (dist < minDist) {
              const force = (minDist - dist) / dist * 0.05;
              vx += dx * force;
              vy += dy * force;
            }
          }

          // Damping
          vx *= 0.98;
          vy *= 0.98;

          // Clamp to bounds
          const padding = node.radius + 10;
          let x = node.x + vx;
          let y = node.y + vy;
          if (x < padding) { x = padding; vx = Math.abs(vx) * 0.5; }
          if (x > dims.w - padding) { x = dims.w - padding; vx = -Math.abs(vx) * 0.5; }
          if (y < padding) { y = padding; vy = Math.abs(vy) * 0.5; }
          if (y > dims.h - padding) { y = dims.h - padding; vy = -Math.abs(vy) * 0.5; }

          return { ...node, x, y, vx, vy };
        });
        setNodes([...nodesRef.current]);
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length, dims]);

  const filteredEdges = edges.filter(e => filter === 'all' || e.type === filter);

  const topWallets = [...nodes]
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);

  const usdcCount = edges.filter(e => e.type === 'usdc').length;
  const usdtCount = edges.filter(e => e.type === 'usdt').length;
  const clusters = Math.floor(nodes.length / 3);

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div className="min-h-screen bg-[#060A12] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060A12]/95 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <Network className="w-4 h-4 text-[#0A1EFF]" />
        <div className="flex-1">
          <h1 className="font-heading font-bold text-sm">Network Graph</h1>
          <p className="text-[9px] text-gray-500">On-chain stablecoin transfer topology</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse inline-block" />
          Nodes {nodes.length}
        </div>
        <span className="text-gray-700 text-[10px]">·</span>
        <div className="text-[10px] text-gray-500">Edges {filteredEdges.length}</div>
      </div>

      {/* Mobile: stack vertically, Desktop: side-by-side */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left panel - hidden on mobile unless toggled */}
        <div className="lg:w-52 w-full flex-shrink-0 lg:border-r border-b lg:border-b-0 border-white/[0.06] p-3 flex flex-col lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto bg-[#060A12] lg:max-h-none max-h-32">
          <div className="flex lg:flex-col flex-row gap-3 min-w-max lg:min-w-0">
          <div>
            <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Network Overview</p>
            {[
              { label: 'Clusters', value: clusters },
              { label: 'Avg Degree', value: '1.5' },
              { label: 'Density', value: '0.0554' },
              { label: 'USDC Txns', value: usdcCount },
              { label: 'USDT Txns', value: usdtCount },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-[10px] text-gray-500">{label}</span>
                <span className="text-[10px] font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Top Wallets by Connections</p>
            {topWallets.map(w => (
              <div key={w.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-[10px] font-mono text-gray-400 truncate max-w-[110px]">{w.shortAddr}</span>
                <span className="text-[9px] font-bold text-[#4F8EF7] ml-1 flex-shrink-0">{w.connections} links</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Transfer Timeline</p>
            <div className="flex items-end gap-0.5 h-10">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${20 + Math.random() * 80}%`,
                    backgroundColor: i === 3 ? '#0A1EFF' : '#1E3A5F',
                  }}
                />
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Graph area - full width on mobile, flex-1 on desktop */}
        <div className="flex-1 relative overflow-hidden" style={{ minHeight: '60vh' }}>
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-strong">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Edges */}
            {filteredEdges.map((edge, i) => {
              const from = nodeMap[edge.from];
              const to = nodeMap[edge.to];
              if (!from || !to) return null;
              return (
                <line
                  key={i}
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={edge.type === 'usdc' ? '#4F8EF730' : '#10B98130'}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const color = NODE_COLORS[node.type];
              const isHighValue = node.type === 'high-activity' || node.type === 'bridge';
              return (
                <g
                  key={node.id}
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget.closest('svg') as SVGElement).getBoundingClientRect();
                    setTooltip({ node, x: node.x, y: node.y });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Halo for high-activity nodes */}
                  {isHighValue && (
                    <circle
                      cx={node.x} cy={node.y}
                      r={node.radius + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth={1}
                      opacity={0.2}
                    />
                  )}
                  {/* Main circle */}
                  <circle
                    cx={node.x} cy={node.y}
                    r={node.radius}
                    fill={`${color}25`}
                    stroke={color}
                    strokeWidth={isHighValue ? 2 : 1}
                    filter={isHighValue ? 'url(#glow-strong)' : 'url(#glow)'}
                  />
                  {/* Label */}
                  <text
                    x={node.x} y={node.y + node.radius + 10}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#6B7280"
                    fontFamily="monospace"
                  >
                    {node.shortAddr.slice(0, 10)}
                  </text>
                </g>
              );
            })}

            {/* Tooltip */}
            {tooltip && (
              <g>
                <rect
                  x={Math.min(tooltip.x + 12, dims.w - 160)}
                  y={tooltip.y - 30}
                  width={150}
                  height={56}
                  rx={6}
                  fill="#0f1420"
                  stroke="#ffffff15"
                />
                <text x={Math.min(tooltip.x + 20, dims.w - 152)} y={tooltip.y - 12} fontSize="9" fill="#9CA3AF" fontFamily="monospace">
                  {tooltip.node.shortAddr}
                </text>
                <text x={Math.min(tooltip.x + 20, dims.w - 152)} y={tooltip.y + 3} fontSize="10" fill="white" fontWeight="bold">
                  {formatVolume(tooltip.node.volume)}
                </text>
                <text x={Math.min(tooltip.x + 20, dims.w - 152)} y={tooltip.y + 17} fontSize="9" fill="#6B7280">
                  {tooltip.node.connections} connections · {tooltip.node.type}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Right legend - hidden on mobile */}
        <div className="hidden lg:flex w-40 flex-shrink-0 border-l border-white/[0.06] p-3 flex-col gap-2 bg-[#060A12]">
          <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Legend</p>
          {LEGEND_ITEMS.map(({ type, label, color }) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="border-t border-white/[0.06] flex-shrink-0 px-4 py-3 flex items-center justify-center gap-2 flex-wrap bg-[#060A12]">
        {/* Filter toggles */}
        {(['all', 'usdc', 'usdt'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
              filter === f ? 'bg-[#0A1EFF]/20 border-[#0A1EFF]/40 text-[#6B7FFF]' : 'border-white/[0.08] text-gray-500 hover:border-white/20'
            }`}
          >
            {f !== 'all' && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f === 'usdc' ? '#4F8EF7' : '#10B981' }} />
            )}
            {f.toUpperCase()}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={() => {
            const w = dims.w;
            const h = dims.h;
            const newNodes = generateNodes(18, w, h);
            nodesRef.current = newNodes;
            setNodes([...newNodes]);
            setEdges(generateEdges(newNodes));
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border border-white/[0.08] text-gray-500 hover:border-white/20 transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Reset View
        </button>
        <button
          onClick={() => setPaused(p => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
            paused ? 'border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10' : 'border-white/[0.08] text-gray-500 hover:border-white/20'
          }`}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? 'Resume Flow' : 'Pause Flow'}
        </button>
        <button
          onClick={() => {
            const w = dims.w;
            const h = dims.h;
            const extra = generateNodes(3, w, h);
            const updated = [...nodesRef.current, ...extra];
            nodesRef.current = updated;
            setNodes([...updated]);
            setEdges(generateEdges(updated));
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold border border-white/[0.08] text-gray-500 hover:border-white/20 transition-all"
        >
          <Plus className="w-3 h-3" /> Load More
        </button>
      </div>
    </div>
  );
}
