'use client';

import { useState, useEffect, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Brand icon library — gradient-glowing platform icons. Missing specialty
// icons fall back to lucide-react (hybrid pattern used elsewhere on main).
import {
  Wallet, User, Menu, X, TrendingDown, Activity, ChartBar as BarChart3,
} from '@/components/icons/brand';
import {
  Home, MessageSquare, Zap, ArrowUpRight, ArrowDownRight, Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import SidebarMenu from '@/components/SidebarMenu';
import { OnboardingGate } from '@/components/onboarding/OnboardingFlow';

import { maybeNotifyWelcome } from '@/lib/notifications';
import SteinzLogo from '@/components/ui/SteinzLogo';
// CompactKpiBar removed — duplicated the 4 main KPI cards as a "ticker" strip
// above them. User feedback called it visual noise. The four full-size KPI
// cards rendered below already cover Total Market Cap / 24h Volume / BTC
// Dominance / Chains Tracked.
import { PersonalizedHome } from '@/components/dashboard/PersonalizedHome';
import { TopGainersCard } from '@/components/dashboard/TopGainersCard';
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
      <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
    </div>
  );
}

class TabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(_: any, prev: { hasError: boolean }) {
    // Auto-reset after 800ms so user never sees the error state flash
    if (!prev.hasError && this.state.hasError) {
      this.resetTimer = setTimeout(() => this.setState({ hasError: false }), 800);
    }
  }
  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
  render() {
    if (this.state.hasError) {
      // Show spinner instead of error - auto-resets in 800ms
      return (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
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
    <div className="fixed bottom-4 left-4 right-4 z-[var(--z-sidebar)] flex justify-center pointer-events-none">
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

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const showHomeTabs = activeNav === 'home';

  const renderContent = () => {
    if (activeNav === 'home') {
      if (activeTab === 'markets') return <MarketDashboard />;
      if (activeTab === 'context') return <ContextFeed />;
      return <PersonalizedHome />;
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
    <div className="min-h-screen text-white pb-20">
      <FirstRunTour />
      <div className="fixed top-0 w-full z-40/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-gray-400" />}
            </button>
            <SteinzLogo size={28} animated={false} />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[10px] text-gray-400 font-semibold tracking-wide">LIVE</span>
            </div>
          </div>
          {/* Header is intentionally minimal — logo + LIVE pill only. The
              search box is on the Market page; the language switcher lives
              under Profile → Preferences (not next to the bell). */}
          <div className="flex-1" />
        </div>
      </div>

      <div className="pt-[80px] px-3 lg:px-6 max-w-7xl mx-auto">
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
                      ? 'bg-[#0A1EFF] text-white shadow-[0_0_12px_rgba(10,30,255,0.35)]'
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
