'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Award, BarChart3, Bell, Shield, Settings, HelpCircle, LogOut, ChevronRight, Lock, Crown, Dna, PieChart, Mail, Wallet, Calendar, Copy, Check, ExternalLink, Globe, Eye, EyeOff, Smartphone, Key, FileText, MessageCircle, ChevronDown, ArrowLeft, TrendingUp, AlertTriangle, Target, Flame, ShieldAlert, Send, Bot, Headphones, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useWallet } from '@/lib/hooks/useWallet';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getLocalNotifications, getNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '@/lib/notifications';

interface Notification {
  id: string;
  type: 'whale' | 'price' | 'prediction' | 'trending' | 'security' | 'welcome' | 'wallet_created' | 'wallet_imported' | 'swap' | 'send' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const defaultNotifications: Notification[] = [];

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type SubPage = null | 'privacy' | 'help' | 'preferences' | 'ai-support' | 'security';

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
          const localNotifs = getLocalNotifications().map(ln => ({
            id: ln.id,
            type: ln.type as Notification['type'],
            title: ln.title,
            message: ln.message,
            time: formatTimeAgo(ln.timestamp),
            read: ln.read || readIds.includes(ln.id),
          }));
          setNotifList([...localNotifs, ...mapped]);
        }
      } catch {
        if (!cancelled) {
          const localNotifs = getLocalNotifications().map(ln => ({
            id: ln.id,
            type: ln.type as Notification['type'],
            title: ln.title,
            message: ln.message,
            time: formatTimeAgo(ln.timestamp),
            read: ln.read,
          }));
          setNotifList(localNotifs);
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 120000);

    const handleLocalNotif = () => loadNotifications();
    window.addEventListener('steinz_notification', handleLocalNotif);

    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('steinz_notification', handleLocalNotif); };
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
      case 'whale': return <AlertTriangle className="w-4 h-4 text-[#0A1EFF]" />;
      case 'price': return <TrendingUp className="w-4 h-4 text-[#10B981]" />;
      case 'prediction': return <Target className="w-4 h-4 text-[#F59E0B]" />;
      case 'trending': return <Flame className="w-4 h-4 text-[#EF4444]" />;
      case 'security': return <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
      case 'welcome': return <Award className="w-4 h-4 text-[#0A1EFF]" />;
      case 'wallet_created': return <Wallet className="w-4 h-4 text-[#10B981]" />;
      case 'wallet_imported': return <Wallet className="w-4 h-4 text-[#10B981]" />;
      case 'swap': return <TrendingUp className="w-4 h-4 text-[#0A1EFF]" />;
      case 'send': return <Send className="w-4 h-4 text-[#F59E0B]" />;
      case 'system': return <Bell className="w-4 h-4 text-gray-400" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('steinz_support_chat');
    if (saved) {
      try { setChatMessages(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('steinz_support_chat', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const sendSupportMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/customer-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Sorry, something went wrong. Please try again.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again later.', timestamp: Date.now() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    localStorage.removeItem('steinz_support_chat');
  };

  const [notifications, setNotifications] = useState({
    whaleAlerts: true,
    priceAlerts: true,
    securityAlerts: true,
    newsletter: false,
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailWhaleAlerts: true,
    emailPriceAlerts: true,
    browserPush: false,
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
    setNotifPrefs(getNotificationPrefs());
  }, []);

  useEffect(() => {
    localStorage.setItem('steinz_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    saveNotificationPrefs(notifPrefs);
  }, [notifPrefs]);

  useEffect(() => {
    localStorage.setItem('steinz_privacy', JSON.stringify(privacySettings));
  }, [privacySettings]);

  useEffect(() => {
    localStorage.setItem('steinz_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [loginActivity] = useState(() => {
    // Reconstruct login activity from localStorage
    const sessions = [];
    try {
      const token = localStorage.getItem('steinz-auth-token');
      if (token) {
        const parsed = JSON.parse(token);
        if (parsed?.access_token) {
          sessions.push({ device: 'Current Session', time: 'Now', location: 'Current Device', current: true });
        }
      }
    } catch {}
    return sessions;
  });

  const displayName = user?.username
    ? user.username
    : user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.email
    ? user.email.split('@')[0]
    : walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Guest User';

  const fullName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : displayName;

  const isConnected = !!user || !!walletAddress;

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Member';

  const handleSignOut = async () => {
    await signOut();
    disconnectWallet();
    // Clear session-related localStorage entries
    try {
      ['steinz_privacy', 'steinz_preferences', 'steinz_notifications', 'steinz_read_notifs', 'steinz_support_chat', 'steinz_portfolio_wallet', 'wallet_address', 'wallet_provider'].forEach(k => localStorage.removeItem(k));
    } catch {}
    window.location.href = '/login';
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      // Delete user data from Supabase
      if (supabase && user?.id) {
        // Delete profile record
        await supabase.from('profiles').delete().eq('id', user.id);
        // Delete the auth user via admin API (requires service role, so we call our own endpoint)
        const res = await fetch('/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
        if (!res.ok) {
          // Fallback: sign out even if deletion partially fails
          const data = await res.json().catch(() => ({}));
          if (!data.ok) throw new Error(data.error || 'Failed to delete account');
        }
      }
      await signOut();
      disconnectWallet();
      localStorage.clear();
      window.location.href = '/';
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete account. Please contact support.');
      setDeleteLoading(false);
    }
  };

  const savePrivacyToSupabase = async (key: string, value: boolean) => {
    if (!supabase || !user?.id) return;
    setPrivacySaving(true);
    try {
      await supabase.auth.updateUser({ data: { [`privacy_${key}`]: value } });
    } catch {} finally { setPrivacySaving(false); }
  };

  const handlePasswordChange = async () => {
    if (pwdNew.length < 8) { setPwdError('New password must be at least 8 characters'); return; }
    if (pwdNew !== pwdConfirm) { setPwdError('Passwords do not match'); return; }
    if (!supabase) { setPwdError('Authentication not available'); return; }
    setPwdLoading(true); setPwdError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdNew });
      if (error) throw error;
      setPwdSuccess(true);
      setPwdOld(''); setPwdNew(''); setPwdConfirm('');
      setTimeout(() => setPwdSuccess(false), 4000);
    } catch (e: any) {
      setPwdError(e.message || 'Failed to change password');
    } finally { setPwdLoading(false); }
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (subPage === 'security') {
    return (
      <div>
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h2 className="text-lg font-heading font-bold mb-1">Account Security</h2>
        <p className="text-xs text-gray-500 mb-4">Manage your account security settings.</p>

        <div className="glass rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#0A1EFF]" />
              <div>
                <div className="text-sm font-semibold">Email</div>
                <div className="text-[10px] text-gray-500">{user?.email || 'Not set'}</div>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] text-[9px] font-bold rounded">VERIFIED</span>
          </div>
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-[#F59E0B]" />
              <div>
                <div className="text-sm font-semibold">Password</div>
                <div className="text-[10px] text-gray-500">Last changed: Unknown</div>
              </div>
            </div>
            <button className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-semibold hover:bg-white/10 transition-colors">Change</button>
          </div>
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-[#7C3AED]" />
              <div>
                <div className="text-sm font-semibold">Two-Factor Authentication</div>
                <div className="text-[10px] text-gray-500">Add an extra layer of security</div>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-gray-600/30 text-gray-400 text-[9px] font-bold rounded">OFF</span>
          </div>
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#10B981]" />
              <div>
                <div className="text-sm font-semibold">Login Activity</div>
                <div className="text-[10px] text-gray-500">Monitor login sessions</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex items-center justify-between px-3 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <div>
                <div className="text-sm font-semibold">Delete Account</div>
                <div className="text-[10px] text-gray-500">Permanently delete your account and data</div>
              </div>
            </div>
            <button className="px-3 py-1 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-[10px] font-semibold hover:bg-[#EF4444]/20 transition-colors">Delete</button>
          </div>
        </div>

        <div className="mt-4 glass rounded-lg p-3 border border-[#0A1EFF]/20 bg-[#0A1EFF]/5">
          <p className="text-[11px] text-[#0A1EFF]">Your account is protected with industry-standard encryption. Enable two-factor authentication for maximum security.</p>
        </div>
      </div>
    );
  }

  if (subPage === 'privacy') {
    return (
      <div>
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h2 className="text-lg font-heading font-bold mb-1">Privacy Settings</h2>
        <p className="text-xs text-gray-500 mb-4">Control what others can see about you.</p>

        <div className="glass rounded-lg border border-white/10 overflow-hidden">
          {([
            { key: 'showWallet',     icon: <Wallet className="w-4 h-4 text-[#7C3AED]" />,      label: 'Show Wallet Address',   desc: 'Display your wallet address on profile' },
            { key: 'showActivity',   icon: <BarChart3 className="w-4 h-4 text-[#0A1EFF]" />,   label: 'Show Trading Activity', desc: 'Let others see your trading history' },
            { key: 'showPredictions',icon: <Award className="w-4 h-4 text-[#F59E0B]" />,       label: 'Show Predictions',      desc: 'Share your prediction win rate' },
            { key: 'allowDMs',       icon: <MessageCircle className="w-4 h-4 text-[#10B981]" />, label: 'Allow Direct Messages', desc: 'Allow other users to message you' },
            { key: 'publicProfile',  icon: <Globe className="w-4 h-4 text-[#EF4444]" />,        label: 'Public Profile',        desc: 'Make your profile discoverable to others' },
          ] as const).map(({ key, icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-3 py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[10px] text-gray-500">{desc}</div>
                </div>
              </div>
              <button
                onClick={() => setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${privacySettings[key] ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${privacySettings[key] ? 'right-0.5' : 'left-0.5'}`} />
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
          <a href="mailto:support@steinzlabs.com" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-lg text-xs font-semibold hover:scale-105 transition-transform">
            <Mail className="w-3 h-3" /> Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (subPage === 'ai-support') {
    return (
      <div className="flex flex-col h-full">
        <button onClick={() => setSubPage(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-heading font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#0A1EFF]" /> AI Support
            </h2>
            <p className="text-xs text-gray-500">Ask anything about STEINZ LABS</p>
          </div>
          {chatMessages.length > 0 && (
            <button onClick={clearChat} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20">
              Clear Chat
            </button>
          )}
        </div>

        <div className="glass rounded-xl border border-white/10 flex-1 flex flex-col overflow-hidden" style={{ minHeight: '350px', maxHeight: '500px' }}>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mb-3 border border-white/10">
                  <Headphones className="w-6 h-6 text-[#0A1EFF]" />
                </div>
                <p className="text-sm font-semibold mb-1">How can we help?</p>
                <p className="text-[11px] text-gray-500 mb-4 max-w-[250px]">Ask about features, wallet setup, trading, predictions, security, or anything else.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['How do I connect my wallet?', 'Is my data safe?', 'How do predictions work?'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="text-[10px] px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === 'user' ? 'bg-gradient-to-r from-[#0A1EFF]/20 to-[#7C3AED]/20 border border-[#0A1EFF]/20' : 'bg-white/5 border border-white/10'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot className="w-3 h-3 text-[#0A1EFF]" />
                      <span className="text-[9px] text-[#0A1EFF] font-semibold">STEINZ Support</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-[8px] text-gray-600 mt-1 block text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="w-3 h-3 text-[#0A1EFF]" />
                    <span className="text-[9px] text-[#0A1EFF] font-semibold">STEINZ Support</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#0A1EFF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#0A1EFF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#0A1EFF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-white/10 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendSupportMessage()}
                placeholder="Type your question..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/30"
              />
              <button
                onClick={sendSupportMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-lg hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-[10px] text-gray-600">Powered by AI. For complex issues, we&apos;ll connect you with our team.</p>
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
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/30"
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
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/30"
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
              className="bg-[#111827] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#0A1EFF]/30"
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
                className={`w-10 h-5 rounded-full transition-colors relative ${(preferences as any)[item.key] ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
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
              <Bell className="w-5 h-5 text-[#0A1EFF]" />
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
                <button onClick={markAllRead} className="text-[10px] text-[#0A1EFF] hover:text-[#0A1EFF]/80 font-semibold transition-colors">
                  Mark all read
                </button>
              </div>
            )}
            <div className="max-h-[320px] overflow-y-auto">
              {notifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
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
                        {!n.read && <span className="w-1.5 h-1.5 bg-[#0A1EFF] rounded-full flex-shrink-0" />}
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
        <div className="w-20 h-20 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mb-3 border-2 border-white/10">
          <User className="w-10 h-10 text-[#0A1EFF]" />
        </div>
        <h2 className="text-lg font-heading font-bold">{displayName}</h2>
        {user?.first_name && user?.username && (
          <p className="text-xs text-gray-500 mt-0.5">{fullName}</p>
        )}
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
          {(() => {
            const pts = (() => { try { return parseInt(localStorage.getItem('steinz_points') || '0'); } catch { return 0; } })();
            const rank = pts >= 5000 ? { label: 'Legend', color: 'text-red-400' } : pts >= 1500 ? { label: 'Whale', color: 'text-yellow-400' } : pts >= 500 ? { label: 'Analyst', color: 'text-purple-400' } : pts >= 100 ? { label: 'Trader', color: 'text-blue-400' } : { label: 'Rookie', color: 'text-gray-400' };
            return (<><div className={`text-sm font-bold ${rank.color}`}>{rank.label}</div><div className="text-[10px] text-gray-400">Rank</div></>);
          })()}
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          {(() => {
            const results = (() => { try { const r = JSON.parse(localStorage.getItem('steinz_alert_results') || '[]'); return r; } catch { return []; } })();
            const total = results.length;
            const wins = results.filter((r: {success?: boolean}) => r.success).length;
            const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
            return (<><div className="text-lg font-bold">{rate}%</div><div className="text-[10px] text-gray-400">Win Rate</div></>);
          })()}
        </div>
        <div className="glass rounded-lg p-3 text-center border border-white/10">
          {(() => {
            const pts = (() => { try { return parseInt(localStorage.getItem('steinz_points') || '0'); } catch { return 0; } })();
            return (<><div className="text-lg font-bold">{pts}</div><div className="text-[10px] text-gray-400">Points</div></>);
          })()}
        </div>
      </div>

      {user?.email && (
        <div className="glass rounded-lg p-3 mb-3 border border-white/10">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#0A1EFF]" />
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
              className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Notification Preferences */}
      <SectionLabel>Notification Preferences</SectionLabel>
      <div className="glass rounded-lg border border-white/10 mb-2 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
          <div>
            <div className="text-sm font-semibold">Email alerts for whale moves</div>
            <div className="text-[10px] text-gray-500">Receive email on large on-chain transfers</div>
          </div>
          <button
            onClick={() => setNotifPrefs(prev => ({ ...prev, emailWhaleAlerts: !prev.emailWhaleAlerts }))}
            className={`w-10 h-5 rounded-full transition-colors relative ${notifPrefs.emailWhaleAlerts ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${notifPrefs.emailWhaleAlerts ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
          <div>
            <div className="text-sm font-semibold">Email alerts for price targets</div>
            <div className="text-[10px] text-gray-500">Receive email when price targets are hit</div>
          </div>
          <button
            onClick={() => setNotifPrefs(prev => ({ ...prev, emailPriceAlerts: !prev.emailPriceAlerts }))}
            className={`w-10 h-5 rounded-full transition-colors relative ${notifPrefs.emailPriceAlerts ? 'bg-[#0A1EFF]' : 'bg-gray-600'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${notifPrefs.emailPriceAlerts ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              Browser push notifications
              <span className="px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-bold rounded">COMING SOON</span>
            </div>
            <div className="text-[10px] text-gray-500">Push alerts directly to your browser</div>
          </div>
          <button
            disabled
            className="w-10 h-5 rounded-full transition-colors relative bg-gray-700 opacity-40 cursor-not-allowed"
          >
            <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5" />
          </button>
        </div>
      </div>

      <ProfileRow icon={Lock} label="Security" sub="Protect your account" onClick={() => setSubPage('security')} />
      <ProfileRow icon={Shield} label="Privacy" sub="Manage data & visibility" onClick={() => setSubPage('privacy')} />
      <ProfileRow icon={Settings} label="Preferences" sub="Customize your experience" onClick={() => setSubPage('preferences')} />

      <SectionLabel>Support</SectionLabel>
      <ProfileRow icon={Headphones} label="AI Customer Service" sub="Chat with our AI support" onClick={() => setSubPage('ai-support')} />
      <ProfileRow icon={HelpCircle} label="Help Center" sub="FAQs & support" onClick={() => setSubPage('help')} />
      <ProfileRow icon={FileText} label="Terms of Service" sub="Legal information" onClick={() => window.open('/whitepaper', '_blank')} />

      {walletAddress && (
        <a
          href={`https://etherscan.io/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-400"
        >
          <ExternalLink className="w-4 h-4 text-[#0A1EFF]" />
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
      <Icon className="w-4 h-4 text-[#0A1EFF] flex-shrink-0" />
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
    <div className={`glass rounded-xl overflow-hidden border transition-all duration-300 ${open ? 'border-[#0A1EFF]/30 bg-gradient-to-r from-[#0A1EFF]/[0.03] to-[#7C3AED]/[0.03]' : 'border-white/[0.06]'}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-white/[0.02] transition-colors">
        <span className="font-semibold text-xs pr-3">{question}</span>
        <ChevronDown className={`w-4 h-4 text-[#0A1EFF] transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-3 text-gray-400 text-xs leading-relaxed">{answer}</div>
      </div>
    </div>
  );
}
