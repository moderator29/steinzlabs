'use client';

import { useState, useEffect, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import { Home, Users, MessageSquare, Compass, Wallet, User, Menu, X, TrendingUp, TrendingDown, Activity, BarChart3, Zap, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import SidebarMenu from '@/components/SidebarMenu';
import PriceTicker from '@/components/PriceTicker';
import AuthModal from '@/components/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/hooks/useAuth';

const ContextFeed = lazy(() => import('@/components/ContextFeed'));
const Markets = lazy(() => import('@/components/Markets'));
const Predictions = lazy(() => import('@/components/Predictions'));
const SocialTab = lazy(() => import('@/components/SocialTab'));
const VtxAiTab = lazy(() => import('@/components/VtxAiTab'));
const DiscoverTab = lazy(() => import('@/components/DiscoverTab'));
const WalletTab = lazy(() => import('@/components/WalletTab'));
const ProfileTab = lazy(() => import('@/components/ProfileTab'));

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
    </div>
  );
}

class TabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-gray-400">Something went wrong loading this tab.</p>
          <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue-300 text-xs font-semibold hover:bg-neon-blue/20 transition-colors">
            Try Again
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
  return (
    <div className="bg-surface border border-white/[0.06] rounded-xl p-4 hover:border-neon-blue/20 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-neon-blue/[0.06] group-hover:bg-neon-blue/10 transition-colors">
          <Icon className="w-4 h-4 text-neon-blue-400" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
        }`}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
          {change}
        </div>
      </div>
      <div className="text-xl font-bold text-white font-mono tracking-tight">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{label}</div>
    </div>
  );
});

const BottomNav = memo(function BottomNav({ activeNav, onNavChange }: { activeNav: string; onNavChange: (id: string) => void }) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'social', icon: Users, label: 'Social' },
    { id: 'vtxai', icon: MessageSquare, label: 'VTX AI' },
    { id: 'discover', icon: Compass, label: 'Discover' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 w-full bg-[#0A0E1A]/95 backdrop-blur-xl border-t border-white/[0.06] z-50">
      <div className="grid grid-cols-6 gap-0 px-1 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 transition-colors ${
                isActive ? 'text-neon-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-neon-blue mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('context');
  const [activeNav, setActiveNav] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      setShowAuthModal(true);
    }
  }, [user, authLoading]);

  const showHomeTabs = activeNav === 'home';

  const handleNavChange = useCallback((id: string) => {
    setActiveNav(id);
    if (id === 'home') setActiveTab('context');
  }, []);

  const renderContent = () => {
    if (activeNav === 'home') {
      if (activeTab === 'context') return <ContextFeed />;
      if (activeTab === 'markets') return <Markets />;
      if (activeTab === 'predictions') return <Predictions />;
    }
    if (activeNav === 'social') return <SocialTab />;
    if (activeNav === 'vtxai') return <VtxAiTab />;
    if (activeNav === 'discover') return <DiscoverTab />;
    if (activeNav === 'wallet') return <WalletTab />;
    if (activeNav === 'profile') return <ProfileTab />;
    return null;
  };

  const stats = [
    { label: 'Total Market Cap', value: '$2.41T', change: '+2.4%', icon: BarChart3, trend: 'up' as const },
    { label: '24h Volume', value: '$89.2B', change: '+5.1%', icon: Activity, trend: 'up' as const },
    { label: 'BTC Dominance', value: '52.3%', change: '-0.3%', icon: TrendingDown, trend: 'down' as const },
    { label: 'Active Wallets', value: '1.2M', change: '+12%', icon: Zap, trend: 'up' as const },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="fixed top-0 w-full z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-gray-400" />}
            </button>
            <img src="/steinz-logo-128.png" alt="STEINZ" className="w-7 h-7 flex-shrink-0" style={{ objectFit: 'contain' }} />
            <span className="text-sm font-heading font-bold tracking-tight">STEINZ</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {showHomeTabs && (
        <div className="fixed top-14 w-full bg-[#0A0E1A]/90 backdrop-blur-sm border-b border-white/[0.06] z-30">
          <PriceTicker />
        </div>
      )}

      <div className={`${showHomeTabs ? 'pt-[104px]' : 'pt-[68px]'} px-3 lg:px-6 max-w-7xl mx-auto`}>
        {showHomeTabs && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>

            <div className="flex gap-1 mb-4 bg-surface border border-white/[0.06] p-1 rounded-xl max-w-md mx-auto">
              {['context', 'markets', 'predictions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-xs ${
                    activeTab === tab
                      ? 'bg-neon-blue text-white shadow-neon-sm'
                      : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {tab === 'context' ? 'Context Feed' : tab === 'markets' ? 'Markets' : 'Predictions'}
                </button>
              ))}
            </div>
          </>
        )}

        <TabErrorBoundary>
          <Suspense fallback={<TabSpinner />}>
            {renderContent()}
          </Suspense>
        </TabErrorBoundary>
      </div>

      <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />

      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
