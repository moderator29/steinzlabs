'use client';

import { Wallet, ArrowDown, ArrowUp, Camera, Plus } from 'lucide-react';

export default function WalletTab() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Wallet</h2>
          <p className="text-[10px] text-gray-400">Manage your assets</p>
        </div>
      </div>

      <div className="glass rounded-xl p-6 border border-white/10 text-center mb-4">
        <div className="text-xs text-gray-400 mb-1">Total Balance</div>
        <div className="text-3xl font-bold font-mono mb-4">$0.00</div>
        <div className="flex justify-center gap-6">
          {[
            { icon: ArrowDown, label: 'Receive' },
            { icon: ArrowUp, label: 'Send' },
            { icon: Camera, label: 'Scan' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 border border-[#00E5FF]/30 rounded-full flex items-center justify-center hover:bg-[#00E5FF]/10 transition-colors">
                  <Icon className="w-4 h-4 text-[#00E5FF]" />
                </div>
                <span className="text-[10px] text-gray-400">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-xl p-6 border border-white/10 text-center bg-gradient-to-b from-[#00E5FF]/5 to-transparent">
        <div className="w-10 h-10 bg-[#1A2235] rounded-full flex items-center justify-center mx-auto mb-3">
          <Plus className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-heading font-bold mb-1">Connect Your Wallet</h3>
        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
          Link your Web3 wallet to track your portfolio and participate in predictions
        </p>
        <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-2.5 rounded-xl text-sm font-semibold hover:scale-105 transition-transform">
          Connect Wallet
        </button>
      </div>
    </div>
  );
}
