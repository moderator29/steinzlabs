'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface BubbleNode {
  id: string;
  label: string;
  value: number;
  percentage: number;
  valueUSD: string;
  entityName: string | null;
  entityType: string | null;
  verified: boolean;
  color: string;
  size: number;
  behavior: string;
  isScammer: boolean;
  riskScore: number;
  winRate?: number;
  avgHoldTime?: number;
  currentPnL?: string;
}

interface BubblemapsProps {
  nodes: BubbleNode[];
  width?: number;
  height?: number;
}

interface PositionedNode extends BubbleNode {
  x: number;
  y: number;
  radius: number;
}

export function Bubblemaps({ nodes, width = 800, height = 500 }: BubblemapsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  const [positionedNodes, setPositionedNodes] = useState<PositionedNode[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: width, h: height });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setCanvasSize({ w, h: Math.min(w * 0.6, height) });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [height]);

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    const maxRadius = Math.min(canvasSize.w, canvasSize.h) * 0.35;

    const positioned: PositionedNode[] = [];
    const sortedNodes = [...nodes].sort((a, b) => b.percentage - a.percentage);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const radius = Math.max(node.size * 0.8, 8);
      const angle = (i / sortedNodes.length) * Math.PI * 2 + Math.random() * 0.3;
      const dist = (i / sortedNodes.length) * maxRadius + radius;

      let x = cx + Math.cos(angle) * dist;
      let y = cy + Math.sin(angle) * dist;

      x = Math.max(radius, Math.min(canvasSize.w - radius, x));
      y = Math.max(radius, Math.min(canvasSize.h - radius, y));

      positioned.push({ ...node, x, y, radius });
    }

    setPositionedNodes(positioned);
  }, [nodes, canvasSize]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    ctx.fillStyle = '#0A0E1A';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    for (const node of positionedNodes) {
      const isHovered = hoveredNode?.id === node.id;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, node.radius
      );
      gradient.addColorStop(0, node.color + 'CC');
      gradient.addColorStop(1, node.color + '44');
      ctx.fillStyle = gradient;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = node.color + '66';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (node.radius > 20) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${Math.max(9, node.radius / 3)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = node.entityName || node.label;
        const shortLabel = label.length > 10 ? label.slice(0, 10) + '..' : label;
        ctx.fillText(shortLabel, node.x, node.y - 4);

        ctx.fillStyle = '#9CA3AF';
        ctx.font = `${Math.max(8, node.radius / 4)}px Inter, sans-serif`;
        ctx.fillText(`${node.percentage.toFixed(1)}%`, node.x, node.y + 8);
      }
    }
  }, [positionedNodes, hoveredNode, canvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: PositionedNode | null = null;
    for (const node of positionedNodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  }, [positionedNodes]);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="bg-[#0A0E1A] rounded-lg p-8 text-center">
        <p className="text-gray-500">No holder data available for visualization</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: canvasSize.h }}
        className="rounded-lg cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
      />

      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-[#141824] border border-[#1E2433] rounded-lg p-3 shadow-xl z-10"
          style={{
            left: Math.min(hoveredNode.x, canvasSize.w - 220),
            top: Math.max(0, hoveredNode.y - 120),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: hoveredNode.color }}
            />
            <span className="text-sm font-medium text-white">
              {hoveredNode.entityName || hoveredNode.label}
            </span>
            {hoveredNode.verified && (
              <span className="text-green-500 text-xs">Verified</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Holdings:</span>
              <span className="text-white ml-1">{hoveredNode.percentage.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Value:</span>
              <span className="text-white ml-1">${hoveredNode.valueUSD}</span>
            </div>
            {hoveredNode.entityType && (
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="text-white ml-1">{hoveredNode.entityType}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Risk:</span>
              <span className={`ml-1 ${hoveredNode.riskScore > 5 ? 'text-red-500' : 'text-green-500'}`}>
                {hoveredNode.riskScore}/10
              </span>
            </div>
            {hoveredNode.winRate !== undefined && (
              <div>
                <span className="text-gray-500">Win Rate:</span>
                <span className="text-green-500 ml-1">{hoveredNode.winRate}%</span>
              </div>
            )}
            {hoveredNode.isScammer && (
              <div className="col-span-2 text-red-500 font-medium">
                SCAMMER DETECTED
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00FF88]" />
          <span>Verified</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#4488FF]" />
          <span>Exchange</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
          <span>Retail</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF4444]" />
          <span>Scammer</span>
        </div>
      </div>
    </div>
  );
}
