'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SteinzLogo from '@/components/ui/SteinzLogo';
// Flat lucide-react icon set only. The brand gradient-glow icons were swapped
// out here for their clean lucide equivalents (see mapping in the PR): brand
// `Whale`→`Fish`, `ChartBar`→`BarChart3`, `ChartCandle`→`CandlestickChart`,
// brand `X/Search/TrendingUp/Bell/Shield/Wallet`→same-named lucide icons. No
// `variant` prop (lucide has none).
import {
  X, BarChart3, Search, TrendingUp, Fish, Bell, Shield, Wallet,
  CandlestickChart, Dna, Link2, Trophy, Radio, ArrowLeftRight, Bot, Target, Copy,
  PieChart, DollarSign, Archive, Circle, FileCode, FlaskConical, FileSearch,
  CheckSquare, Crosshair, Network, Globe, History, MessageCircle, Compass, Gem,
  LineChart, Sparkles, ScanSearch, Settings, ShieldCheck, LayoutGrid, Rss,
  Newspaper, LogIn, LogOut, UserCircle2, Twitter, Send, LifeBuoy, FileText,
  ChevronRight,
} from 'lucide-react';
import { GlobalWhatsNewButton } from '@/components/common/GlobalWhatsNew';
import { useAuth } from '@/lib/hooks/useAuth';

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

// Single source of truth for the platform's navigable surfaces. Every path here
// resolves to a real app/**/page.tsx route (the Home sub-tabs use the
// /dashboard `?subtab=` param the home page reads). Token-gated Vault + the
// admin panel are appended conditionally at render time (see below).
const NAV_CATEGORIES: NavCategory[] = [
  {
    // Quick actions — Swap sits at the very top so members can trade in one tap.
    // The Wire / Context Feed / News / Stocks / Market / Prediction / Overview all
    // live in the dashboard's own sub-tabs, so they were removed from here to
    // stop duplicating navigation.
    title: 'Quick',
    items: [
      { icon: ArrowLeftRight, label: 'Swap', path: '/dashboard/swap' },
    ],
  },
  {
    title: 'Overview',
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
      { icon: Sparkles, label: 'Ask the Chain', path: '/dashboard/ask-chain', badge: 'AI' },
      { icon: ScanSearch, label: 'Token X-Ray', path: '/dashboard/token-xray', badge: 'BETA' },
      { icon: TrendingUp, label: 'Narrative Radar', path: '/dashboard/sector-rotation', badge: 'BETA' },
      { icon: PieChart, label: 'Portfolio', path: '/dashboard/portfolio', badge: 'BETA' },
      { icon: Bell, label: 'Notifications', path: '/dashboard/notifications' },
      { icon: Bell, label: 'Alerts Center', path: '/dashboard/alerts-center', badge: 'BETA' },
    ],
  },
  {
    title: 'Social',
    items: [
      { icon: MessageCircle, label: 'Messages', path: '/dashboard/messages' },
    ],
  },
  {
    title: 'Trading',
    items: [
      { icon: CandlestickChart, label: 'Market', path: '/dashboard/market' },
      { icon: ArrowLeftRight, label: 'Swap', path: '/dashboard/swap' },
      { icon: Copy, label: 'Copy Trading', path: '/dashboard/copy-trading' },
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
      { icon: Radio, label: 'Network Metrics', path: '/dashboard/network-metrics' },
      { icon: Fish, label: 'Whale Tracker', path: '/dashboard/whale-tracker' },
      { icon: Circle, label: 'Bubble Map', path: '/dashboard/bubble-map', badge: 'BETA' },
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
      { icon: Bot, label: 'VTX Agent', path: '/dashboard/vtx-ai' },
      { icon: Crosshair, label: 'Sniper Bot', path: '/dashboard/sniper', badge: 'BETA' },
      { icon: LineChart, label: 'Market Maker', path: '/dashboard/market-maker', badge: 'BETA' },
      { icon: Network, label: 'Network Graph', path: '/dashboard/network-graph', badge: 'BETA' },
      { icon: Bell, label: 'Alerts', path: '/dashboard/alerts' },
      { icon: FlaskConical, label: 'Research Lab', path: '/dashboard/research', badge: 'BETA' },
      { icon: Archive, label: 'Archive', path: '/dashboard/archive' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: DollarSign, label: 'Pricing', path: '/dashboard/pricing' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
];

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();

  // Active-state resolver. usePathname() drops the query string, so the Home
  // sub-tab links (/dashboard?subtab=wire) never matched a bare pathname compare:
  // every non-overview home surface rendered inactive while the two plain
  // /dashboard rows both lit at once. Split each target into path + ?subtab and
  // match the live subtab param so exactly the intended row highlights.
  const activeSubtab = searchParams?.get('subtab') ?? null;
  const isItemActive = (target: string) => {
    const [base, query] = target.split('?');
    if (base !== pathname) return false;
    if (query) {
      const sub = new URLSearchParams(query).get('subtab');
      return (activeSubtab ?? 'overview') === sub;
    }
    // A bare /dashboard target reads as active only on the Overview subtab, never
    // while a specific home sub-tab (wire, news, stocks, ...) is showing.
    if (base === '/dashboard') return !activeSubtab || activeSubtab === 'overview';
    return true;
  };
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const isAdmin = user?.role === 'admin';

  // Only confirmed cult members get the in-app Vault link. Resolved server-side
  // via /api/cult/me so we never trust client state; defaults hidden for
  // anonymous/non-members.
  const [isCultMember, setIsCultMember] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.cult === true) setIsCultMember(true); })
      .catch(() => { /* non-fatal, link stays hidden */ });
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

  // Escape-to-close + background scroll lock + initial focus for the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    router.push('/login');
  };

  // Build the render order: static categories, then the token-gated Vault and
  // the admin panel as conditional groups so they only surface to who should
  // see them.
  const groups: NavCategory[] = [...NAV_CATEGORIES];
  if (isCultMember) {
    groups.push({ title: 'NakaCult', items: [{ icon: Gem, label: 'Enter the Vault', path: '/vault' }] });
  }
  if (isAdmin) {
    groups.push({ title: 'Admin', items: [{ icon: ShieldCheck, label: 'Admin Panel', path: '/admin' }] });
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[60] overflow-y-auto no-scrollbar bg-[#070A1E] animate-slide-up"
    >
      {/* Subtle aurora wash so the full-page surface reads as brand, not a flat black sheet. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(0,102,255,0.16), transparent 60%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(16,185,129,0.08), transparent 55%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-10 pt-5 sm:px-8">
        {/* ── Brand header ──────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <button
            onClick={() => handleNavigation('/dashboard')}
            className="flex items-center gap-3 rounded-xl px-1 py-1 -mx-1 transition-opacity hover:opacity-80"
          >
            <SteinzLogo size={34} animated={false} />
            <span className="font-heading text-lg font-bold tracking-tight text-white [text-shadow:0_0_18px_rgba(0,102,255,0.45)]">NAKA LABS</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Grouped nav ───────────────────────────────────────────────── */}
        {/* Each group sits in its own brand-glass panel with a soft neon ring,
            and fades up in a gentle stagger so the menu "breathes" open. */}
        <nav className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((category, gi) => (
            <section
              key={category.title}
              className="nl-glass rounded-2xl p-2.5 animate-slide-up"
              style={{ animationDelay: `${Math.min(gi * 45, 320)}ms`, animationFillMode: 'both' }}
            >
              <h3 className="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7fa8ff]/70">
                {category.title}
              </h3>
              <div className="space-y-0.5">
                {category.items.map((item) => (
                  <SidebarNavItem
                    key={`${category.title}-${item.path}`}
                    icon={item.icon}
                    label={item.label}
                    badge={item.path === '/dashboard/messages' && unreadDms > 0 ? (unreadDms > 99 ? '99+' : String(unreadDms)) : item.badge}
                    isActive={isItemActive(item.path)}
                    onClick={() => handleNavigation(item.path)}
                    onHover={() => { if (!item.path.includes('?')) router.prefetch(item.path); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="my-8 h-px w-full bg-white/[0.07]" />

        {/* ── Auth actions ──────────────────────────────────────────────── */}
        <section>
          {user ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => handleNavigation('/dashboard/profile')}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-start transition-colors hover:border-white/[0.12] hover:bg-white/[0.06]"
              >
                <UserCircle2 className="h-8 w-8 flex-shrink-0 text-[#6F8BFF]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">
                    {user.username ? `@${user.username}` : (user.first_name || 'Account')}
                  </span>
                  <span className="block truncate text-[11px] text-gray-500">{user.email ?? 'View profile'}</span>
                </span>
                <ChevronRight className="ms-2 h-4 w-4 flex-shrink-0 text-gray-600" />
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => handleNavigation('/login')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </button>
              <button
                onClick={() => handleNavigation('/signup')}
                className="naka-button-primary flex-1 justify-center text-sm"
              >
                Create account
              </button>
            </div>
          )}

          <div className="mt-4">
            <GlobalWhatsNewButton />
          </div>
        </section>

        {/* ── Footer: social + support/legal ────────────────────────────── */}
        <footer className="mt-auto pt-8">
          <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <a
                href="https://x.com/nakalabs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Naka Labs on X"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://t.me/nakalabs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Naka Labs on Telegram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <Send className="h-4 w-4" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-gray-500">
              <button onClick={() => handleNavigation('/dashboard/support')} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <LifeBuoy className="h-3.5 w-3.5" /> Support
              </button>
              <button onClick={() => handleNavigation('/docs')} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                <FileText className="h-3.5 w-3.5" /> Docs
              </button>
              <button onClick={() => handleNavigation('/terms')} className="transition-colors hover:text-white">Terms</button>
              <button onClick={() => handleNavigation('/privacy')} className="transition-colors hover:text-white">Privacy</button>
            </div>
          </div>
          <div className="mt-4 px-1 font-mono text-[10px] text-gray-600">NAKA LABS v1.0.0-beta</div>
        </footer>
      </div>
    </div>
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
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[13px] transition-all duration-150 ${
        isActive
          ? 'bg-[#0066FF]/[0.14] font-medium text-white ring-1 ring-inset ring-[#0066FF]/40 shadow-[0_0_18px_rgba(0,102,255,0.28)]'
          : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#1E90FF] shadow-[0_0_10px_rgba(30,144,255,0.8)]" />
      )}
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
          isActive
            ? 'bg-gradient-to-br from-[#1E90FF]/30 to-[#0066FF]/20 text-[#8fb6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
            : 'bg-white/[0.03] text-gray-400 group-hover:text-gray-200 group-hover:bg-[#0066FF]/[0.08]'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className={`ms-auto flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            badge === 'AI'
              ? 'bg-purple-500/15 text-purple-400'
              : badge === 'BETA'
              ? 'bg-[#10B981]/15 text-[#10B981]'
              : badge === 'PRO'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-[#0066FF]/15 text-blue-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
});
