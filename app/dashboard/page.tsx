'use client';

import { useState, useEffect, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Brand icon library — gradient-glowing platform icons. Missing specialty
// icons fall back to lucide-react (hybrid pattern used elsewhere on main).
import {
  Wallet, User, TrendingDown, Activity, ChartBar as BarChart3,
} from '@/components/icons/brand';
import {
  Home, MessageSquare, Zap, ArrowUpRight, ArrowDownRight, Search, Menu, X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFeatureUsageLog } from '@/lib/hooks/useFeatureUsageLog';
import SidebarMenu from '@/components/SidebarMenu';
import { OnboardingGate } from '@/components/onboarding/OnboardingFlow';

import { maybeNotifyWelcome } from '@/lib/notifications';
import SteinzLogo from '@/components/ui/SteinzLogo';
// CompactKpiBar removed — duplicated the 4 main KPI cards as a "ticker" strip
// above them. User feedback called it visual noise. The four full-size KPI
// cards rendered below already cover Total Market Cap / 24h Volume / BTC
// Dominance / Chains Tracked.
import { TopGainersCard } from '@/components/dashboard/TopGainersCard';
import { RenderWidgets } from '@/components/dashboard/RenderWidgets';
import { HeatingUpCard } from '@/components/dashboard/HeatingUpCard';
import { FirstRunTour } from '@/components/dashboard/FirstRunTour';

const ContextFeed    = lazy(() => import('@/components/ContextFeed'));
const MarketDashboard = lazy(() => import('@/components/MarketDashboard'));
const VtxAiTab       = lazy(() => import('@/components/VtxAiTab'));
const WalletTab   = lazy(() => import('@/components/WalletTab'));
const ProfileTab  = lazy(() => import('@/components/ProfileTab'));

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
    </div>
  );
}

class TabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; retries: number; lastError: string | null }> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, retries: 0, lastError: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, lastError: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surface in production: previous version silenced every tab throw and
    // auto-retried every 800ms, which produced an infinite spinner whenever
    // a tab (most often ProfileTab) threw deterministically on mount.
    console.error('[TabErrorBoundary] tab render threw:', error, info.componentStack);
    // §profile-retry-old-users — ship the throw to the server so we can
    // see the exact failure mode for existing-account-only bugs without
    // asking the owner to copy/paste devtools. Fire-and-forget; never
    // blocks the boundary's retry/render path.
    try {
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        // §reporter-404 — was /api/_log/client-error. Next.js App Router
        // treats underscore-prefixed segments as PRIVATE folders that
        // never get routed, so the reporter silently 404'd on every
        // prod throw. Owner's console (May 21) showed:
        //   POST /api/_log/client-error 404 (Not Found)
        // Renamed the folder to /api/log/client-error so the route
        // actually exists.
        void fetch('/api/log/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            componentStack: info.componentStack,
            path: window.location.pathname + window.location.search,
            source: 'TabErrorBoundary',
          }),
          keepalive: true,
        }).catch(() => { /* logging is best-effort */ });
      }
    } catch {
      // ignore reporter failure
    }
  }
  componentDidUpdate(_: { children: ReactNode }, prev: { hasError: boolean; retries: number; lastError: string | null }) {
    if (!prev.hasError && this.state.hasError) {
      // First throw: try ONCE more after a brief delay (covers a transient
      // hydration race). If it throws again, render a visible retry surface
      // so the user isn't trapped in a forever-spinner.
      if (this.state.retries < 1) {
        this.resetTimer = setTimeout(
          () => this.setState((s) => ({ hasError: false, retries: s.retries + 1, lastError: s.lastError })),
          400,
        );
      }
    }
  }
  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
  private handleManualRetry = () => {
    this.setState({ hasError: false, retries: 0, lastError: null });
  };
  render() {
    if (this.state.hasError) {
      if (this.state.retries < 1) {
        return (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 gap-3 text-center">
          <div className="text-sm text-slate-300 font-semibold">This tab hit an error while loading.</div>
          {this.state.lastError && (
            <div className="text-[11px] text-slate-500 font-mono max-w-md break-words">{this.state.lastError}</div>
          )}
          <button
            type="button"
            onClick={this.handleManualRetry}
            className="mt-2 px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0818CC] text-white text-xs font-semibold transition-colors"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline"
          >
            or reload the page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const StatCard = memo(function StatCard({ label, value, change, icon: Icon, trend }: {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
}) {
  // Compact Trust-Wallet / CoinGecko-style stat cell. Single row on desktop,
  // still single-row on mobile (the grid drops to 2 columns on small screens).
  // Migrated to .cult-card primitive (Phase A ascension) — keeps the same
  // density but adds the brand gradient halo on hover.
  return (
    <div className="cult-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-[#0066FF]/[0.10]">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] text-[#B4C0E0] tracking-wide">{label}</span>
        </div>
        {change ? (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : trend === 'down' ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
            {change}
          </div>
        ) : null}
      </div>
      <div className="text-[15px] sm:text-base font-bold text-white font-mono tracking-tight">{value}</div>
    </div>
  );
});

const BottomNav = memo(function BottomNav({ activeNav, onNavChange }: { activeNav: string; onNavChange: (id: string) => void }) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', href: null },
    { id: 'find', icon: Search, label: 'Find', href: '/discover' },
    { id: 'vtxai', icon: MessageSquare, label: 'VTX Agent', href: '/dashboard/vtx-ai' },
    { id: 'wallet', icon: Wallet, label: 'Wallet', href: null },
    { id: 'profile', icon: User, label: 'Profile', href: null },
  ];

  return (
    // Floating glassmorphic capsule — replaces the old edge-to-edge bar.
    // Sits 16px off the bottom with rounded-3xl corners, deep navy gradient,
    // backdrop blur with saturation pop, and a subtle blue inner-border so
    // the capsule reads as a premium nav surface against the aurora canvas.
    // iOS safe-area — naka-safe-bottom adds env(safe-area-inset-bottom)
    // so the floating capsule clears the iPhone home indicator instead of
    // sitting underneath it. No-op on Android / web.
    <div className="fixed bottom-4 left-4 right-4 z-[var(--z-sidebar)] flex justify-center pointer-events-none naka-safe-bottom">
      <div
        className="pointer-events-auto w-full max-w-lg rounded-3xl px-2.5 py-3 backdrop-blur-2xl border border-[#0066FF]/20 shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          background: 'linear-gradient(135deg, rgba(15,22,60,0.85) 0%, rgba(10,15,46,0.95) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.href) {
                    window.location.href = item.href;
                  } else {
                    onNavChange(item.id);
                  }
                }}
                className={`group relative flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 active:scale-[0.97] ${
                  isActive
                    ? 'text-[#00C8FF] bg-[#0066FF]/[0.12] shadow-[0_0_20px_rgba(0,102,255,0.35)] scale-[1.04]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04] hover:scale-[1.02]'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'drop-shadow-[0_0_6px_rgba(0,200,255,0.6)]' : ''}`} />
                <span className={`text-[10px] tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// Bug §2 — /dashboard (and by extension /dashboard/profile via redirect)
// showed an infinite spinner when useAuth() never resolved (Supabase hiccup,
// stale session cookie, network drop). The user was trapped with no escape.
// This component shows the spinner for the first 10 seconds and then renders
// an actionable retry / sign-in / dashboard-bypass surface.
function DashboardAuthLoadingGate() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  if (!timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F59E0B]/10">
          <div className="w-6 h-6 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Taking longer than expected</h2>
          <p className="text-sm text-gray-400 mt-1">
            We couldn&apos;t verify your session. Check your connection and try again.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-semibold transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => router.replace('/login?from=/dashboard')}
            className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-sm font-semibold border border-white/[0.08] transition-colors"
          >
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  useFeatureUsageLog('dashboard');
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?tab=profile / ?tab=wallet / ?tab=vtxai routes external links (notably
  // the /dashboard/profile redirect) to the right bottom-nav tab on mount.
  // Without this, /dashboard/profile redirected to /dashboard?tab=profile
  // and landed back on the home tab, leaving the user staring at a spinner
  // that resolved to the wrong page.
  const initialNav = (() => {
    const t = searchParams?.get('tab');
    return t === 'profile' || t === 'wallet' || t === 'vtxai' ? t : 'home';
  })();
  const [activeNav, setActiveNav] = useState<string>(initialNav);
  // ?subtab=overview|context|markets restores the home sub-tab — used by
  // /dashboard/proof's "Back to Feed" button (§6.3) so the user lands on
  // the Context Feed instead of the overview after explaining a signal.
  const initialSubtab = (() => {
    const s = searchParams?.get('subtab');
    return s === 'context' || s === 'markets' || s === 'overview' ? s : 'overview';
  })();
  const [activeTab, setActiveTab] = useState<'overview' | 'context' | 'markets'>(initialSubtab);

  // Restore market tab when navigating back from a coin detail page
  useEffect(() => {
    try {
      const saved = localStorage.getItem('steinz_last_tab');
      if (saved === 'markets') {
        localStorage.removeItem('steinz_last_tab');
        setActiveTab('markets');
      }
    } catch {
      // Malformed JSON — return default
    }
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [marketStats, setMarketStats] = useState<{
    totalMarketCap: string; totalVolume: string; btcDominance: string;
    marketCapChange: string; volumeChange: string; dominanceChange: string;
    activeCoins: string;
  } | null>(null);

  const handleNavChange = useCallback((id: string) => {
    setActiveNav(id);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?from=/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      maybeNotifyWelcome(user.email);
    }
  }, [user]);

  // Onboarding gate — checks profiles.onboarding_completed_at and
  // mounts the 10-card flow on first sign-in. Replay can be triggered
  // from Settings by setting onboarding_completed_at back to null
  // (the OnboardingGate re-reads on prop change).
  const [onboardedAt, setOnboardedAt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelled) setOnboardedAt((data?.onboarding_completed_at as string | null) ?? null);
      } catch {
        if (!cancelled) setOnboardedAt(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const fetchMarketStats = async () => {
      try {
        // Route through our unified service-layer endpoint so we share the
        // cache + rate-limit + usage counter with everything else.
        const res = await fetch('/api/dashboard/market-globals', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          const mc = data.totalMarketCap || 0;
          const vol = data.totalVolume || 0;
          const btcDom = data.btcDominance || 0;
          const mcChange = data.marketCapChange24h || 0;
          const active = Number(data.chainsTracked) || 0;
          setMarketStats({
            totalMarketCap: mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(1)}B`,
            totalVolume: vol >= 1e12 ? `$${(vol / 1e12).toFixed(2)}T` : `$${(vol / 1e9).toFixed(1)}B`,
            btcDominance: `${btcDom.toFixed(1)}%`,
            marketCapChange: `${mcChange >= 0 ? '+' : ''}${mcChange.toFixed(1)}%`,
            // Volume change 24h and dominance change aren't returned by the
            // CoinGecko /global endpoint on the demo plan, so we intentionally
            // leave them empty rather than fabricate a value.
            volumeChange: '',
            dominanceChange: '',
            activeCoins: active > 1000 ? `${Math.round(active / 100) / 10}k+` : String(active),
          });
        }
      } catch (err) {
        console.error('[dashboard] Fetch market stats failed:', err);
      }
    };
    fetchMarketStats();
    const interval = setInterval(fetchMarketStats, 120000);
    return () => clearInterval(interval);
  }, []);

  if (authLoading) {
    return <DashboardAuthLoadingGate />;
  }

  if (!user) return null;

  const showHomeTabs = activeNav === 'home';

  const renderContent = () => {
    if (activeNav === 'home') {
      if (activeTab === 'markets') return <MarketDashboard />;
      if (activeTab === 'context') return <ContextFeed />;
      return (
        // OV3: widget order honours the user's saved preference from
        // /api/dashboard/widgets. Each widget retains its own self-hide
        // logic (PortfolioHeroCard returns null for no-wallets users,
        // SinceLastLoginDigest hides on first-ever visit, etc.) so the
        // dashboard stays clean for fresh accounts.
        <RenderWidgets />
      );
    }
    if (activeNav === 'vtxai') return <VtxAiTab />;
    if (activeNav === 'wallet') return <WalletTab />;
    if (activeNav === 'profile') return <ProfileTab />;
    return null;
  };

  const stats = marketStats ? [
    { label: 'Total Market Cap', value: marketStats.totalMarketCap, change: marketStats.marketCapChange, icon: BarChart3, trend: (parseFloat(marketStats.marketCapChange) >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral' },
    { label: '24h Volume', value: marketStats.totalVolume, change: '', icon: Activity, trend: 'neutral' as const },
    { label: 'BTC Dominance', value: marketStats.btcDominance, change: '', icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Active Coins', value: marketStats.activeCoins, change: 'Live', icon: Zap, trend: 'up' as const },
  ] : [
    { label: 'Total Market Cap', value: '...', change: '', icon: BarChart3, trend: 'neutral' as const },
    { label: '24h Volume', value: '...', change: '', icon: Activity, trend: 'neutral' as const },
    { label: 'BTC Dominance', value: '...', change: '', icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Active Coins', value: '…', change: '', icon: Zap, trend: 'neutral' as const },
  ];

  return (
    <div className="min-h-screen text-white pb-28 sm:pb-24">
      <FirstRunTour />
      {/* iOS safe-area — naka-safe-top adds env(safe-area-inset-top) so
          the header clears the iPhone 14+ dynamic island / notch instead
          of being overlapped by it. No-op on Android / web. */}
      <div className="fixed top-0 w-full z-40/95 backdrop-blur-xl border-b border-white/[0.06] naka-safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors" aria-label="Open menu">
              {/* §hamburger-visibility — use lucide Menu/X here. The brand
                  icons paint with a fixed gradient stroke and ignore the
                  text-* colour, so the toggle read as invisible on the
                  near-black header even though its click area worked. lucide
                  honours currentColor, so text-white/80 actually applies. */}
              {menuOpen ? <X className="w-5 h-5 text-white/80 hover:text-white" /> : <Menu className="w-5 h-5 text-white/80 hover:text-white" />}
            </button>
          </div>
          {/* §3.1 — the top dashboard bar is now just the logo + LIVE chip,
              pushed right. Translate + language moved to Settings, the theme
              toggle moved to the sidebar footer, and notifications live on the
              home Notifications card + (soon) a sidebar item — so the header
              stays minimal and clean. Home-tab-only so it never leaks onto the
              Profile / Wallet / VTX sub-tabs (§4). */}
          <div className="flex-1" />
          {activeNav === 'home' && (
            <div className="flex items-center gap-2">
              <SteinzLogo size={34} animated={false} />
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[10px] text-gray-400 font-semibold tracking-wide">LIVE</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile responsive — the fixed header above is h-14 (56px), not
          80px. Hardcoded 80px on mobile created a 24px dead zone above
          the first content row. Use h-14 worth of padding on mobile,
          the original 80px on lg+ where the header has more chrome. */}
      <div className="pt-14 lg:pt-[80px] px-3 lg:px-6 max-w-7xl mx-auto">
        {showHomeTabs && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.06 }}
                >
                  <StatCard {...stat} />
                </motion.div>
              ))}
            </div>

            {/* Top Gainers (60%) + Heating Up (40%) — CoinGecko-grade market
                overview. Stacks single-column on mobile, splits on lg. */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-5">
              <div className="lg:col-span-3">
                <TopGainersCard />
              </div>
              <div className="lg:col-span-2">
                <HeatingUpCard />
              </div>
            </div>

            {/* Overview / Context Feed / Market tab toggle */}
            <div className="flex gap-1 p-1 bg-[#111827] border border-white/[0.06] rounded-xl mb-4">
              {([
                { id: 'overview', label: 'Overview' },
                { id: 'context', label: 'Context Feed' },
                { id: 'markets', label: 'Market' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#0066FF] text-white shadow-[0_0_12px_rgba(0,102,255,0.35)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}

        <TabErrorBoundary>
          <Suspense fallback={<TabSpinner />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeNav}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </TabErrorBoundary>
      </div>

      <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}
      {onboardedAt === null && <OnboardingGate profileOnboardedAt={onboardedAt} />}
    </div>
  );
}
