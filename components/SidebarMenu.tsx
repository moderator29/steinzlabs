'use client';

import { useEffect, memo, useState } from 'react';
import { X, BarChart3, Dna, Search, Link2, TrendingUp, Trophy, Radio, Fish, ArrowLeftRight, Bot, Bell, Users, Shield, Target, Compass, Rocket, Building2, Briefcase, PieChart, DollarSign, MessageCircle, Copy, Zap, Gamepad2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SidebarMenuProps {
  onClose: () => void;
}

const KEY_ROUTES = [
  '/dashboard', '/dashboard/predictions', '/dashboard/portfolio',
  '/dashboard/trading-suite', '/dashboard/whale-tracker', '/dashboard/vtx-ai', '/dashboard/security',
];

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    KEY_ROUTES.forEach(route => router.prefetch(route));
    requestAnimationFrame(() => setIsOpen(true));
  }, [router]);

  const handleHoverPrefetch = (path: string) => {
    router.prefetch(path);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-colors duration-200 ${isOpen ? 'bg-black/40' : 'bg-black/0'}`}
      onClick={handleClose}
    >
      <div
        className={`absolute right-0 top-0 h-full w-80 bg-[#0B0D14] border-l border-[#232637] p-5 overflow-y-auto scrollbar-hide transition-transform duration-200 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-[#F9FAFB] uppercase tracking-wider">Menu</h2>
          <button onClick={handleClose} className="hover:bg-white/[0.06] p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-[11px] font-medium text-[#6B7280] uppercase mb-2 tracking-wider px-3">Core</h3>
            <div className="space-y-0.5">
              <SidebarItem icon={BarChart3} label="Dashboard" onClick={() => handleNavigation('/dashboard')} onHover={() => handleHoverPrefetch('/dashboard')} />
              <SidebarItem icon={PieChart} label="Portfolio" onClick={() => handleNavigation('/dashboard/portfolio')} onHover={() => handleHoverPrefetch('/dashboard/portfolio')} />
              <SidebarItem icon={Zap} label="Full Trading Suite" onClick={() => handleNavigation('/dashboard/trading-suite')} onHover={() => handleHoverPrefetch('/dashboard/trading-suite')} />
              <SidebarItem icon={Dna} label="Trading DNA Analyzer" onClick={() => handleNavigation('/dashboard/dna-analyzer')} onHover={() => handleHoverPrefetch('/dashboard/dna-analyzer')} />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-medium text-[#6B7280] uppercase mb-2 tracking-wider px-3">Intelligence</h3>
            <div className="space-y-0.5">
              <SidebarItem icon={Search} label="Wallet Intelligence" onClick={() => handleNavigation('/dashboard/wallet-intelligence')} onHover={() => handleHoverPrefetch('/dashboard/wallet-intelligence')} />
              <SidebarItem icon={Link2} label="Wallet Clusters" onClick={() => handleNavigation('/dashboard/wallet-clusters')} onHover={() => handleHoverPrefetch('/dashboard/wallet-clusters')} />
              <SidebarItem icon={TrendingUp} label="On-Chain Trends" onClick={() => handleNavigation('/dashboard/trends')} onHover={() => handleHoverPrefetch('/dashboard/trends')} />
              <SidebarItem icon={Trophy} label="Smart Money Watchlist" onClick={() => handleNavigation('/dashboard/smart-money')} onHover={() => handleHoverPrefetch('/dashboard/smart-money')} />
              <SidebarItem icon={Radio} label="Network Metrics" onClick={() => handleNavigation('/dashboard/network-metrics')} onHover={() => handleHoverPrefetch('/dashboard/network-metrics')} />
              <SidebarItem icon={Fish} label="Whale Tracker" onClick={() => handleNavigation('/dashboard/whale-tracker')} onHover={() => handleHoverPrefetch('/dashboard/whale-tracker')} />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-medium text-[#6B7280] uppercase mb-2 tracking-wider px-3">Tools</h3>
            <div className="space-y-0.5">
              <SidebarItem icon={Wallet} label="Wallet" onClick={() => handleNavigation('/dashboard/wallet-page')} onHover={() => handleHoverPrefetch('/dashboard/wallet-page')} />
              <SidebarItem icon={ArrowLeftRight} label="Multi-Chain Swap" onClick={() => handleNavigation('/dashboard/swap')} onHover={() => handleHoverPrefetch('/dashboard/swap')} />
              <SidebarItem icon={Bot} label="VTX AI Assistant" onClick={() => handleNavigation('/dashboard/vtx-ai')} onHover={() => handleHoverPrefetch('/dashboard/vtx-ai')} />
              <SidebarItem icon={Bell} label="Smart Alerts" onClick={() => handleNavigation('/dashboard/alerts')} onHover={() => handleHoverPrefetch('/dashboard/alerts')} />
              <SidebarItem icon={DollarSign} label="Pricing" onClick={() => handleNavigation('/dashboard/pricing')} onHover={() => handleHoverPrefetch('/dashboard/pricing')} />
              <SidebarItem icon={Users} label="Social Trading" onClick={() => handleNavigation('/dashboard/social-trading')} onHover={() => handleHoverPrefetch('/dashboard/social-trading')} />
              <SidebarItem icon={Copy} label="Copy Trading" onClick={() => handleNavigation('/dashboard/copy-trading')} onHover={() => handleHoverPrefetch('/dashboard/copy-trading')} />
              <SidebarItem icon={Shield} label="Security Center" onClick={() => handleNavigation('/dashboard/security')} onHover={() => handleHoverPrefetch('/dashboard/security')} />
              <SidebarItem icon={Target} label="AI Risk Scanner" onClick={() => handleNavigation('/dashboard/risk-scanner')} onHover={() => handleHoverPrefetch('/dashboard/risk-scanner')} />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-medium text-[#6B7280] uppercase mb-2 tracking-wider px-3">Discover</h3>
            <div className="space-y-0.5">
              <SidebarItem icon={Compass} label="Project Discovery" onClick={() => handleNavigation('/dashboard/project-discovery')} onHover={() => handleHoverPrefetch('/dashboard/project-discovery')} />
              <SidebarItem icon={Building2} label="Builder Network" onClick={() => handleNavigation('/dashboard/builder-network')} onHover={() => handleHoverPrefetch('/dashboard/builder-network')} />
              <SidebarItem icon={Briefcase} label="Builder Funding Portal" onClick={() => handleNavigation('/dashboard/builder-funding')} onHover={() => handleHoverPrefetch('/dashboard/builder-funding')} />
              <SidebarItem icon={Rocket} label="Launchpad" onClick={() => handleNavigation('/dashboard/launchpad')} onHover={() => handleHoverPrefetch('/dashboard/launchpad')} />
              <SidebarItem icon={MessageCircle} label="Community" onClick={() => handleNavigation('/dashboard/community')} onHover={() => handleHoverPrefetch('/dashboard/community')} />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-medium text-[#6B7280] uppercase mb-2 tracking-wider px-3">Play</h3>
            <div className="space-y-0.5">
              <SidebarItem icon={Gamepad2} label="HODL Runner" onClick={() => handleNavigation('/dashboard/hodl-runner')} onHover={() => handleHoverPrefetch('/dashboard/hodl-runner')} />
              <SidebarItem icon={Rocket} label="NAKA Runner" onClick={() => handleNavigation('/dashboard/wgm-runner')} onHover={() => handleHoverPrefetch('/dashboard/wgm-runner')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SidebarItem = memo(function SidebarItem({ icon: Icon, label, onClick, onHover }: { icon: React.ElementType; label: string; onClick: () => void; onHover?: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center gap-3 text-sm text-[#D1D5DB] hover:text-[#F9FAFB] group"
    >
      <Icon className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#F9FAFB] transition-colors" />
      <span>{label}</span>
    </button>
  );
});
