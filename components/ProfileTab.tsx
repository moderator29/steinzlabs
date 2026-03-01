'use client';

import { useState, useEffect } from 'react';
import { User, Award, BarChart3, Bell, Shield, Settings, HelpCircle, LogOut, ChevronRight, Lock, Crown, Dna, PieChart, Mail, Wallet, Calendar, Copy, Check, ExternalLink, Globe, Eye, EyeOff, Smartphone, Key, FileText, MessageCircle, ChevronDown, ArrowLeft, TrendingUp, AlertTriangle, Target, Flame, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWallet } from '@/lib/hooks/useWallet';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: 'whale' | 'price' | 'prediction' | 'trending' | 'security';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const defaultNotifications: Notification[] = [];

type SubPage = null | 'privacy' | 'help' | 'preferences';

export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const { address: walletAddress, disconnect: disconnectWallet } = useWallet();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [notifList, setNotifList] = useState<Notification[]>(defaultNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      try {
        setNotifLoading(true);
        const res = await fetch('/api/notifications');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.notifications)) {
          const readIds = JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]');
          const mapped = data.notifications.map((n: Notification) => ({
            ...n,
            read: readIds.includes(n.id),
          }));
          setNotifList(mapped);
        }
      } catch {
        if (!cancelled) {
          setNotifList([]);
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 120000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const unreadCount = notifList.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifList(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      const readIds = updated.filter(n => n.read).map(n => n.id);
      localStorage.setItem('steinz_read_notifs', JSON.stringify(readIds));
      return updated;
    });
  };

  const markAllRead = () => {
    setNotifList(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      const readIds = updated.map(n => n.id);
      localStorage.setItem('steinz_read_notifs', JSON.stringify(readIds));
      return updated;
    });
  };

  const getNotifIcon = (type: Notification['type']) => {
    switch (type) {
      case 'whale': return <AlertTriangle className="w-4 h-4 text-[#00E5FF]" />;
      case 'price': return <TrendingUp className="w-4 h-4 text-[#10B981]" />;
      case 'prediction': return <Target className="w-4 h-4 text-[#F59E0B]" />;
      case 'trending': return <Flame className="w-4 h-4 text-[#EF4444]" />;
      case 'security': return <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
    }
  };
  const [notifications, setNotifications] = useState({
    whaleAlerts: true,
    priceAlerts: true,
    securityAlerts: true,
    newsletter: false,
  });

  const [privacySettings, setPrivacySettings] = useState({
    showWallet: true,
    showActivity: true,
    showPredictions: true,
    allowDMs: true,
    publicProfile: false,
  });

  const [preferences, setPreferences] = useState({
    defaultChain: 'ethereum',
    currency: 'usd',
    language: 'en',
    compactMode: false,
    autoRefresh: true,
    soundAlerts: false,
  });

  useEffect(() => {
    const savedNotifs = localStorage.getItem('steinz_notifications');
    if (savedNotifs) {
      try { setNotifications(JSON.parse(savedNotifs)); } catch {}
    }
    const savedPrivacy = localStorage.getItem('steinz_privacy');
    if (savedPrivacy) {
      try { setPrivacySettings(JSON.parse(savedPrivacy)); } catch {}
    }
    const savedPrefs = localStorage.getItem('steinz_preferences');
    if (savedPrefs) {
      try { setPreferences(JSON.parse(savedPrefs)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('steinz_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('steinz_privacy', JSON.stringify(privacySettings));
  }, [privacySettings]);

  useEffect(() => {
    localStorage.setItem('steinz_preferences', JSON.stringify(preferences));
  }, [preferences]);

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
    disconnectWallet();
    window.location.reload();
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (subPage === 'privacy') {
    return (
      <div>
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h2 className="text-lg font-heading font-bold mb-1">Privacy Settings</h2>
        <p className="text-xs text-gray-500 mb-4">Control what others can see about you.</p>

        <div className="glass rounded-lg border border-white/10 overflow-hidden">
          {Object.entries(privacySettings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between px-3 py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                {key === 'showWallet' ? <Wallet className="w-4 h-4 text-[#7C3AED]" /> :
                 key === 'showActivity' ? <BarChart3 className="w-4 h-4 text-[#00E5FF]" /> :
                 key === 'showPredictions' ? <Award className="w-4 h-4 text-[#F59E0B]" /> :
                 key === 'allowDMs' ? <MessageCircle className="w-4 h-4 text-[#10B981]" /> :
                 <Globe className="w-4 h-4 text-[#EF4444]" />}
                <div>
                  <div className="text-sm font-semibold">
                    {key === 'showWallet' ? 'Show Wallet Address' :
                     key === 'showActivity' ? 'Show Trading Activity' :
                     key === 'showPredictions' ? 'Show Predictions' :
                     key === 'allowDMs' ? 'Allow Direct Messages' :
                     'Public Profile'}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {key === 'showWallet' ? 'Display your wallet address on profile' :
                     key === 'showActivity' ? 'Let others see your trading history' :
                     key === 'showPredictions' ? 'Share your prediction win rate' :
                     key === 'allowDMs' ? 'Allow other users to message you' :
                     'Make your profile discoverable'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPrivacySettings(prev => ({ ...prev, [key]: !value }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[#00E5FF]' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 glass rounded-lg p-3 border border-[#F59E0B]/20 bg-[#F59E0B]/5">
          <p className="text-[11px] text-[#F59E0B]">Your privacy settings are stored locally and applied immediately. We never share your personal data with third parties.</p>
        </div>
      </div>
    );
  }

  if (subPage === 'help') {
    const faqs = [
      { q: 'How do I connect my wallet?', a: 'Go to the Wallet tab in the bottom navigation and click "Connect Wallet". We support MetaMask, WalletConnect, and Phantom for Solana.' },
      { q: 'What is a Trust Score?', a: 'Trust Score is a 0-100 rating STEINZ assigns to every on-chain event, token, and wallet. It considers contract verification, liquidity, holder distribution, developer history, and more.' },
      { q: 'How does VTX AI work?', a: 'VTX AI is powered by Anthropic Claude. It analyzes real-time on-chain data, market trends, and your portfolio to give you actionable intelligence in plain English.' },
      { q: 'Is my wallet data safe?', a: 'Yes. STEINZ is 100% non-custodial. We only READ public blockchain data. Your private keys never leave your wallet. We cannot move your funds.' },
      { q: 'How do I cancel my subscription?', a: 'Go to Profile > Settings and click "Manage Subscription". You can cancel anytime with one click. No hidden fees or contracts.' },
      { q: 'What chains are supported?', a: 'Ethereum, Solana, BNB Chain, Polygon, Arbitrum, Optimism, Avalanche, Base, Fantom, Bitcoin, and Tron. More coming based on demand.' },
    ];

    return (
      <div>
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h2 className="text-lg font-heading font-bold mb-1">Help Center</h2>
        <p className="text-xs text-gray-500 mb-4">Find answers to common questions.</p>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <HelpItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>

        <div className="mt-6 glass rounded-lg p-4 border border-white/10 text-center">
          <p className="text-sm font-semibold mb-1">Still need help?</p>
          <p className="text-xs text-gray-500 mb-3">Contact our support team for personalized assistance.</p>
          <a href="mailto:support@steinzlabs.com" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg text-xs font-semibold hover:scale-105 transition-transform">
            <Mail className="w-3 h-3" /> Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (subPage === 'preferences') {
    return (
      <div>
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h2 className="text-lg font-heading font-bold mb-1">Preferences</h2>
        <p className="text-xs text-gray-500 mb-4">Customize your STEINZ experience.</p>

        <div className="glass rounded-lg border border-white/10 overflow-hidden mb-3">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div>
              <div className="text-sm font-semibold">Default Chain</div>
              <div className="text-[10px] text-gray-500">Chain shown first in Context Feed</div>
            </div>
            <select
              value={preferences.defaultChain}
              onChange={(e) => setPreferences(prev => ({ ...prev, defaultChain: e.target.value }))}
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#00E5FF]/30"
            >
              <option value="ethereum">Ethereum</option>
              <option value="solana">Solana</option>
              <option value="bnb">BNB Chain</option>
              <option value="polygon">Polygon</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="base">Base</option>
            </select>
          </div>

          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div>
              <div className="text-sm font-semibold">Currency</div>
              <div className="text-[10px] text-gray-500">Display values in</div>
            </div>
            <select
              value={preferences.currency}
              onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#00E5FF]/30"
            >
              <option value="usd">USD ($)</option>
              <option value="eur">EUR (&euro;)</option>
              <option value="gbp">GBP (&pound;)</option>
              <option value="btc">BTC</option>
              <option value="eth">ETH</option>
            </select>
          </div>

          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div>
              <div className="text-sm font-semibold">Language</div>
              <div className="text-[10px] text-gray-500">Interface language</div>
            </div>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#00E5FF]/30"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>
        </div>

        <div className="glass rounded-lg border border-white/10 overflow-hidden">
          {[
            { key: 'compactMode', label: 'Compact Mode', desc: 'Reduce spacing for more content' },
            { key: 'autoRefresh', label: 'Auto-Refresh Feed', desc: 'Automatically refresh Context Feed' },
            { key: 'soundAlerts', label: 'Sound Alerts', desc: 'Play sound on whale alerts' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-3 py-3 border-b border-white/5 last:border-0">
              <div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[10px] text-gray-500">{item.desc}</div>
              </div>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${(preferences as any)[item.key] ? 'bg-[#00E5FF]' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${(preferences as any)[item.key] ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="glass rounded-xl border border-white/10 mb-5 overflow-hidden">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-[#00E5FF]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#EF4444] rounded-full text-[9px] font-bold flex items-center justify-center text-white">{unreadCount}</span>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">Notifications</div>
              <div className="text-[10px] text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showNotifications ? 'rotate-180' : ''}`} />
        </button>

        {showNotifications && (
          <div className="border-t border-white/5">
            {unreadCount > 0 && (
              <div className="flex justify-end px-4 py-2 border-b border-white/5">
                <button onClick={markAllRead} className="text-[10px] text-[#00E5FF] hover:text-[#00E5FF]/80 font-semibold transition-colors">
                  Mark all read
                </button>
              </div>
            )}
            <div className="max-h-[320px] overflow-y-auto">
              {notifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 ml-2">Loading notifications...</span>
                </div>
              ) : notifList.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No notifications yet</p>
                </div>
              ) : (
                notifList.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 last:border-0 ${n.read ? 'opacity-50 hover:opacity-70' : 'hover:bg-white/5'}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{getNotifIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 bg-[#00E5FF] rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[9px] text-gray-600 mt-1 block">{n.time}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
      <ProfileRow icon={Shield} label="Privacy" sub="Manage data & visibility" onClick={() => setSubPage('privacy')} />
      <ProfileRow icon={Settings} label="Preferences" sub="Customize your experience" onClick={() => setSubPage('preferences')} />

      <SectionLabel>Support</SectionLabel>
      <ProfileRow icon={HelpCircle} label="Help Center" sub="FAQs & support" onClick={() => setSubPage('help')} />
      <ProfileRow icon={FileText} label="Terms of Service" sub="Legal information" onClick={() => window.open('/whitepaper', '_blank')} />

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

function HelpItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`glass rounded-xl overflow-hidden border transition-all duration-300 ${open ? 'border-[#00E5FF]/30 bg-gradient-to-r from-[#00E5FF]/[0.03] to-[#7C3AED]/[0.03]' : 'border-white/[0.06]'}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-white/[0.02] transition-colors">
        <span className="font-semibold text-xs pr-3">{question}</span>
        <ChevronDown className={`w-4 h-4 text-[#00E5FF] transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-3 text-gray-400 text-xs leading-relaxed">{answer}</div>
      </div>
    </div>
  );
}
