'use client';

// Phase 8 — interactive force-directed wallet graph.
// Uses react-force-graph-2d (client-only dynamic import to avoid SSR issues).
// Node size scales with degree; node color by role; edge color by detection type.

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

// Dynamic import: the lib touches `window` at module load.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface Edge {
  from_address: string;
  to_address: string;
  edge_type: string;
  confidence: number;
  total_value_usd: number | null;
  transaction_count: number | null;
}
interface Member {
  address: string;
  role: string | null;
}

const EDGE_COLOR: Record<string, string> = {
  direct_transfer: '#8FA3FF',
  common_funding: '#10B981',
  coordinated_trading: '#F59E0B',
  behavioral_fingerprint: '#7C3AED',
  sybil_pattern: '#EF4444',
};

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

export default function ClusterGraph({
  members, edges, hub, onNodeClick,
}: {
  members: Member[];
  edges: Edge[];
  hub: string | null;
  onNodeClick?: (address: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: Math.max(380, Math.min(560, el.clientWidth * 0.6)) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(() => {
    // Compute degree for sizing.
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.from_address, (degree.get(e.from_address) || 0) + 1);
      degree.set(e.to_address, (degree.get(e.to_address) || 0) + 1);
    }

    const nodes = members.map((m) => ({
      id: m.address,
      label: short(m.address),
      role: m.role || 'leaf',
      degree: degree.get(m.address) || 0,
      isHub: m.address === hub,
    }));

    const links = edges.map((e) => ({
      source: e.from_address,
      target: e.to_address,
      edgeType: e.edge_type,
      color: EDGE_COLOR[e.edge_type] || '#64748b',
      width: Math.max(0.5, Math.min(4, (e.confidence || 0.5) * 3)),
    }));

    return { nodes, links };
  }, [members, edges, hub]);

  return (
    <div ref={containerRef} className="w-full bg-[#05081E] border border-white/10 rounded-xl overflow-hidden">
      <ForceGraph2D
        graphData={graphData}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        linkColor={(l: any) => l.color}
        linkWidth={(l: any) => l.width}
        linkDirectionalParticles={0}
        nodeRelSize={4}
        nodeVal={(n: any) => 1 + Math.min(6, n.degree)}
        nodeLabel={(n: any) => `${n.label} — degree ${n.degree}${n.isHub ? ' (HUB)' : ''}`}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const r = 3 + Math.min(8, node.degree) * 0.9;
          // Fill
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.isHub ? '#F59E0B' : node.role === 'hub' ? '#8FA3FF' : '#10B981';
          ctx.fill();
          // Ring for hub
          if (node.isHub) {
            ctx.lineWidth = 2 / globalScale;
            ctx.strokeStyle = '#FDE68A';
            ctx.stroke();
          }
          // Label when zoomed in enough.
          if (globalScale > 1.4) {
            ctx.font = `${10 / globalScale}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(node.label, node.x, node.y + r + 8 / globalScale);
          }
        }}
        onNodeClick={(n: any) => onNodeClick?.(String(n.id))}
        cooldownTicks={120}
        enableNodeDrag={true}
      />
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 border-t border-white/5 text-[10px]">
        {Object.entries(EDGE_COLOR).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-slate-400">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: c }} />
            {k.replace('_', ' ')}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} /> Hub
          <span className="inline-block w-2 h-2 rounded-full ml-2" style={{ background: '#10B981' }} /> Member
        </span>
      </div>
    </div>
  );
}
