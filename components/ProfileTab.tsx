'use client';

import { useState, useEffect } from 'react';
import { User, Award, BarChart3, Bell, Shield, Settings, HelpCircle, LogOut, ChevronRight, Lock, Crown } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    if (stored) setWalletAddress(stored);
  }, []);

  const displayName = user?.email
    ? user.email.split('@')[0]
    : walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Guest User';

  const isConnected = !!user || !!walletAddress;

  const handleSignOut = async () => {
    await signOut();
    setWalletAddress(null);
    window.location.reload();
  };

  return (
    <div>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mb-3 border-2 border-white/10">
          <User className="w-10 h-10 text-[#00E5FF]" />
        </div>
        <h2 className="text-lg font-heading font-bold">{displayName}</h2>
        <p className="text-xs text-gray-400">
          {isConnected ? 'Free Tier' : 'Connect wallet to unlock features'}
        </p>
        {isConnected && (
          <a href="/dashboard/pricing" className="mt-2 px-4 py-1.5 bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/30 rounded-full text-xs text-[#FFD700] font-semibold hover:scale-105 transition-transform flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> Upgrade to Pro
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0</div>
          <div className="text-[10px] text-gray-400">Predictions</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0%</div>
          <div className="text-[10px] text-gray-400">Win Rate</div>
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          <div className="text-lg font-bold">0</div>
          <div className="text-[10px] text-gray-400">Points</div>
        </div>
      </div>

      {user?.email && (
        <div className="glass rounded-lg p-3 mb-4 border border-white/10">
          <div className="text-[10px] text-gray-500 mb-1">Email</div>
          <div className="text-xs text-gray-300">{user.email}</div>
        </div>
      )}

      {walletAddress && (
        <div className="glass rounded-lg p-3 mb-4 border border-white/10">
          <div className="text-[10px] text-gray-500 mb-1">Wallet</div>
          <div className="text-xs text-gray-300 font-mono">{walletAddress}</div>
        </div>
      )}

      <SectionLabel>Activity</SectionLabel>
      <ProfileRow icon={Award} label="Achievements" sub="Track your progress" />
      <ProfileRow icon={BarChart3} label="Analytics" sub="View your stats" />

      <SectionLabel>Settings</SectionLabel>
      <ProfileRow icon={Bell} label="Notifications" sub="Manage alerts" />
      <ProfileRow icon={Lock} label="Security" sub="Protect your account" />
      <ProfileRow icon={Settings} label="Preferences" sub="App settings" />

      <SectionLabel>Support</SectionLabel>
      <ProfileRow icon={HelpCircle} label="Help Center" sub="FAQs & support" />

      {isConnected && (
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-3 mt-2 text-[#EF4444] text-sm hover:bg-white/5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-semibold">Sign Out</span>
        </button>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{children}</span>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <button className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5">
      <Icon className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[10px] text-gray-500">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600" />
    </button>
  );
}
