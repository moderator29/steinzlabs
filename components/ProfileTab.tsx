'use client';

import { useState, useEffect } from 'react';
import { User, Award, BarChart3, Bell, Shield, Settings, HelpCircle, LogOut, ChevronRight, Lock, Crown, Dna, PieChart, Mail, Wallet, Calendar, Copy, Check, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState({
    whaleAlerts: true,
    priceAlerts: true,
    securityAlerts: true,
    newsletter: false,
  });

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

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Not signed in';

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem('wallet_address');
    setWalletAddress(null);
    window.location.reload();
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mb-3 border-2 border-white/10">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-[#00E5FF]" />
          )}
        </div>
        <h2 className="text-lg font-heading font-bold">{displayName}</h2>
        <p className="text-xs text-gray-400">
          {isConnected ? 'Free Tier' : 'Sign in to unlock features'}
        </p>
        {isConnected && (
          <button
            onClick={() => router.push('/dashboard/pricing')}
            className="mt-2 px-4 py-1.5 bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/30 rounded-full text-xs text-[#FFD700] font-semibold hover:scale-105 transition-transform flex items-center gap-1.5"
          >
            <Crown className="w-3 h-3" /> Upgrade to Pro
          </button>
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
        <div className="glass rounded-lg p-3 mb-3 border border-white/10">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#00E5FF]" />
            <div className="flex-1">
              <div className="text-[10px] text-gray-500">Email</div>
              <div className="text-xs text-gray-300">{user.email}</div>
            </div>
            <Check className="w-3 h-3 text-[#10B981]" />
          </div>
        </div>
      )}

      {walletAddress && (
        <div className="glass rounded-lg p-3 mb-3 border border-white/10">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#7C3AED]" />
            <div className="flex-1">
              <div className="text-[10px] text-gray-500">Wallet</div>
              <div className="text-xs text-gray-300 font-mono">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</div>
            </div>
            <button onClick={copyAddress} className="hover:bg-white/10 p-1.5 rounded transition-colors">
              {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="glass rounded-lg p-3 mb-4 border border-white/10">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-[10px] text-gray-500">Member Since</div>
              <div className="text-xs text-gray-300">{joinedDate}</div>
            </div>
          </div>
        </div>
      )}

      <SectionLabel>Quick Actions</SectionLabel>
      <ProfileRow icon={PieChart} label="Portfolio" sub="View your holdings & P&L" onClick={() => router.push('/dashboard/portfolio')} />
      <ProfileRow icon={Dna} label="Trading DNA" sub="AI analysis of your trading" onClick={() => router.push('/dashboard/dna-analyzer')} />
      <ProfileRow icon={BarChart3} label="Analytics" sub="View your stats" onClick={() => router.push('/dashboard/trends')} />

      <SectionLabel>Settings</SectionLabel>
      <div className="glass rounded-lg border border-white/10 mb-2 overflow-hidden">
        {Object.entries(notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between px-3 py-3 border-b border-white/5 last:border-0">
            <div>
              <div className="text-sm font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div className="text-[10px] text-gray-500">
                {key === 'whaleAlerts' ? 'Get notified on large transfers' :
                 key === 'priceAlerts' ? 'Price movement notifications' :
                 key === 'securityAlerts' ? 'Rug pull & scam warnings' :
                 'Weekly market digest'}
              </div>
            </div>
            <button
              onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
              className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[#00E5FF]' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      <ProfileRow icon={Lock} label="Security" sub="Protect your account" onClick={() => router.push('/dashboard/security')} />
      <ProfileRow icon={Shield} label="Privacy" sub="Manage data & visibility" />

      <SectionLabel>Support</SectionLabel>
      <ProfileRow icon={HelpCircle} label="Help Center" sub="FAQs & support" />

      {walletAddress && (
        <a
          href={`https://etherscan.io/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-400"
        >
          <ExternalLink className="w-4 h-4 text-[#00E5FF]" />
          <span>View on Etherscan</span>
          <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
        </a>
      )}

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

function ProfileRow({ icon: Icon, label, sub, onClick }: { icon: React.ElementType; label: string; sub: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5"
    >
      <Icon className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[10px] text-gray-500">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600" />
    </button>
  );
}
