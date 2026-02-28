'use client';

import { useState } from 'react';
import ViewProofModal from './ViewProofModal';

interface FeedEvent {
  id: string;
  sentiment: string;
  sentimentColor: string;
  title: string;
  summary: string;
  value: string;
  wallet: string;
  chain: string;
  trustScore: number;
  trustColor: string;
  trustLabel: string;
  time: string;
  views: number;
  comments: number;
  shares: number;
  likes: number;
  from: string;
  to: string;
  valueNum: number;
  valueUsd: number;
  txHash: string;
}

const EVENTS: FeedEvent[] = [
  {
    id: '1', sentiment: 'BULLISH', sentimentColor: '#10B981',
    title: '🐋 Large SOL → USDC swap detected',
    summary: 'Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.',
    value: '$4.46M', wallet: '0x742d...3a7f', chain: 'Solana', trustScore: 82, trustColor: '#10B981', trustLabel: 'TRUSTED', time: '5m ago',
    views: 12400, comments: 754, shares: 412, likes: 2600,
    from: '0x742d4Dc64C3647c5c5A20e1A2A0B3c8d91D3a7f', to: '0xJupiterProtocolAddress', valueNum: 25000, valueUsd: 4460000,
    txHash: '0x7f8c9a1b2e3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
  },
  {
    id: '2', sentiment: 'HYPE', sentimentColor: '#F59E0B',
    title: '🚀 New memecoin $FIZZ launched on Pump.fun',
    summary: 'Token raised 16,000 SOL in first hour. Top investor wallet linked to 3 previous 100x launches. Community growing rapidly.',
    value: '$2.8M', wallet: '0x9f3a...b21c', chain: 'Solana', trustScore: 45, trustColor: '#EF4444', trustLabel: 'DANGER', time: '12m ago',
    views: 8900, comments: 1240, shares: 890, likes: 4100,
    from: '0x9f3a4Bc72D1e5F6a7B8c9D0e1F2a3B4c5D6e7F8a', to: '0xPumpFunContractAddress', valueNum: 16000, valueUsd: 2800000,
    txHash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  },
  {
    id: '3', sentiment: 'BEAR', sentimentColor: '#EF4444',
    title: '⚠️ Massive ETH liquidity removal on Uniswap',
    summary: 'Developer wallet removed $1.2M liquidity from PEPE/ETH pool. Wallet previously associated with 2 rug pulls in the last 90 days.',
    value: '$1.2M', wallet: '0x3e7b...f4d8', chain: 'Ethereum', trustScore: 18, trustColor: '#EF4444', trustLabel: 'DANGER', time: '23m ago',
    views: 15600, comments: 2100, shares: 1800, likes: 890,
    from: '0x3e7b8Fc42D1a5E6b7C8d9E0f1A2b3C4d5E6f7F8a', to: '0xUniswapV3PoolAddress', valueNum: 450, valueUsd: 1200000,
    txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
  },
  {
    id: '4', sentiment: 'BULLISH', sentimentColor: '#10B981',
    title: '💎 Smart money accumulating LINK',
    summary: '14 wallets with >80% win rate bought LINK in the last 2 hours. Combined position: $8.2M. On-chain metrics bullish.',
    value: '$8.2M', wallet: '14 wallets', chain: 'Ethereum', trustScore: 91, trustColor: '#10B981', trustLabel: 'TRUSTED', time: '34m ago',
    views: 6300, comments: 420, shares: 310, likes: 1900,
    from: '0x5a6b7C8d9E0f1A2b3C4d5E6f7A8b9C0d1E2f3A4b', to: '0xChainlinkTokenAddress', valueNum: 3200, valueUsd: 8200000,
    txHash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
  },
];

export default function ContextFeed() {
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);

  return (
    <div className="space-y-3">
      {EVENTS.map((event) => (
        <div key={event.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-start justify-between mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${event.sentimentColor}20`, color: event.sentimentColor }}>
              {event.sentiment}
            </span>
            <span className="text-gray-500 text-xs">{event.time}</span>
          </div>
          <h3 className="text-sm font-bold mb-1.5">{event.title}</h3>
          <p className="text-gray-400 text-xs mb-3 leading-relaxed">{event.summary}</p>
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-gray-500">💰 {event.value}</span>
            <span className="text-gray-500">🔑 {event.wallet}</span>
            <span className="text-gray-500">⛓️ {event.chain}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-16 rounded-full h-1.5" style={{ backgroundColor: `${event.trustColor}20` }}>
                <div className="h-1.5 rounded-full" style={{ width: `${event.trustScore}%`, backgroundColor: event.trustColor }}></div>
              </div>
              <span className="text-xs font-semibold" style={{ color: event.trustColor }}>{event.trustScore}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${event.trustColor}20`, color: event.trustColor }}>{event.trustLabel}</span>
            </div>
            <button
              onClick={() => setSelectedEvent(event)}
              className="text-[#00E5FF] font-semibold text-xs hover:underline"
            >
              View Proof →
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500">
            <span>👁 {event.views.toLocaleString()}</span>
            <span>💬 {event.comments.toLocaleString()}</span>
            <span>🔗 {event.shares.toLocaleString()}</span>
            <span>❤️ {event.likes.toLocaleString()}</span>
          </div>
        </div>
      ))}

      {selectedEvent && (
        <ViewProofModal
          event={{
            id: selectedEvent.id,
            title: selectedEvent.title,
            summary: selectedEvent.summary,
            from: selectedEvent.from,
            to: selectedEvent.to,
            value: selectedEvent.valueNum,
            valueUsd: selectedEvent.valueUsd,
            chain: selectedEvent.chain,
            trustScore: selectedEvent.trustScore,
            txHash: selectedEvent.txHash,
            timestamp: new Date().toISOString(),
            sentiment: selectedEvent.sentiment,
            views: selectedEvent.views,
            comments: selectedEvent.comments,
            shares: selectedEvent.shares,
            likes: selectedEvent.likes,
          }}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
