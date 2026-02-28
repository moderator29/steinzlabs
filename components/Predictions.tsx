'use client';

export default function Predictions() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-3xl font-bold text-[#00E5FF]">0</div>
          <div className="text-sm text-gray-400 mt-1">Active</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-3xl font-bold text-[#00E5FF]">$0</div>
          <div className="text-sm text-gray-400 mt-1">Total Volume</div>
        </div>
        <div className="glass rounded-xl p-4 text-center border border-white/10">
          <div className="text-3xl font-bold text-[#00E5FF]">0</div>
          <div className="text-sm text-gray-400 mt-1">Resolved</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-8 border border-white/10 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🎯</span>
        </div>
        <h3 className="text-xl font-heading font-bold mb-2">Predictions Market</h3>
        <p className="text-gray-400 mb-6">Bet on on-chain events with verified outcomes. Coming soon.</p>
        <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform opacity-50 cursor-not-allowed" disabled>
          Coming Soon
        </button>
      </div>
    </div>
  );
}
