'use client';

import { Users, MessageSquare } from 'lucide-react';

export default function SocialTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-16 h-16 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-2xl flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-[#00E5FF]" />
      </div>
      <h2 className="text-xl font-heading font-bold mb-2">Social Trading</h2>
      <p className="text-gray-400 text-sm text-center mb-6 max-w-xs leading-relaxed">
        Follow top traders, share insights, and copy winning strategies from the smartest wallets on-chain.
      </p>
      <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-xl font-semibold text-sm hover:scale-105 transition-transform">
        Connect Wallet to Start
      </button>

      <div className="w-full mt-8">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-sm font-bold">Messages</h3>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-4">
          <input
            type="text"
            placeholder="Search conversations..."
            className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500"
          />
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Active (3)</div>
        <div className="space-y-1">
          {[
            { name: '@cryptotrader', msg: 'Did you see that SOL whale move?', time: '2m ago', avatar: '👨‍💻' },
            { name: '@degen_hunter', msg: 'BONK looking bullish', time: '1h ago', avatar: '🦊' },
            { name: '@builderDAO', msg: 'Interested in your project', time: '3h ago', avatar: '👷' },
          ].map((chat) => (
            <div key={chat.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors border-b border-white/5">
              <div className="w-8 h-8 bg-[#1A2235] rounded-full flex items-center justify-center text-sm flex-shrink-0">
                {chat.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{chat.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{chat.msg}</div>
              </div>
              <span className="text-[10px] text-gray-600 flex-shrink-0">{chat.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
