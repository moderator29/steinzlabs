'use client';

import { X } from 'lucide-react';

interface SidebarMenuProps {
  onClose: () => void;
}

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-80 bg-[#0A0E1A] border-l border-white/10 p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-heading font-bold">Menu</h2>
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Intelligence</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Whale Tracker
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Smart Money Watchlist
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Network Metrics
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Tools</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Token Scanner
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Multi-Chain Swap
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Trading DNA
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Account</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Settings
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
