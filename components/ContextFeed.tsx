'use client';

export default function ContextFeed() {
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/20 transition-all">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full text-xs font-semibold">
            BULLISH
          </span>
          <span className="text-gray-500 text-xs">5m ago</span>
        </div>
        <h3 className="text-sm font-bold mb-1.5">
          🐋 Large SOL → USDC swap detected
        </h3>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.
        </p>
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">💰 $4.46M</span>
          <span className="text-gray-500">🔑 0x742d...3a7f</span>
          <span className="text-gray-500">⛓️ Solana</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[#10B981]/20 rounded-full h-1.5">
              <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: '82%' }}></div>
            </div>
            <span className="text-xs font-semibold text-[#10B981]">82</span>
            <span className="px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px] font-semibold">TRUSTED</span>
          </div>
          <button className="text-[#00E5FF] font-semibold text-xs hover:underline">
            View Proof →
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500">
          <span>👁 12,400</span>
          <span>💬 754</span>
          <span>🔗 412</span>
          <span>❤️ 2,600</span>
        </div>
      </div>

      <div className="glass rounded-xl p-4 border border-white/10 hover:border-[#F59E0B]/20 transition-all">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2.5 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full text-xs font-semibold">
            HYPE
          </span>
          <span className="text-gray-500 text-xs">12m ago</span>
        </div>
        <h3 className="text-sm font-bold mb-1.5">
          🚀 New memecoin $FIZZ launched on Pump.fun
        </h3>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          Token raised 16,000 SOL in first hour. Top investor wallet linked to 3 previous 100x launches. Community growing rapidly.
        </p>
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">💰 $2.8M</span>
          <span className="text-gray-500">🔑 0x9f3a...b21c</span>
          <span className="text-gray-500">⛓️ Solana</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[#EF4444]/20 rounded-full h-1.5">
              <div className="bg-[#EF4444] h-1.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
            <span className="text-xs font-semibold text-[#EF4444]">45</span>
            <span className="px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded text-[10px] font-semibold">DANGER</span>
          </div>
          <button className="text-[#00E5FF] font-semibold text-xs hover:underline">
            View Proof →
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500">
          <span>👁 8,900</span>
          <span>💬 1,240</span>
          <span>🔗 890</span>
          <span>❤️ 4,100</span>
        </div>
      </div>

      <div className="glass rounded-xl p-4 border border-white/10 hover:border-[#EF4444]/20 transition-all">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded-full text-xs font-semibold">
            BEAR
          </span>
          <span className="text-gray-500 text-xs">23m ago</span>
        </div>
        <h3 className="text-sm font-bold mb-1.5">
          ⚠️ Massive ETH liquidity removal on Uniswap
        </h3>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          Developer wallet removed $1.2M liquidity from PEPE/ETH pool. Wallet previously associated with 2 rug pulls in the last 90 days.
        </p>
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">💰 $1.2M</span>
          <span className="text-gray-500">🔑 0x3e7b...f4d8</span>
          <span className="text-gray-500">⛓️ Ethereum</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[#EF4444]/20 rounded-full h-1.5">
              <div className="bg-[#EF4444] h-1.5 rounded-full" style={{ width: '18%' }}></div>
            </div>
            <span className="text-xs font-semibold text-[#EF4444]">18</span>
            <span className="px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded text-[10px] font-semibold">DANGER</span>
          </div>
          <button className="text-[#00E5FF] font-semibold text-xs hover:underline">
            View Proof →
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500">
          <span>👁 15,600</span>
          <span>💬 2,100</span>
          <span>🔗 1,800</span>
          <span>❤️ 890</span>
        </div>
      </div>

      <div className="glass rounded-xl p-4 border border-white/10 hover:border-[#10B981]/20 transition-all">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded-full text-xs font-semibold">
            BULLISH
          </span>
          <span className="text-gray-500 text-xs">34m ago</span>
        </div>
        <h3 className="text-sm font-bold mb-1.5">
          💎 Smart money accumulating LINK
        </h3>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          14 wallets with &gt;80% win rate bought LINK in the last 2 hours. Combined position: $8.2M. On-chain metrics bullish.
        </p>
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-gray-500">💰 $8.2M</span>
          <span className="text-gray-500">👥 14 wallets</span>
          <span className="text-gray-500">⛓️ Ethereum</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[#10B981]/20 rounded-full h-1.5">
              <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: '91%' }}></div>
            </div>
            <span className="text-xs font-semibold text-[#10B981]">91</span>
            <span className="px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px] font-semibold">TRUSTED</span>
          </div>
          <button className="text-[#00E5FF] font-semibold text-xs hover:underline">
            View Proof →
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500">
          <span>👁 6,300</span>
          <span>💬 420</span>
          <span>🔗 310</span>
          <span>❤️ 1,900</span>
        </div>
      </div>
    </div>
  );
}
