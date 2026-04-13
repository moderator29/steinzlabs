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
  entityLabel: string | null;
  entityBadge: string | null;
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

interface RiskInfo {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  riskColor: string;
  topHoldersConcentration: number;
}

interface BubblemapsProps {
  nodes: BubbleNode[];
  width?: number;
  height?: number;
  risk?: RiskInfo;
}

interface PositionedNode extends BubbleNode {
  x: number;
  y: number;
  radius: number;
}

const RISK_BANNER_HEIGHT = 44;

export function Bubblemaps({ nodes, width = 800, height = 500, risk }: BubblemapsProps) {
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

  // Canvas drawing area excludes risk banner
  const drawH = risk ? Math.max(canvasSize.h - RISK_BANNER_HEIGHT, 100) : canvasSize.h;

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    const cx = canvasSize.w / 2;
    const cy = drawH / 2;
    const maxRadius = Math.min(canvasSize.w, drawH) * 0.35;

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
      y = Math.max(radius, Math.min(drawH - radius, y));

      positioned.push({ ...node, x, y, radius });
    }

    setPositionedNodes(positioned);
  }, [nodes, canvasSize, drawH]);

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

    // Background
    ctx.fillStyle = '#0A0E1A';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // --- Risk banner ---
    if (risk) {
      const bannerY = canvasSize.h - RISK_BANNER_HEIGHT;

      // Banner background
      ctx.fillStyle = risk.riskColor + '18';
      ctx.fillRect(0, bannerY, canvasSize.w, RISK_BANNER_HEIGHT);

      // Top border line
      ctx.strokeStyle = risk.riskColor + '55';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bannerY);
      ctx.lineTo(canvasSize.w, bannerY);
      ctx.stroke();

      // Risk badge pill
      const badgeText = `Risk: ${risk.riskLevel}`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const badgeW = ctx.measureText(badgeText).width + 16;
      const badgeX = 12;
      const badgeY = bannerY + (RISK_BANNER_HEIGHT - 22) / 2;

      ctx.fillStyle = risk.riskColor + '33';
      ctx.strokeStyle = risk.riskColor + '77';
      ctx.lineWidth = 1;
      roundRect(ctx, badgeX, badgeY, badgeW, 22, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = risk.riskColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + 8, badgeY + 11);

      // Concentration text
      const concText = `Top 5 wallets hold ${risk.topHoldersConcentration.toFixed(1)}% of supply`;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'left';
      ctx.fillText(concText, badgeX + badgeW + 10, bannerY + RISK_BANNER_HEIGHT / 2);
    }

    // --- Directional arrows between top holder and neighbors ---
    if (positionedNodes.length > 1) {
      const top = positionedNodes[0]; // largest holder (sorted by percentage desc)
      const neighbors = positionedNodes.slice(1, Math.min(4, positionedNodes.length));

      for (const neighbor of neighbors) {
        const dx = neighbor.x - top.x;
        const dy = neighbor.y - top.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const ux = dx / dist;
        const uy = dy / dist;

        // Start point (edge of top bubble)
        const sx = top.x + ux * (top.radius + 4);
        const sy = top.y + uy * (top.radius + 4);

        // End point (edge of neighbor bubble)
        const ex = neighbor.x - ux * (neighbor.radius + 4);
        const ey = neighbor.y - uy * (neighbor.radius + 4);

        // Arrow line
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = top.color + '44';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead at end
        const headLen = 8;
        const angle = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - headLen * Math.cos(angle - Math.PI / 6),
          ey - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(ex, ey);
        ctx.lineTo(
          ex - headLen * Math.cos(angle + Math.PI / 6),
          ey - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.strokeStyle = top.color + '66';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // --- Bubbles ---
    for (const node of positionedNodes) {
      const isHovered = hoveredNode?.id === node.id;

      // Hovered glow ring
      if (isHovered) {
        const outerGlow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 12);
        outerGlow.addColorStop(0, node.color + '40');
        outerGlow.addColorStop(1, node.color + '00');
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2);
        ctx.fillStyle = outerGlow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(
        node.x - node.radius * 0.25, node.y - node.radius * 0.25, 0,
        node.x, node.y, node.radius
      );
      gradient.addColorStop(0, node.color + 'DD');
      gradient.addColorStop(0.7, node.color + '99');
      gradient.addColorStop(1, node.color + '44');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Scammer dashed border
      if (node.isScammer) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (isHovered) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = node.color + '66';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label text
      if (node.radius > 20) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(9, node.radius / 3)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = node.entityName || node.label;
        const shortLabel = label.length > 10 ? label.slice(0, 10) + '..' : label;

        // Show label + pct stacked
        ctx.fillText(shortLabel, node.x, node.y - 5);

        ctx.fillStyle = '#FFFFFFAA';
        ctx.font = `${Math.max(8, node.radius / 4)}px Inter, sans-serif`;
        ctx.fillText(`${node.percentage.toFixed(1)}%`, node.x, node.y + 8);
      } else if (node.radius > 12) {
        // Small bubble: just percentage
        ctx.fillStyle = '#FFFFFFAA';
        ctx.font = `${Math.max(7, node.radius / 3.5)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${node.percentage.toFixed(1)}%`, node.x, node.y);
      }

      // Entity badge overlay (top-right of bubble)
      if (node.entityBadge && node.radius > 14) {
        const badgeSize = Math.max(10, Math.min(16, node.radius * 0.55));
        const bx = node.x + node.radius * 0.6;
        const by = node.y - node.radius * 0.6;

        ctx.beginPath();
        ctx.arc(bx, by, badgeSize / 2 + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#0A0E1A';
        ctx.fill();

        ctx.font = `${badgeSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.entityBadge, bx, by);
      }

      // Hovered floating label above bubble
      if (isHovered) {
        const floatY = node.y - node.radius - 14;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(node.entityName || node.label, node.x, floatY);
      }
    }
  }, [positionedNodes, hoveredNode, canvasSize, drawH, risk]);

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
            top: Math.max(0, hoveredNode.y - 130),
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: hoveredNode.color }}
            />
            <span className="text-sm font-medium text-white">
              {hoveredNode.entityName || hoveredNode.label}
            </span>
            {hoveredNode.verified && (
              <span className="text-green-500 text-xs">Verified</span>
            )}
            {hoveredNode.entityBadge && (
              <span className="text-base leading-none">{hoveredNode.entityBadge}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Holdings:</span>
              <span className="text-white ml-1 font-mono">{hoveredNode.percentage.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Value:</span>
              <span className="text-white ml-1">${hoveredNode.valueUSD}</span>
            </div>
            {hoveredNode.entityLabel && (
              <div>
                <span className="text-gray-500">Entity:</span>
                <span className="text-white ml-1">{hoveredNode.entityLabel}</span>
              </div>
            )}
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

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
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
        <div className="flex items-center gap-1 ml-auto text-[10px]">
          <span>Badges:</span>
          <span>CEX</span>
          <span>Protocol</span>
          <span>[!] Team</span>
          <span>[!] Risk</span>
        </div>
      </div>
    </div>
  );
}

// Helper: draw rounded rectangle path
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
