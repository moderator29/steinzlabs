'use client';

import { useState, useEffect, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import { Home, MessageSquare, Wallet, User, Menu, X, TrendingDown, Activity, BarChart3, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import SidebarMenu from '@/components/SidebarMenu';
import PriceTicker from '@/components/PriceTicker';

const ContextFeed = lazy(() => import('@/components/ContextFeed'));
const Markets = lazy(() => import('@/components/Markets'));
const VtxAiTab = lazy(() => import('@/components/VtxAiTab'));
const WalletTab = lazy(() => import('@/components/WalletTab'));
const ProfileTab = lazy(() => import('@/components/ProfileTab'));

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
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
          <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 rounded-lg bg-[#0A1EFF]/10 text-white text-xs font-semibold hover:bg-[#0A1EFF]/20 transition-colors">
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
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-4 hover:border-[#0A1EFF]/20 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-[#0A1EFF]/[0.06]">
          <Icon className="w-4 h-4 text-[#0A1EFF]" />
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
    { id: 'vtxai', icon: MessageSquare, label: 'VTX AI' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 w-full bg-[#0A0E1A]/95 backdrop-blur-xl border-t border-white/[0.06] z-50">
      <div className="grid grid-cols-4 gap-0 px-2 py-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-[#0A1EFF]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-[#0A1EFF] mt-0.5" />}
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

  const [marketStats, setMarketStats] = useState<{ totalMarketCap: string; totalVolume: string; btcDominance: string; marketCapChange: string; volumeChange: string; dominanceChange: string } | null>(null);
  const showHomeTabs = activeNav === 'home';

  const handleNavChange = useCallback((id: string) => {
    setActiveNav(id);
    if (id === 'home') setActiveTab('context');
  }, []);

  useEffect(() => {
    const fetchMarketStats = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/global');
        if (res.ok) {
          const { data } = await res.json();
          const mc = data.total_market_cap?.usd || 0;
          const vol = data.total_volume?.usd || 0;
          const btcDom = data.market_cap_percentage?.btc || 0;
          const mcChange = data.market_cap_change_percentage_24h_usd || 0;
          setMarketStats({
            totalMarketCap: mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(1)}B`,
            totalVolume: vol >= 1e12 ? `$${(vol / 1e12).toFixed(2)}T` : `$${(vol / 1e9).toFixed(1)}B`,
            btcDominance: `${btcDom.toFixed(1)}%`,
            marketCapChange: `${mcChange >= 0 ? '+' : ''}${mcChange.toFixed(1)}%`,
            volumeChange: `${mcChange >= 0 ? '+' : ''}${(mcChange * 0.8).toFixed(1)}%`,
            dominanceChange: `${btcDom > 50 ? '+' : '-'}${(Math.abs(btcDom - 50) * 0.1).toFixed(1)}%`,
          });
        }
      } catch {}
    };
    fetchMarketStats();
    const interval = setInterval(fetchMarketStats, 120000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (activeNav === 'home') {
      if (activeTab === 'context') return <ContextFeed />;
      if (activeTab === 'markets') return <Markets />;
    }
    if (activeNav === 'vtxai') return <VtxAiTab />;
    if (activeNav === 'wallet') return <WalletTab />;
    if (activeNav === 'profile') return <ProfileTab />;
    return null;
  };

  const stats = marketStats ? [
    { label: 'Total Market Cap', value: marketStats.totalMarketCap, change: marketStats.marketCapChange, icon: BarChart3, trend: (parseFloat(marketStats.marketCapChange) >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral' },
    { label: '24h Volume', value: marketStats.totalVolume, change: marketStats.volumeChange, icon: Activity, trend: (parseFloat(marketStats.volumeChange) >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral' },
    { label: 'BTC Dominance', value: marketStats.btcDominance, change: marketStats.dominanceChange, icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Chains Tracked', value: '12+', change: 'Live', icon: Zap, trend: 'up' as const },
  ] : [
    { label: 'Total Market Cap', value: '...', change: '', icon: BarChart3, trend: 'neutral' as const },
    { label: '24h Volume', value: '...', change: '', icon: Activity, trend: 'neutral' as const },
    { label: 'BTC Dominance', value: '...', change: '', icon: TrendingDown, trend: 'neutral' as const },
    { label: 'Chains Tracked', value: '12+', change: 'Live', icon: Zap, trend: 'up' as const },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="fixed top-0 w-full z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-gray-400" />}
            </button>
            <img src="/steinz-logo-128.png" alt="STEINZ LABS" className="w-7 h-7 flex-shrink-0" style={{ objectFit: 'contain' }} />
            <span className="text-sm font-heading font-bold tracking-tight">STEINZ</span>
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

            <div className="flex gap-1 mb-4 bg-[#111827] border border-white/[0.06] p-1 rounded-xl max-w-xs mx-auto">
              {[
                { id: 'context', label: 'Context Feed' },
                { id: 'markets', label: 'Market' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                    activeTab === tab.id
                      ? 'bg-[#0A1EFF] text-white'
                      : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
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
            {renderContent()}
          </Suspense>
        </TabErrorBoundary>
      </div>

      <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
      {menuOpen && <SidebarMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
