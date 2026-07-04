'use client';

import { useEffect, useState, memo } from 'react';
import { usePathname } from 'next/navigation';
import SteinzLogo from '@/components/ui/SteinzLogo';
// Brand icon library — gradient-glowing platform icons. Missing specialty
// icons fall back to lucide-react until they land in the brand library
// (mirrors the hybrid-import pattern used elsewhere on main).
import {
  X, ChartBar as BarChart3, Search, TrendingUp, Whale as Fish, Bell, Shield,
  Wallet, ChartCandle as CandlestickChart,
} from '@/components/icons/brand';
import {
  Dna, Link2, Trophy, Radio, ArrowLeftRight, Bot, Target, PieChart, DollarSign,
  Archive, Circle, FileCode, FlaskConical, BookOpen, FileSearch, CheckSquare,
  Crosshair, Network, Globe, History, MessageCircle, Compass, Gem,
  LineChart,
  Sparkles,
  ScanSearch,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GlobalWhatsNewButton } from '@/components/common/GlobalWhatsNew';

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
      { icon: Sparkles, label: 'Ask the Chain', path: '/dashboard/ask-chain', badge: 'AI' },
      { icon: ScanSearch, label: 'Token X-Ray', path: '/dashboard/token-xray', badge: 'NEW' },
      { icon: PieChart, label: 'Portfolio', path: '/dashboard/portfolio', badge: 'NEW' },
      { icon: Bell, label: 'Notifications', path: '/dashboard/notifications' },
    ],
  },
  {
    title: 'Social',
    items: [
      { icon: Compass, label: 'Discover', path: '/discover' },
      { icon: MessageCircle, label: 'Messages', path: '/dashboard/messages' },
    ],
  },
  {
    title: 'Trading',
    items: [
      { icon: CandlestickChart, label: 'Market', path: '/dashboard/market' },
      { icon: ArrowLeftRight, label: 'Swap', path: '/dashboard/swap' },
      { icon: History, label: 'Transactions', path: '/dashboard/transactions' },
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
      { icon: Shield, label: 'Wash Trade Radar', path: '/dashboard/wash-radar', badge: 'NEW' },
      { icon: Target, label: 'MEV Radar', path: '/dashboard/mev-radar', badge: 'NEW' },
      { icon: Search, label: 'Fresh Money Detector', path: '/dashboard/fresh-money', badge: 'NEW' },
      { icon: Radio, label: 'Network Metrics', path: '/dashboard/network-metrics' },
      { icon: Fish, label: 'Whale Tracker', path: '/dashboard/whale-tracker' },
      { icon: Circle, label: 'Bubble Map', path: '/dashboard/bubble-map', badge: 'NEW' },
    ],
  },
  {
    title: 'Security',
    items: [
      { icon: Shield, label: 'Security Center', path: '/dashboard/security' },
      { icon: Globe, label: 'Domain Shield', path: '/dashboard/domain-shield' },
      { icon: FileCode, label: 'Signature Insight', path: '/dashboard/signature-insight' },
      { icon: FileSearch, label: 'Contract Analyzer', path: '/dashboard/contract-analyzer' },
      { icon: CheckSquare, label: 'Approval Manager', path: '/dashboard/approval-manager' },
      { icon: Target, label: 'Risk Scanner', path: '/dashboard/risk-scanner' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { icon: Wallet, label: 'Wallet', path: '/dashboard/wallet-page', badge: 'NEW' },
      { icon: Bot, label: 'VTX Agent', path: '/dashboard/vtx-ai' },
      { icon: Crosshair, label: 'Sniper Bot', path: '/dashboard/sniper' },
      { icon: LineChart, label: 'Market Maker', path: '/dashboard/market-maker', badge: 'NEW' },
      { icon: Network, label: 'Network Graph', path: '/dashboard/network-graph', badge: 'NEW' },
      { icon: Bell, label: 'Alerts', path: '/dashboard/alerts' },
      { icon: FlaskConical, label: 'Research Lab', path: '/dashboard/research', badge: 'NEW' },
      { icon: Archive, label: 'Archive', path: '/dashboard/archive' },
    ],
  },
  // §12 — NakaCult / The Vault remain a standalone token-gated surface; the
  // sidebar links into them ONLY for confirmed cult members (rendered
  // conditionally below, not in this static list). Non-members never see it and
  // still reach NakaCult solely via the /naka-cult landing. This gives a
  // logged-in member (e.g. an email/Google account that holds the entitlement)
  // a direct in-app door to /vault — the /naka-cult landing is wallet-connect
  // only and has no email/password field.
  {
    title: 'Account',
    items: [
      { icon: DollarSign, label: 'Pricing', path: '/dashboard/pricing' },
    ],
  },
];

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Only confirmed cult members get the in-app Vault link (see §12). Resolved
  // server-side via /api/cult/me so we never trust client state; defaults
  // hidden for anonymous/non-members.
  const [isCultMember, setIsCultMember] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.cult === true) setIsCultMember(true); })
      .catch(() => { /* non-fatal — link stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  // Live unread-DM count for the Messages nav badge. Polled (cheap) + refreshed
  // on window focus so it clears after the user reads a thread.
  const [unreadDms, setUnreadDms] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchUnread = () => {
      fetch('/api/social/dm/conversations', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && d) setUnreadDms(d.total_unread ?? 0); })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    const onFocus = () => fetchUnread();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="fixed top-0 left-0 h-full w-[260px] max-w-[80vw] bg-[#0A0E27] border-r border-white/[0.06] z-[calc(var(--z-modal)+1)] flex flex-col overflow-hidden animate-slide-in-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <SteinzLogo size={28} animated={false} />
            <span className="text-sm font-heading font-bold tracking-tight text-white">NAKA LABS</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-hide">
          {isCultMember && (
            <div>
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-3 mb-1.5">
                NakaCult
              </h3>
              <div className="space-y-0.5">
                <SidebarNavItem
                  icon={Gem}
                  label="Enter the Vault"
                  isActive={pathname.startsWith('/vault')}
                  onClick={() => handleNavigation('/vault')}
                  onHover={() => router.prefetch('/vault')}
                />
              </div>
            </div>
          )}
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
                    badge={item.path === '/dashboard/messages' && unreadDms > 0 ? (unreadDms > 99 ? '99+' : String(unreadDms)) : item.badge}
                    isActive={pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    onHover={() => router.prefetch(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0 space-y-2">
          <GlobalWhatsNewButton />
          <div className="text-[10px] text-gray-600 font-mono px-1">NAKA LABS v1.0.0-beta</div>
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
      className={`w-full text-start px-3 py-2 rounded-lg transition-all duration-150 flex items-center gap-2.5 text-[12px] group relative ${
        isActive
          ? 'bg-[#0066FF]/[0.08] text-white font-medium'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#0066FF]" />
      )}
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#0066FF]' : 'text-gray-500 group-hover:text-gray-300'}`} />
      <span className="truncate">{label}</span>
      {badge && (
        <span className={`ms-auto px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
          badge === 'AI' ? 'bg-purple-500/15 text-purple-400' :
          badge === 'BETA' ? 'bg-[#10B981]/15 text-[#10B981]' :
          badge === 'PRO' ? 'bg-amber-500/15 text-amber-400' :
          'bg-[#0066FF]/15 text-blue-300'
        }`}>{badge}</span>
      )}
    </button>
  );
});
