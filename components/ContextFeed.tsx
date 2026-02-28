'use client';

export default function ContextFeed() {
  return (
    <div className="space-y-4">
      <div className="glow-card glass rounded-2xl p-6 border border-white/10 hover:border-[#00E5FF]/30 transition-all">
        <div className="flex items-start justify-between mb-3">
          <span className="px-3 py-1 bg-[#10B981]/20 text-[#10B981] rounded-full text-sm font-semibold">
            BULLISH
          </span>
          <span className="text-gray-400 text-sm">5m ago</span>
        </div>
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          Large SOL &rarr; USDC swap detected
        </h3>
        <p className="text-gray-300 mb-4 leading-relaxed">
          Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.
        </p>
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">$4.46M</span>
          <span className="text-gray-400">0x742d...3a7f</span>
          <span className="text-gray-400">Solana</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-full bg-[#10B981]/20 rounded-full h-2 max-w-[100px]">
              <div className="bg-[#10B981] h-2 rounded-full" style={{ width: '82%' }}></div>
            </div>
            <span className="text-sm font-semibold text-[#10B981]">82</span>
            <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded text-xs font-semibold">TRUSTED</span>
          </div>
          <button className="text-[#00E5FF] font-semibold hover:underline text-sm">
            View Proof &rarr;
          </button>
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
          <span>12,400 views</span>
          <span>754 comments</span>
          <span>412 shares</span>
          <span>2,600 likes</span>
        </div>
      </div>

      <div className="glow-card glass rounded-2xl p-6 border border-white/10 hover:border-[#F59E0B]/30 transition-all">
        <div className="flex items-start justify-between mb-3">
          <span className="px-3 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full text-sm font-semibold">
            HYPE
          </span>
          <span className="text-gray-400 text-sm">12m ago</span>
        </div>
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          New memecoin $FIZZ launched on Pump.fun
        </h3>
        <p className="text-gray-300 mb-4 leading-relaxed">
          Token raised 16,000 SOL in first hour. Top investor wallet linked to 3 previous 100x launches. Community growing rapidly.
        </p>
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">$2.8M</span>
          <span className="text-gray-400">0x9f3a...b21c</span>
          <span className="text-gray-400">Solana</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-full bg-[#F59E0B]/20 rounded-full h-2 max-w-[100px]">
              <div className="bg-[#F59E0B] h-2 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <span className="text-sm font-semibold text-[#F59E0B]">65</span>
            <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-semibold">MEDIUM</span>
          </div>
          <button className="text-[#00E5FF] font-semibold hover:underline text-sm">
            View Proof &rarr;
          </button>
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
          <span>8,900 views</span>
          <span>523 comments</span>
          <span>201 shares</span>
          <span>1,800 likes</span>
        </div>
      </div>

      <div className="glow-card glass rounded-2xl p-6 border border-white/10 hover:border-[#EF4444]/30 transition-all">
        <div className="flex items-start justify-between mb-3">
          <span className="px-3 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded-full text-sm font-semibold">
            DANGER
          </span>
          <span className="text-gray-400 text-sm">18m ago</span>
        </div>
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          Rug pull detected on $SCAMTOKEN
        </h3>
        <p className="text-gray-300 mb-4 leading-relaxed">
          Deployer wallet drained 100% of liquidity ($890K) within 4 hours of launch. Contract has hidden mint function. Linked to 2 previous rugs.
        </p>
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">$890K drained</span>
          <span className="text-gray-400">0x1b2c...d4e5</span>
          <span className="text-gray-400">BSC</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-full bg-[#EF4444]/20 rounded-full h-2 max-w-[100px]">
              <div className="bg-[#EF4444] h-2 rounded-full" style={{ width: '12%' }}></div>
            </div>
            <span className="text-sm font-semibold text-[#EF4444]">12</span>
            <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-xs font-semibold">SCAM</span>
          </div>
          <button className="text-[#00E5FF] font-semibold hover:underline text-sm">
            View Proof &rarr;
          </button>
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
          <span>22,100 views</span>
          <span>1,200 comments</span>
          <span>890 shares</span>
          <span>4,500 likes</span>
        </div>
      </div>
    </div>
  );
}
