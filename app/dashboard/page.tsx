'use client';

import { useState, useEffect, Suspense, lazy, memo, useCallback, Component, ReactNode } from 'react';
import { Home, Users, MessageSquare, Compass, Wallet, User, Menu, X } from 'lucide-react';
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
      <div className="w-6 h-6 border-2 border-[#232637] border-t-[#00D4AA] rounded-full animate-spin" />
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
          <p className="text-sm text-[#9CA3AF]">Something went wrong loading this tab.</p>
          <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 rounded-lg bg-[#161822] border border-[#232637] text-[#F9FAFB] text-xs font-medium hover:bg-[#1C1F2E] transition-colors">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <div className="fixed bottom-0 w-full bg-[#0B0D14]/95 backdrop-blur-lg border-t border-[#232637] z-50">
      <div className="grid grid-cols-6 gap-0 px-1 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 transition-colors bottom-nav-item ${
                isActive ? 'text-[#00D4AA] active' : 'text-[#6B7280]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
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

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="fixed top-0 w-full z-40 bg-[#0B0D14]/95 backdrop-blur-lg border-b border-[#232637]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <img src="/naka-logo.svg" alt="NAKA" className="w-7 h-7 flex-shrink-0" style={{ objectFit: 'contain' }} />
            <span className="text-sm font-bold tracking-tight">NAKA</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {showHomeTabs && (
        <div className="fixed top-14 w-full bg-[#0B0D14]/95 backdrop-blur-lg border-b border-[#232637] z-30">
          <PriceTicker />
        </div>
      )}

      <div className={`${showHomeTabs ? 'pt-[104px]' : 'pt-[68px]'} px-3`}>
        {showHomeTabs && (
          <div className="flex gap-1 mb-4 bg-[#161822] p-1 rounded-lg max-w-sm mx-auto border border-[#232637]">
            {['context', 'markets', 'predictions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 rounded-md font-medium transition-all text-xs ${
                  activeTab === tab
                    ? 'bg-[#F9FAFB] text-[#0B0D14]'
                    : 'text-[#9CA3AF] hover:text-[#F9FAFB]'
                }`}
              >
                {tab === 'context' ? 'Context Feed' : tab === 'markets' ? 'Markets' : 'Predictions'}
              </button>
            ))}
          </div>
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
