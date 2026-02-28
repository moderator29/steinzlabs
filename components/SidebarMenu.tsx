'use client';

import { X, Home, BarChart3, TrendingUp, Search, Layers, Activity, Radar, Users, ArrowLeftRight, Brain, Bell, Shield, Zap, Compass, ChevronRight, Globe, Landmark, Grid3X3, Lock, Scan } from 'lucide-react';

interface SidebarMenuProps {
  onClose: () => void;
}

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-72 bg-[#0A0E1A] border-l border-white/10 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="text-sm font-heading font-bold">Menu</span>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-0.5">
          <MenuItem icon={Home} label="Home / Context Feed" />
          <MenuItem icon={BarChart3} label="Portfolio Dashboard" />
          <MenuItem icon={TrendingUp} label="Trading DNA Analyzer" badge="NEW" />

          <SectionTitle>Intelligence</SectionTitle>
          <MenuItem icon={Search} label="Wallet Intelligence" />
          <MenuItem icon={Layers} label="Wallet Clusters" />
          <MenuItem icon={Activity} label="On-Chain Trends" />
          <MenuItem icon={Radar} label="Smart Money Watchlist" />
          <MenuItem icon={Activity} label="Network Metrics" />
          <MenuItem icon={Compass} label="Whale Tracker" />

          <SectionTitle>Tools</SectionTitle>
          <MenuItem icon={ArrowLeftRight} label="Multi-Chain Swap" />
          <MenuItem icon={Brain} label="VTX AI Assistant" />
          <MenuItem icon={Bell} label="Smart Alerts" />
          <MenuItem icon={Users} label="Social Trading" />
          <MenuItem icon={Shield} label="Security Center" badge="NEW" />
          <MenuItem icon={Zap} label="AI Risk Scanner" badge="NEW" />

          <SectionTitle>Discover</SectionTitle>
          <MenuItem icon={Search} label="Project Discovery" active />
          <MenuItem icon={Globe} label="Builder Network" />
          <MenuItem icon={Landmark} label="Builder Funding Portal" badge="NEW" />
          <MenuItem icon={Grid3X3} label="Launchpad" />

          <SectionTitle>Security</SectionTitle>
          <MenuItem icon={Shield} label="Token Safety Scanner" />
          <MenuItem icon={Scan} label="Contract Analyzer" />
          <MenuItem icon={Lock} label="Rug Detector" />
          <MenuItem icon={Globe} label="Phishing Detector" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-5 pb-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{children}</span>
    </div>
  );
}

function MenuItem({ icon: Icon, label, badge, active }: { icon: React.ElementType; label: string; badge?: string; active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${active ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'text-gray-300 hover:bg-white/5'}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px] font-semibold">{badge}</span>
      )}
      {active && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
    </button>
  );
}
