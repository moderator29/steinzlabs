'use client';

import { useState, useEffect, useRef, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import type { GiftSuccessData } from '@/components/wire/GiftSuccessCard';
import { motion, AnimatePresence } from 'framer-motion';
// Brand icon library — gradient-glowing platform icons. Missing specialty
// icons fall back to lucide-react (hybrid pattern used elsewhere on main).
import {
  Wallet, User,
  Home, MessageSquare, Search, Menu, X,
  LayoutGrid, Rss, Radio, Newspaper, CandlestickChart, Coins, Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFeatureUsageLog } from '@/lib/hooks/useFeatureUsageLog';
import SidebarMenu from '@/components/SidebarMenu';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { dashboardHowItWorks } from '@/lib/howItWorks/content/dashboard';
import { feedHowItWorks } from '@/lib/howItWorks/content/feed';
import { newsHowItWorks } from '@/lib/howItWorks/content/news';
import { rwaHowItWorks } from '@/lib/howItWorks/content/rwa';
import { marketHowItWorks } from '@/lib/howItWorks/content/market';
import { predictionHowItWorks } from '@/lib/howItWorks/content/prediction';
import type { HowItWorksContent } from '@/lib/howItWorks/types';
import { OnboardingGate } from '@/components/onboarding/OnboardingFlow';

import { maybeNotifyWelcome } from '@/lib/notifications';
import SteinzLogo from '@/components/ui/SteinzLogo';
// CompactKpiBar removed — duplicated the 4 main KPI cards as a "ticker" strip
// above them. User feedback called it visual noise. The four full-size KPI
// cards rendered below already cover Total Market Cap / 24h Volume / BTC
// Dominance / Chains Tracked.
import { RenderWidgets } from '@/components/dashboard/RenderWidgets';
import { DailyPulseSummary } from '@/components/dashboard/DailyPulseSummary';
import { ShippedBanner } from '@/components/dashboard/ShippedBanner';
import { FirstRunTour } from '@/components/dashboard/FirstRunTour';

const ContextFeed    = lazy(() => import('@/components/ContextFeed'));
// The single canonical CRYPTO markets front — the SAME component renders at
// /dashboard/market so the two surfaces can never drift. Owns the market
// stat strip, heatmap, Top Gainers + Heating Up, sectors, and the crypto
// token table. The stocks/RWA board moved to its own Stocks sub-tab below.
const MarketsView = lazy(() => import('@/components/market/MarketsView'));
// The Stocks sub-tab — wraps the real RWA / TradFi board carved out of
// MarketsView, keeping equities/RWA separate from the crypto Market view.
const StocksBoard = lazy(() => import('@/components/dashboard/StocksBoard'));
const WalletTab   = lazy(() => import('@/components/WalletTab'));
const ProfileTab  = lazy(() => import('@/components/ProfileTab'));
// New home sub-tab surfaces. These live at exact agreed paths and are owned
// by sibling agents; the lead resolves any missing module at integration time.
const WireTab  = lazy(() => import('@/components/wire/WireTab'));
// The Wire gift flow (non-custodial). Lazy so the wallet-signing deps only load
// when a user actually opens the gift sheet.
const GiftSheet = lazy(() => import('@/components/wire/GiftSheet').then(m => ({ default: m.GiftSheet })));
const GiftSuccessCard = lazy(() => import('@/components/wire/GiftSuccessCard').then(m => ({ default: m.GiftSuccessCard })));
const NewsTab  = lazy(() => import('@/components/news/NewsTab'));
// Prediction sub-tab — Naka Predict Breaking-Live game (free Naka Points).
const LivePredict = lazy(() => import('@/components/predict/LivePredict'));
// Secondary "World Events" board — real Polymarket (keyless Gamma API) markets.
const PredictionBoard = lazy(() => import('@/components/prediction/PredictionBoard'));

// Sub-tab ordering + typing for the home feed. Kept as a const tuple so the
// union type, the deep-link parser and the tab-bar UI can never drift apart.
const HOME_SUBTABS = ['overview', 'wire', 'context', 'news', 'stocks', 'markets', 'prediction'] as const;
type HomeSubtab = (typeof HOME_SUBTABS)[number];
function isHomeSubtab(v: unknown): v is HomeSubtab {
  return typeof v === 'string' && (HOME_SUBTABS as readonly string[]).includes(v);
}

// Display metadata for the segmented home nav. `id` stays the internal union
// value (never rename — deep-links + localStorage key off it); `label` is the
// visible copy. Order mirrors HOME_SUBTABS so the union, deep-link parser and
// the nav can never drift. Flat lucide icons throughout.
const HOME_TABS: { id: HomeSubtab; label: string; Icon: LucideIcon }[] = [
  { id: 'overview',   label: 'Overview',     Icon: LayoutGrid },
  { id: 'wire',       label: 'The Wire',     Icon: Rss },
  { id: 'context',    label: 'Context Feed', Icon: Radio },
  { id: 'news',       label: 'News',         Icon: Newspaper },
  { id: 'stocks',     label: 'Stocks',       Icon: CandlestickChart },
  { id: 'markets',    label: 'Market',       Icon: Coins },
  { id: 'prediction', label: 'Prediction',   Icon: Target },
];

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

// Overview hero — a calm, branded greeting surface that opens the redesigned
// home Overview. Purely presentational: a time-aware greeting, the user's
// name, and a soft aurora glass panel. No data fetching of its own.
const OverviewHero = memo(function OverviewHero({ name }: { name: string }) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden nl-glass rounded-2xl px-5 py-6 sm:px-7 sm:py-8 mb-5"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.28), 0 0 30px rgba(0,102,255,.14)' }}
    >
      {/* aurora bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(30,144,255,.5) 0%, rgba(18,51,174,0) 70%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#9FD0FF] bg-[#0066FF]/[0.14] border border-[#0066FF]/25 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            LIVE MARKETS
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {greeting}{name ? ', ' : ''}
          {name && (
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #6FB4FF 0%, #1E90FF 60%, #0066FF 100%)' }}
            >
              {name}
            </span>
          )}
        </h1>
        <p className="text-sm text-[#B4C0E0] mt-1.5 max-w-md">
          Here is what is moving across your signals, feeds and markets today.
        </p>
      </div>
    </motion.div>
  );
});

// A clean single-row header for a sub-tab: the section title on the left and
// its in-app "How it works" (?) button on the right. One row, no overlap, clear
// bottom spacing so it never collides with the content below. `content` is
// optional — surfaces without dedicated help copy (e.g. Context Feed) render
// the title alone rather than a dead button.
function SubTabHelpHeader({ label, content }: { label: string; content?: HowItWorksContent }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-base font-semibold text-white tracking-tight">{label}</h2>
      {content ? <HowItWorksButton content={content} iconOnly /> : null}
    </div>
  );
}

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

  // The inline VtxAiTab surface silently dropped the server-built token/swap
  // cards; the dedicated /dashboard/vtx-ai page renders them (plus proof)
  // correctly and is the single source of truth. Any ?tab=vtxai entry point
  // now forwards there instead of mounting the stale tab.
  useEffect(() => {
    if (activeNav === 'vtxai') router.replace('/dashboard/vtx-ai');
  }, [activeNav, router]);
  // ?subtab=overview|wire|context|news|stocks|markets|prediction restores the
  // home sub-tab — used by the side-nav links (/dashboard?subtab=wire etc.) and
  // by /dashboard/proof's "Back to Feed" button (§6.3). Any unknown value falls
  // back to the Overview tab.
  const initialSubtab: HomeSubtab = (() => {
    const s = searchParams?.get('subtab');
    return isHomeSubtab(s) ? s : 'overview';
  })();
  const [activeTab, setActiveTab] = useState<HomeSubtab>(initialSubtab);

  // Bug §subtab-nav — the side-nav links to /dashboard?subtab=wire etc., but
  // when the user was ALREADY on /dashboard the sub-tab never switched: the
  // initial state above only reads searchParams once at mount. Watch the live
  // ?subtab value and drive setActiveTab whenever it changes to a valid tab, so
  // clicking a nav link switches the surface in place. (A local tab click also
  // updates the URL nowhere, so this only fires on real deep-link changes.)
  const subtabParam = searchParams?.get('subtab');
  useEffect(() => {
    if (isHomeSubtab(subtabParam)) {
      setActiveTab((prev) => (prev === subtabParam ? prev : subtabParam));
    }
  }, [subtabParam]);

  // Restore last sub-tab when navigating back from a coin detail page (which
  // stashes 'steinz_last_tab' before routing away). Accepts any of the seven
  // valid sub-tabs, not just markets, so future deep entries keep working.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('steinz_last_tab');
      if (isHomeSubtab(saved)) {
        localStorage.removeItem('steinz_last_tab');
        setActiveTab(saved);
      }
    } catch {
      // Malformed JSON — return default
    }
  }, []);

  // Segmented home-nav: the active indicator is a single glass pill that slides
  // between tabs. Rather than hard-code widths (tabs are variable-width + the
  // strip scrolls on mobile) we measure the active button and drive the pill's
  // transform off its live offsetLeft / offsetWidth. Re-measures on tab change
  // and on resize; also nudges the active tab into view on narrow screens.
  const homeNavRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<HomeSubtab, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  useEffect(() => {
    if (activeNav !== 'home') return;
    const measure = () => {
      const el = tabRefs.current[activeTab];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const el = tabRefs.current[activeTab];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab, activeNav]);

  const [menuOpen, setMenuOpen] = useState(false);
  // The Wire → Gift: the wire card's Gift button sets the target (recipient +
  // the wire being gifted on); GiftSheet handles the non-custodial transfer and
  // GiftSuccessCard shows the congrats card on success.
  const [giftTarget, setGiftTarget] = useState<{
    recipient: { id: string; username: string; display_name?: string | null; avatar_url?: string | null };
    postId?: string | null;
  } | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<GiftSuccessData | null>(null);

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
      maybeNotifyWelcome(user.email, user.created_at);
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

  // The global market-stats strip now lives inside MarketsView (rendered on
  // the Markets sub-tab + /dashboard/market), so the dashboard shell no longer
  // fetches market globals itself.

  if (authLoading) {
    return <DashboardAuthLoadingGate />;
  }

  if (!user) return null;

  const showHomeTabs = activeNav === 'home';

  const heroName = user.first_name || user.username || (user.email ? user.email.split('@')[0] : '');

  const renderContent = () => {
    if (activeNav === 'home') {
      if (activeTab === 'markets') {
        return (
          <div className="space-y-5">
            <SubTabHelpHeader label="Market" content={marketHowItWorks} />
            {/* Single canonical CRYPTO markets front — the SAME MarketsView
                renders at /dashboard/market. Owns the market stat strip,
                heatmap, Top Gainers + Heating Up, sectors, and the crypto token
                table. Stocks/RWA now live on the Stocks tab below. */}
            <MarketsView />
          </div>
        );
      }
      if (activeTab === 'stocks') {
        return (
          <div className="space-y-5">
            <SubTabHelpHeader label="Stocks" content={rwaHowItWorks} />
            {/* Stocks / RWA board — split out of MarketsView so equities and
                crypto no longer compete on one screen. */}
            <StocksBoard />
          </div>
        );
      }
      if (activeTab === 'context') return (
        <div className="space-y-5">
          <SubTabHelpHeader label="Context Feed" />
          <ContextFeed />
        </div>
      );
      if (activeTab === 'wire') return (
        <div className="space-y-3">
          <SubTabHelpHeader label="The Wire" content={feedHowItWorks} />
        <WireTab
          onGift={(post) => {
            // A repost forwards the ORIGINAL wire, so post.author is the wallet
            // that should receive the gift. Need a real username to target.
            const a = post.author;
            if (a?.id && a.username) {
              setGiftTarget({
                recipient: { id: a.id, username: a.username, display_name: a.display_name, avatar_url: a.avatar_url },
                postId: post.id,
              });
            }
          }}
        />
        </div>
      );
      if (activeTab === 'news') return (
        <div className="space-y-3">
          <SubTabHelpHeader label="News" content={newsHowItWorks} />
          <NewsTab />
        </div>
      );
      if (activeTab === 'prediction') return (
        <div className="space-y-6">
          <SubTabHelpHeader label="Prediction" content={predictionHowItWorks} />
          <LivePredict />
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-white">World Events</h3>
              <span className="text-[11px] text-gray-500">Live odds from Polymarket</span>
            </div>
            <PredictionBoard />
          </div>
        </div>
      );
      return (
        // OV3: widget order honours the user's saved preference from
        // /api/dashboard/widgets. Each widget retains its own self-hide
        // logic (PortfolioHeroCard returns null for no-wallets users,
        // SinceLastLoginDigest hides on first-ever visit, etc.) so the
        // dashboard stays clean for fresh accounts. The redesigned Overview
        // opens with ONE greeting (OverviewHero) — the old PersonalizedHome
        // widget that carried a duplicate "Welcome, {name}" greeting AND the
        // "What are you trading today? / Ask VTX anything…" preview was dropped
        // from the widget registry. The DailyPulseSummary below fills the old
        // empty "what's moving" area with a real 24h whale/watchlist summary.
        <>
          <ShippedBanner />
          <OverviewHero name={heroName} />
          <DailyPulseSummary />
          <RenderWidgets />
        </>
      );
    }
    if (activeNav === 'vtxai') return null; // redirects to /dashboard/vtx-ai (see effect above)
    if (activeNav === 'wallet') return <WalletTab />;
    if (activeNav === 'profile') return <ProfileTab />;
    return null;
  };

  return (
    // overflow-x-clip — hard stop against side-to-side drift on mobile. Any wide
    // child (the sub-tab pill row, a market table) must scroll inside its OWN
    // overflow-x-auto container; the page body itself never scrolls sideways.
    // `clip` (not `hidden`) so it doesn't establish a vertical scroll container
    // that would break position:sticky descendants.
    <div className="min-h-screen text-white pb-28 sm:pb-24 overflow-x-clip">
      {/* Only run the lightweight tour AFTER the full onboarding flow is done
          (onboardedAt is a real date). Previously both the 10-card
          OnboardingGate and this 3-step tour mounted at z-[200] for a
          brand-new user, stacking two overlays on the same screen. */}
      {!!onboardedAt && <FirstRunTour />}
      {/* iOS safe-area — naka-safe-top adds env(safe-area-inset-top) so
          the header clears the iPhone 14+ dynamic island / notch instead
          of being overlapped by it. No-op on Android / web. */}
      <div className="fixed top-0 w-full z-40/95 backdrop-blur-xl border-b border-white/[0.06] naka-safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setMenuOpen(!menuOpen)} className="-ms-1 p-1 text-white/80 hover:text-white transition-colors" aria-label="Open menu">
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
              <HowItWorksButton content={dashboardHowItWorks} iconOnly className="ms-0.5" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile responsive — the fixed header above is h-14 (56px), not
          80px. Hardcoded 80px on mobile created a 24px dead zone above
          the first content row. Use h-14 worth of padding on mobile,
          the original 80px on lg+ where the header has more chrome. */}
      <div className="pt-14 lg:pt-[80px] px-3 lg:px-6 max-w-7xl mx-auto w-full min-w-0 overflow-x-clip">
        {showHomeTabs && (
          <>
            {/* Home segmented nav — prime top slot, first thing under the
                header (the old market-stats bar lived here; it moved into the
                Market tab). A single nl-glass pill holds all seven surfaces with
                one brand-blue glass indicator that slides between them (its
                left/width is measured off the active button, see the effect
                above). The pill row scrolls inside its OWN overflow-x-auto
                container on mobile so all seven fit without wrapping and without
                pushing the page sideways. Data logic + render switch untouched. */}
            <div
              ref={homeNavRef}
              className="relative flex items-center gap-0.5 p-1 nl-glass rounded-full mb-5 overflow-x-auto no-scrollbar"
              style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25), 0 0 24px rgba(0,102,255,.14), inset 0 1px 0 rgba(255,255,255,.06)' }}
              role="tablist"
              aria-label="Home views"
            >
              {/* Sliding active indicator — a brand-blue glass pill. Absolutely
                  positioned; transform + width animate so it glides between
                  tabs. Sits behind the labels (z-0). */}
              <div
                aria-hidden
                className="pointer-events-none absolute top-1 bottom-1 left-0 z-0 rounded-full will-change-transform"
                style={{
                  transform: `translateX(${pill.left}px)`,
                  width: pill.width ? `${pill.width}px` : 0,
                  opacity: pill.width ? 1 : 0,
                  transition: 'transform .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1), opacity .2s ease',
                  background: 'linear-gradient(135deg, #1E90FF 0%, #0066FF 55%, #1233AE 100%)',
                  boxShadow: '0 0 20px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.25)',
                }}
              />
              {HOME_TABS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    ref={(el) => { tabRefs.current[id] = el; }}
                    onClick={() => setActiveTab(id)}
                    role="tab"
                    aria-selected={isActive}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
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
                className="min-w-0"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </TabErrorBoundary>
      </div>

      <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}
      {giftTarget && (
        <Suspense fallback={null}>
          <GiftSheet
            recipient={giftTarget.recipient}
            postId={giftTarget.postId}
            onClose={() => setGiftTarget(null)}
            onSuccess={(data) => { setGiftTarget(null); setGiftSuccess(data); }}
          />
        </Suspense>
      )}
      {giftSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGiftSuccess(null)} />
          <div className="relative">
            <Suspense fallback={null}>
              <GiftSuccessCard data={giftSuccess} onClose={() => setGiftSuccess(null)} />
            </Suspense>
          </div>
        </div>
      )}
      {onboardedAt === null && <OnboardingGate profileOnboardedAt={onboardedAt} />}
    </div>
  );
}
