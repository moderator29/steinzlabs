'use client';

import { X, BarChart3, Dna, Search, Link2, TrendingUp, Trophy, Radio, Fish, ArrowLeftRight, Bot, Bell, Users, Shield, Target, Compass, Rocket, Building2, Briefcase, Crown, PieChart, ShieldCheck, DollarSign, MessageCircle, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SidebarMenuProps {
  onClose: () => void;
}

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-80 bg-[#0A0E1A] border-l border-white/10 p-6 overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-bold">Menu</h2>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Core</h3>
            <div className="space-y-1">
              <SidebarItem icon={BarChart3} label="Dashboard" onClick={() => handleNavigation('/dashboard')} />
              <SidebarItem icon={PieChart} label="Portfolio" badge="NEW" onClick={() => handleNavigation('/dashboard/portfolio')} />
              <SidebarItem icon={Dna} label="Trading DNA Analyzer" badge="AI" onClick={() => handleNavigation('/dashboard/dna-analyzer')} />
              <SidebarItem icon={DollarSign} label="Pricing" onClick={() => handleNavigation('/dashboard/pricing')} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Intelligence</h3>
            <div className="space-y-1">
              <SidebarItem icon={Search} label="Wallet Intelligence" onClick={() => handleNavigation('/dashboard/wallet-intelligence')} />
              <SidebarItem icon={Link2} label="Wallet Clusters" onClick={() => handleNavigation('/dashboard/wallet-clusters')} />
              <SidebarItem icon={TrendingUp} label="On-Chain Trends" onClick={() => handleNavigation('/dashboard/trends')} />
              <SidebarItem icon={Trophy} label="Smart Money Watchlist" onClick={() => handleNavigation('/dashboard/smart-money')} />
              <SidebarItem icon={Radio} label="Network Metrics" onClick={() => handleNavigation('/dashboard/network-metrics')} />
              <SidebarItem icon={Fish} label="Whale Tracker" onClick={() => handleNavigation('/dashboard/whale-tracker')} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Tools</h3>
            <div className="space-y-1">
              <SidebarItem icon={ArrowLeftRight} label="Multi-Chain Swap" onClick={() => handleNavigation('/dashboard/swap')} />
              <SidebarItem icon={Bot} label="VTX AI Assistant" onClick={() => handleNavigation('/dashboard/vtx-ai')} />
              <SidebarItem icon={Bell} label="Smart Alerts" onClick={() => handleNavigation('/dashboard/alerts')} />
              <SidebarItem icon={Users} label="Social Trading" onClick={() => handleNavigation('/dashboard/social-trading')} />
              <SidebarItem icon={Copy} label="Copy Trading" onClick={() => handleNavigation('/dashboard/copy-trading')} />
              <SidebarItem icon={Shield} label="Security Center" onClick={() => handleNavigation('/dashboard/security')} />
              <SidebarItem icon={Target} label="AI Risk Scanner" onClick={() => handleNavigation('/dashboard/risk-scanner')} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Discover</h3>
            <div className="space-y-1">
              <SidebarItem icon={Compass} label="Project Discovery" onClick={() => handleNavigation('/dashboard/project-discovery')} />
              <SidebarItem icon={Building2} label="Builder Network" onClick={() => handleNavigation('/dashboard/builder-network')} />
              <SidebarItem icon={Briefcase} label="Builder Funding Portal" onClick={() => handleNavigation('/dashboard/builder-funding')} />
              <SidebarItem icon={Rocket} label="Launchpad" onClick={() => handleNavigation('/dashboard/launchpad')} />
              <SidebarItem icon={MessageCircle} label="Community" onClick={() => handleNavigation('/dashboard/community')} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, badge, onClick }: { icon: React.ElementType; label: string; badge?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-3 text-sm"
    >
      <Icon className="w-4 h-4 text-[#00E5FF]" />
      <span>{label}</span>
      {badge && (
        <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-semibold ${
          badge === 'AI' ? 'bg-[#7C3AED]/20 text-[#7C3AED]' :
          badge === 'NEW' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' :
          'bg-[#00E5FF]/20 text-[#00E5FF]'
        }`}>{badge}</span>
      )}
    </button>
  );
}
