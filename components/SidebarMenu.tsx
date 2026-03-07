'use client';

import { useEffect, memo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  X, BarChart3, Dna, Search, Link2, TrendingUp, Trophy, Radio, Fish,
  ArrowLeftRight, Bot, Bell, Users, Shield, Target, Compass, Rocket,
  Building2, Briefcase, PieChart, DollarSign, MessageCircle, Copy,
  Zap, Gamepad2, Wallet, CandlestickChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SidebarMenuProps {
  onClose: () => void;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    title: 'Overview',
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
      { icon: PieChart, label: 'Portfolio', path: '/dashboard/portfolio', badge: 'NEW' },
    ],
  },
  {
    title: 'Market',
    items: [
      { icon: CandlestickChart, label: 'Market', path: '/dashboard/market', badge: 'SOON' },
      { icon: Zap, label: 'Trading Suite', path: '/dashboard/trading-suite' },
      { icon: ArrowLeftRight, label: 'Swap', path: '/dashboard/swap' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { icon: Dna, label: 'DNA Analyzer', path: '/dashboard/dna-analyzer', badge: 'AI' },
      { icon: Search, label: 'Wallet Intelligence', path: '/dashboard/wallet-intelligence' },
      { icon: Link2, label: 'Wallet Clusters', path: '/dashboard/wallet-clusters' },
      { icon: TrendingUp, label: 'On-Chain Trends', path: '/dashboard/trends' },
      { icon: Trophy, label: 'Smart Money', path: '/dashboard/smart-money' },
      { icon: Radio, label: 'Network Metrics', path: '/dashboard/network-metrics' },
      { icon: Fish, label: 'Whale Tracker', path: '/dashboard/whale-tracker' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { icon: Wallet, label: 'Wallet', path: '/dashboard/wallet-page', badge: 'NEW' },
      { icon: Bot, label: 'VTX AI', path: '/dashboard/vtx-ai' },
      { icon: Bell, label: 'Alerts', path: '/dashboard/alerts' },
      { icon: Shield, label: 'Security Center', path: '/dashboard/security' },
      { icon: Target, label: 'Risk Scanner', path: '/dashboard/risk-scanner' },
      { icon: Users, label: 'Social Trading', path: '/dashboard/social-trading' },
      { icon: Copy, label: 'Copy Trading', path: '/dashboard/copy-trading' },
    ],
  },
  {
    title: 'Discover',
    items: [
      { icon: Compass, label: 'Project Discovery', path: '/dashboard/project-discovery' },
      { icon: Building2, label: 'Builder Network', path: '/dashboard/builder-network' },
      { icon: Briefcase, label: 'Builder Funding', path: '/dashboard/builder-funding' },
      { icon: Rocket, label: 'Launchpad', path: '/dashboard/launchpad' },
      { icon: MessageCircle, label: 'Community', path: '/dashboard/community' },
    ],
  },
  {
    title: 'Play',
    items: [
      { icon: Gamepad2, label: 'HODL Runner', path: '/dashboard/hodl-runner', badge: 'PLAY' },
      { icon: Rocket, label: 'STZ Runner', path: '/dashboard/wgm-runner', badge: 'NEW' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: DollarSign, label: 'Pricing', path: '/dashboard/pricing' },
    ],
  },
];

const KEY_ROUTES = [
  '/dashboard', '/dashboard/portfolio', '/dashboard/trading-suite',
  '/dashboard/whale-tracker', '/dashboard/vtx-ai', '/dashboard/security',
];

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    KEY_ROUTES.forEach(route => router.prefetch(route));
  }, [router]);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />

      <div
        className="fixed top-0 left-0 h-full w-[280px] lg:w-[240px] bg-[#0A0E1A] border-r border-white/[0.06] z-50 flex flex-col overflow-hidden animate-slide-in-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/steinz-logo-128.png" alt="STEINZ" className="w-7 h-7" style={{ objectFit: 'contain' }} />
            <span className="text-sm font-heading font-bold tracking-tight text-white">STEINZ</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-muted-foreground hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-hide">
          {NAV_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-3 mb-1.5">
                {category.title}
              </h3>
              <div className="space-y-0.5">
                {category.items.map((item) => (
                  <SidebarNavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    isActive={pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    onHover={() => router.prefetch(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
          <div className="text-[10px] text-gray-600 font-mono">v1.0.0-beta</div>
        </div>
      </div>
    </>
  );
}

const SidebarNavItem = memo(function SidebarNavItem({
  icon: Icon,
  label,
  badge,
  isActive,
  onClick,
  onHover,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  isActive: boolean;
  onClick: () => void;
  onHover?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 flex items-center gap-2.5 text-[13px] group relative ${
        isActive
          ? 'bg-neon-blue/[0.08] text-white font-medium'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-neon-blue" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-neon-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
      <span className="truncate">{label}</span>
      {badge && (
        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
          badge === 'AI' ? 'bg-purple-500/15 text-purple-400' :
          badge === 'HOT' ? 'bg-red-500/15 text-red-400' :
          badge === 'NEW' ? 'bg-neon-blue/15 text-neon-blue-300' :
          badge === 'PLAY' ? 'bg-emerald-500/15 text-emerald-400' :
          badge === 'SOON' ? 'bg-amber-500/15 text-amber-400' :
          'bg-neon-blue/15 text-neon-blue-300'
        }`}>{badge}</span>
      )}
    </button>
  );
});
