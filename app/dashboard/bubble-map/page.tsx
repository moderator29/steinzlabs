'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, Send, Bot, Copy, Check, User, Sparkles,
  TrendingUp, TrendingDown, BarChart3, Shield, Layers, Info,
  ChevronDown, Maximize2, Minimize2, X
} from 'lucide-react';
import SteinzLogoSpinner from '@/components/SteinzLogoSpinner';

interface BubbleNode {
  id: string;
  label: string;
  value: number;
  percentage: number;
  type: 'token' | 'exchange' | 'whale' | 'contract' | 'unknown' | 'scammer' | 'dex' | 'team';
  entity?: string;
  verified?: boolean;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface BubbleLink {
  source: string | BubbleNode;
  target: string | BubbleNode;
  value: number;
}

interface TokenInfo {
  name: string;
  symbol: string;
  chain: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  totalHolders: number;
  topHolderConcentration: number;
}

interface BubbleMapData {
  nodes: BubbleNode[];
  links: BubbleLink[];
  tokenInfo: TokenInfo;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const TYPE_LABELS: Record<string, string> = {
  token: 'Token',
  exchange: 'Exchange',
  whale: 'Whale',
  contract: 'Contract',
  unknown: 'Unknown',
  scammer: 'Scammer',
  dex: 'DEX',
  team: 'Team',
};

const CHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'solana', label: 'Solana' },
  { value: 'bsc', label: 'BNB Chain' },
  { value: 'base', label: 'Base' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'avalanche', label: 'Avalanche' },
];

function formatNum(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (p < 0.0001) return `$${p.toFixed(8)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BubbleMapPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<BubbleNode[]>([]);
  const linksRef = useRef<BubbleLink[]>([]);

  const [tokenAddress, setTokenAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<BubbleMapData | null>(null);
  const [selectedNode, setSelectedNode] = useState<BubbleNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<BubbleNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Bubble Map agent online. Enter a token address above to visualize holder distribution, then ask me anything about the data.', timestamp: Date.now() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchBubbleMap = async () => {
    if (!tokenAddress.trim()) return;
    setLoading(true);
    setSelectedNode(null);
    setHoveredNode(null);
    try {
      const res = await fetch(`/api/bubble-map?token=${encodeURIComponent(tokenAddress.trim())}&chain=${chain}`);
      const data = await res.json();
      if (data.error) {
        setMapData(null);
      } else {
        setMapData(data);
      }
    } catch {
      setMapData(null);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = useCallback(() => {
    if (!mapData || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const cx = W / 2;
    const cy = H / 2;

    const nodes: BubbleNode[] = mapData.nodes.map((n, i) => {
      const angle = (i / mapData.nodes.length) * Math.PI * 2;
      const dist = i === 0 ? 0 : 80 + Math.random() * 120;
      return {
        ...n,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        fx: i === 0 ? cx : null,
        fy: i === 0 ? cy : null,
      };
    });

    const links: BubbleLink[] = mapData.links.map(l => ({
      ...l,
      source: nodes.find(n => n.id === (typeof l.source === 'string' ? l.source : l.source.id)) || nodes[0],
      target: nodes.find(n => n.id === (typeof l.target === 'string' ? l.target : l.target.id)) || nodes[0],
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const getRadius = (n: BubbleNode) => {
      if (n.id === 'center') return Math.min(W, H) * 0.06;
      const minR = 8;
      const maxR = Math.min(W, H) * 0.04;
      return Math.max(minR, Math.min(maxR, Math.sqrt(n.percentage) * 6));
    };

    let tickCount = 0;
    const maxTicks = 300;
    const alpha = { value: 1 };

    const simulate = () => {
      if (tickCount >= maxTicks) {
        alpha.value = 0;
      } else {
        alpha.value = Math.max(0, 1 - tickCount / maxTicks);
      }

      for (const node of nodes) {
        if (node.fx !== null && node.fx !== undefined) { node.x = node.fx; }
        if (node.fy !== null && node.fy !== undefined) { node.y = node.fy; }
      }

      for (const link of links) {
        const s = link.source as BubbleNode;
        const t = link.target as BubbleNode;
        if (!s.x || !t.x || !s.y || !t.y) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 100 + getRadius(s) + getRadius(t);
        const force = (dist - targetDist) * 0.003 * alpha.value;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (t.fx === null || t.fx === undefined) { t.vx = (t.vx || 0) - fx; t.vy = (t.vy || 0) - fy; }
        if (s.fx === null || s.fx === undefined) { s.vx = (s.vx || 0) + fx; s.vy = (s.vy || 0) + fy; }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (!a.x || !b.x || !a.y || !b.y) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = getRadius(a) + getRadius(b) + 15;
          if (dist < minDist) {
            const force = (minDist - dist) * 0.05 * alpha.value;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.fx === null || a.fx === undefined) { a.vx = (a.vx || 0) - fx; a.vy = (a.vy || 0) - fy; }
            if (b.fx === null || b.fx === undefined) { b.vx = (b.vx || 0) + fx; b.vy = (b.vy || 0) + fy; }
          }
        }
      }

      for (const node of nodes) {
        if (node.fx !== null && node.fx !== undefined) continue;
        const dx = cx - (node.x || cx);
        const dy = cy - (node.y || cy);
        node.vx = (node.vx || 0) + dx * 0.001 * alpha.value;
        node.vy = (node.vy || 0) + dy * 0.001 * alpha.value;
      }

      for (const node of nodes) {
        if (node.fx !== null && node.fx !== undefined) continue;
        node.vx = (node.vx || 0) * 0.85;
        node.vy = (node.vy || 0) * 0.85;
        node.x = (node.x || cx) + (node.vx || 0);
        node.y = (node.y || cy) + (node.vy || 0);
        const r = getRadius(node);
        node.x = Math.max(r, Math.min(W - r, node.x));
        node.y = Math.max(r, Math.min(H - r, node.y));
      }

      tickCount++;
    };

    const draw = () => {
      simulate();
      ctx.clearRect(0, 0, W, H);

      for (const link of links) {
        const s = link.source as BubbleNode;
        const t = link.target as BubbleNode;
        if (!s.x || !t.x || !s.y || !t.y) continue;
        const isHighlighted = hoveredNode && (hoveredNode.id === s.id || hoveredNode.id === t.id);

        const lineGrad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        if (isHighlighted) {
          lineGrad.addColorStop(0, (s.color || '#0A1EFF') + '80');
          lineGrad.addColorStop(1, (t.color || '#0A1EFF') + '80');
        } else {
          lineGrad.addColorStop(0, (s.color || '#FFFFFF') + '18');
          lineGrad.addColorStop(1, (t.color || '#FFFFFF') + '10');
        }

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
      }

      for (const node of nodes) {
        if (!node.x || !node.y) continue;
        const r = getRadius(node);
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        if (node.id === 'center') {
          const glowGrad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r * 2.5);
          glowGrad.addColorStop(0, '#0A1EFF30');
          glowGrad.addColorStop(1, '#0A1EFF00');
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        if (isHovered || isSelected) {
          const outerGlow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 12);
          outerGlow.addColorStop(0, node.color + '40');
          outerGlow.addColorStop(1, node.color + '00');
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 12, 0, Math.PI * 2);
          ctx.fillStyle = outerGlow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 2, 0, Math.PI * 2);
          ctx.strokeStyle = node.color + 'AA';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(node.x - r * 0.25, node.y - r * 0.25, 0, node.x, node.y, r);
        grad.addColorStop(0, node.color + 'DD');
        grad.addColorStop(0.7, node.color + '99');
        grad.addColorStop(1, node.color + '55');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = node.color + '88';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (node.type === 'scammer') {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (r > 12 || isHovered) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.max(8, Math.min(11, r * 0.65))}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (node.id === 'center') {
            ctx.fillText(node.label, node.x, node.y);
          } else {
            const shortLabel = (node.entity || node.label);
            const displayLabel = shortLabel.length > 12 ? shortLabel.slice(0, 12) + '..' : shortLabel;
            ctx.fillText(displayLabel, node.x, node.y - (r > 18 ? 5 : 0));
            if (r > 18) {
              ctx.fillStyle = '#FFFFFFAA';
              ctx.font = `${Math.max(7, r * 0.45)}px Inter, system-ui, sans-serif`;
              ctx.fillText(`${node.percentage.toFixed(1)}%`, node.x, node.y + 7);
            }
          }
        }

        if (isHovered && node.id !== 'center') {
          const labelY = node.y - r - 14;
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, labelY);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    draw();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mapData, hoveredNode, selectedNode]);

  useEffect(() => {
    const cleanup = runSimulation();
    return () => { cleanup?.(); };
  }, [runSimulation]);

  useEffect(() => {
    const handleResize = () => { runSimulation(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [runSimulation]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !nodesRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: BubbleNode | null = null;
    for (const node of nodesRef.current) {
      if (!node.x || !node.y) continue;
      const dx = mx - node.x;
      const dy = my - node.y;
      const r = node.id === 'center' ? 30 : Math.max(8, Math.sqrt(node.percentage) * 6);
      if (dx * dx + dy * dy <= (r + 5) * (r + 5)) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode.id === selectedNode?.id ? null : hoveredNode);
    } else {
      setSelectedNode(null);
    }
  };

  const sendChatMessage = async (text?: string) => {
    const msg = text || chatInput;
    if (!msg.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg.trim(), timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const contextInfo = mapData
        ? `\n\n[BUBBLE MAP CONTEXT]\nToken: ${mapData.tokenInfo.name} (${mapData.tokenInfo.symbol})\nChain: ${mapData.tokenInfo.chain}\nPrice: $${mapData.tokenInfo.price}\n24h Change: ${mapData.tokenInfo.priceChange24h}%\nVolume: $${mapData.tokenInfo.volume24h}\nMarket Cap: $${mapData.tokenInfo.marketCap}\nLiquidity: $${mapData.tokenInfo.liquidity}\nTop Holder Concentration: ${mapData.tokenInfo.topHolderConcentration}%\nHolders shown: ${mapData.nodes.length - 1}\nHolder breakdown:\n${mapData.nodes.filter(n => n.id !== 'center').map(n => `${n.label}: ${n.percentage}% (${n.type})`).join('\n')}`
        : '';

      const res = await fetch('/api/vtx-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg.trim() + contextInfo,
          history: chatMessages.slice(-8),
          tier: 'pro',
          responseStyle: 'concise',
          autoContext: false,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Could not generate response.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please try again.', timestamp: Date.now() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const copyMsg = (idx: number) => {
    const msg = chatMessages[idx];
    if (msg) { navigator.clipboard.writeText(msg.content); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const info = mapData?.tokenInfo;

  return (
    <div className="min-h-screen bg-[#060A12] text-white flex flex-col">
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-9 h-9 bg-gradient-to-br from-[#0A1EFF] to-[#4F46E5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0A1EFF]/20">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Bubble Map</span>
              <span className="px-1.5 py-0.5 bg-[#0A1EFF]/15 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-bold">INTEL</span>
            </div>
            <span className="text-[10px] text-gray-600">Token holder distribution visualization</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex gap-2">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowChainDropdown(!showChainDropdown)}
              className="h-11 px-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs font-medium text-gray-300 flex items-center gap-1.5 hover:border-white/[0.15] transition-colors"
            >
              {CHAIN_OPTIONS.find(c => c.value === chain)?.label}
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showChainDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowChainDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 w-40 bg-[#0f1320] border border-white/[0.08] rounded-xl overflow-hidden z-40 shadow-xl">
                  {CHAIN_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => { setChain(c.value); setShowChainDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 text-xs hover:bg-white/[0.06] transition-colors ${chain === c.value ? 'text-[#0A1EFF] bg-[#0A1EFF]/[0.05]' : 'text-gray-400'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 focus-within:border-[#0A1EFF]/30 transition-colors">
            <Search className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <input
              type="text"
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchBubbleMap()}
              placeholder="Enter token contract address..."
              className="flex-1 bg-transparent py-3 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono"
            />
          </div>
          <button
            onClick={fetchBubbleMap}
            disabled={loading || !tokenAddress.trim()}
            className="h-11 px-5 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl text-xs font-bold transition-colors disabled:opacity-30 flex-shrink-0"
          >
            {loading ? 'Loading...' : 'Analyze'}
          </button>
        </div>
      </div>

      {info && (
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <span className="text-sm font-bold">{info.symbol}</span>
              <span className="text-xs text-gray-500 ml-1.5">{info.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-bold">{formatPrice(info.price)}</span>
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${info.priceChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {info.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(info.priceChange24h).toFixed(2)}%
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[10px] text-gray-500">
              <span>Vol: <span className="text-gray-300 font-mono">{formatNum(info.volume24h)}</span></span>
              <span>MCap: <span className="text-gray-300 font-mono">{formatNum(info.marketCap)}</span></span>
              <span>Liq: <span className="text-gray-300 font-mono">{formatNum(info.liquidity)}</span></span>
              <span>Holders: <span className="text-gray-300 font-mono">{info.totalHolders}</span></span>
              <span>Top Conc: <span className={`font-mono ${info.topHolderConcentration > 50 ? 'text-[#EF4444]' : info.topHolderConcentration > 30 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{info.topHolderConcentration.toFixed(1)}%</span></span>
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-col lg:flex-row flex-1 min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#060A12]' : ''}`}>
        <div className={`relative ${isFullscreen ? 'flex-1' : 'h-[400px] sm:h-[500px] lg:h-auto lg:flex-1'} border-b lg:border-b-0 lg:border-r border-white/[0.04]`}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SteinzLogoSpinner size={56} message="Loading holder data..." />
            </div>
          ) : !mapData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
              <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                <Layers className="w-10 h-10 text-gray-700" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-400 mb-1">No token loaded</p>
                <p className="text-xs text-gray-600 max-w-xs">Enter a token contract address above to visualize the holder distribution network</p>
              </div>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                onMouseMove={handleCanvasMouseMove}
                onClick={handleCanvasClick}
                onMouseLeave={() => setHoveredNode(null)}
              />

              <div className="absolute top-3 right-3 flex gap-1.5">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-[#0f1320]/80 border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors backdrop-blur-sm"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
                </button>
              </div>

              <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'token').map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-[#0f1320]/80 border border-white/[0.06] rounded-md backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ({ exchange: '#10B981', whale: '#F59E0B', contract: '#8B5CF6', dex: '#06B6D4', team: '#EC4899', scammer: '#EF4444', unknown: '#6B7280' } as any)[key] }} />
                    <span className="text-[9px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>

              {selectedNode && selectedNode.id !== 'center' && (
                <div className="absolute top-3 left-3 w-56 bg-[#0f1320]/95 border border-white/[0.08] rounded-xl p-3 backdrop-blur-xl shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white truncate flex-1 mr-2">{selectedNode.label}</span>
                    <button onClick={() => setSelectedNode(null)} className="p-0.5 hover:bg-white/[0.06] rounded">
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium" style={{ color: selectedNode.color }}>{TYPE_LABELS[selectedNode.type]}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Holdings</span>
                      <span className="text-gray-200 font-mono">{selectedNode.percentage.toFixed(2)}%</span>
                    </div>
                    {selectedNode.verified && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Verified</span>
                        <span className="text-[#10B981]">Yes</span>
                      </div>
                    )}
                    {selectedNode.type === 'scammer' && (
                      <div className="mt-2 p-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg">
                        <p className="text-[10px] text-[#EF4444] font-semibold">Flagged as scammer</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={containerRef} className="absolute inset-0 pointer-events-none" />
        </div>

        <div className={`flex flex-col ${isFullscreen ? 'hidden' : 'h-[400px] lg:h-auto lg:w-[380px] xl:w-[420px]'}`}>
          {mapData && mapData.nodes.length > 1 && (
            <div className="border-b border-white/[0.04] max-h-[200px] overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider bg-[#060A12]/50 sticky top-0">
                <div className="grid grid-cols-[24px_1fr_60px_60px] gap-2">
                  <span>#</span>
                  <span>Holder</span>
                  <span className="text-right">%</span>
                  <span className="text-right">Type</span>
                </div>
              </div>
              {mapData.nodes.filter(n => n.id !== 'center').sort((a, b) => b.percentage - a.percentage).map((node, idx) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node.id === selectedNode?.id ? null : node)}
                  className={`px-3 py-1.5 text-[10px] cursor-pointer transition-colors hover:bg-white/[0.03] ${selectedNode?.id === node.id ? 'bg-[#0A1EFF]/[0.06]' : ''}`}
                >
                  <div className="grid grid-cols-[24px_1fr_60px_60px] gap-2 items-center">
                    <span className="text-gray-600 font-mono">{idx + 1}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.color }} />
                      <span className="text-gray-300 truncate">{node.entity || node.label}</span>
                      {node.verified && <span className="text-[#10B981] text-[8px] flex-shrink-0">V</span>}
                    </div>
                    <span className="text-right text-white font-mono">{node.percentage.toFixed(2)}%</span>
                    <span className="text-right font-medium" style={{ color: node.color }}>
                      {TYPE_LABELS[node.type] || node.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-gradient-to-br from-[#0A1EFF] to-[#4F46E5] rounded-lg flex items-center justify-center shadow-sm shadow-[#0A1EFF]/10">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold">Bubble Map Agent</span>
                <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
              </div>
              <span className="text-[9px] text-gray-600">Ask about holder distribution</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-gradient-to-br from-[#0A1EFF] to-[#4F46E5] rounded-md flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                    <Bot className="w-3 h-3" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-[11px] leading-relaxed relative ${
                  msg.role === 'user'
                    ? 'bg-[#0A1EFF]/10 border border-[#0A1EFF]/15 text-white'
                    : 'bg-white/[0.02] border border-white/[0.06] text-gray-300'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Sparkles className="w-2.5 h-2.5 text-[#0A1EFF]" />
                      <span className="text-[9px] font-semibold text-[#0A1EFF]">Agent</span>
                      <span className="text-[8px] text-gray-700 ml-auto">{formatTime(msg.timestamp)}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === 'user' && (
                    <div className="text-[8px] text-gray-600 mt-1 text-right">{formatTime(msg.timestamp)}</div>
                  )}
                  {msg.role === 'assistant' && i > 0 && (
                    <button onClick={() => copyMsg(i)} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/[0.06] rounded">
                      {copiedIdx === i ? <Check className="w-2.5 h-2.5 text-[#10B981]" /> : <Copy className="w-2.5 h-2.5 text-gray-600" />}
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 bg-[#111827] rounded-md flex items-center justify-center flex-shrink-0 mt-1 ml-2 border border-white/[0.06]">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-gradient-to-br from-[#0A1EFF] to-[#4F46E5] rounded-md flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-3">
                  <SteinzLogoSpinner size={28} message="Analyzing..." />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {mapData && (
            <div className="px-3 pb-1.5 flex gap-1.5 flex-wrap">
              {[
                { label: 'Risk Assessment', q: `What is the risk level for ${mapData.tokenInfo.symbol} based on the holder distribution?` },
                { label: 'Whale Activity', q: `Analyze whale concentration for ${mapData.tokenInfo.symbol}. Are there any dangerous holder patterns?` },
                { label: 'Summary', q: `Give me a quick summary of the ${mapData.tokenInfo.symbol} holder distribution and any red flags.` },
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => sendChatMessage(chip.q)}
                  className="px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-[10px] text-gray-500 hover:text-white hover:border-[#0A1EFF]/30 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-white/[0.04] flex-shrink-0">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 focus-within:border-[#0A1EFF]/30 transition-colors">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about this token..."
                  className="flex-1 bg-transparent py-2.5 text-[11px] placeholder-gray-600 focus:outline-none"
                  disabled={chatLoading}
                />
              </div>
              <button
                onClick={() => sendChatMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#0A1EFF] hover:bg-[#0918D0] p-2.5 rounded-xl transition-colors disabled:opacity-30 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
