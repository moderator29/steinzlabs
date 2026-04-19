'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, DollarSign, Users, Activity, BarChart3,
  Crosshair, Shield, Send, Bell, BookOpen, Eye, Landmark,
  Settings, ScrollText, LifeBuoy, Zap, Search, Tag, Star,
  Mail, LogOut, Menu, X, ChevronRight, Lock
} from 'lucide-react';
import SteinzLogo from '@/components/SteinzLogo';
import { HealthBadge } from '@/components/admin/HealthBadge';

const NAV_ITEMS = [
  { href: '/admin/dashboard',           icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/revenue',             icon: DollarSign,      label: 'Revenue' },
  { href: '/admin/users',               icon: Users,           label: 'Users' },
  { href: '/admin/api-health',          icon: Activity,        label: 'API Health' },
  { href: '/admin/vtx-analytics',       icon: BarChart3,       label: 'VTX Analytics' },
  { href: '/admin/sniper-oversight',    icon: Crosshair,       label: 'Sniper Oversight' },
  { href: '/admin/security-analytics',  icon: Shield,          label: 'Security Analytics' },
  { href: '/admin/broadcast',           icon: Send,            label: 'Broadcast' },
  { href: '/admin/announcements',       icon: Bell,            label: 'Announcements' },
  { href: '/admin/research',            icon: BookOpen,        label: 'Research' },
  { href: '/admin/watchlist-insights',  icon: Eye,             label: 'Watchlist Insights' },
  { href: '/admin/treasury',            icon: Landmark,        label: 'Treasury' },
  { href: '/admin/settings',            icon: Settings,        label: 'Settings' },
  { href: '/admin/logs',                icon: ScrollText,      label: 'Activity Logs' },
  { href: '/admin/support',             icon: LifeBuoy,        label: 'Support' },
  { href: '/admin/feature-usage',       icon: Zap,             label: 'Feature Usage' },
  { href: '/admin/search-logs',         icon: Search,          label: 'Search Logs' },
  { href: '/admin/wallet-labels',       icon: Tag,             label: 'Wallet Labels' },
  { href: '/admin/featured-tokens',     icon: Star,            label: 'Featured Tokens' },
  { href: '/admin/email-templates',     icon: Mail,            label: 'Email Templates' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_token');
    if (stored) { setToken(stored); setAuthed(true); }
    setChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = (form.elements.namedItem('token') as HTMLInputElement).value;
    const res = await fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${input}` },
    });
    if (res.ok) {
      sessionStorage.setItem('admin_token', input);
      setToken(input);
      setAuthed(true);
    } else {
      alert('Invalid admin token');
    }
  };

  if (checking) return <div className="min-h-screen bg-[#0A0E1A]" />;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#141824] border border-[#1E2433] rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#0A1EFF]/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#0A1EFF]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Access</h1>
              <p className="text-xs text-gray-500">NAKA LABS Control Panel</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              name="token"
              type="password"
              placeholder="Admin bearer token"
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0A1EFF]/50 transition-colors"
              autoComplete="off"
            />
            <button type="submit" className="w-full bg-[#0A1EFF] hover:bg-[#0818CC] text-white py-3 rounded-xl text-sm font-semibold transition-colors">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-56 bg-[#0D1120] border-r border-[#1E2433] flex flex-col z-30 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-[#1E2433]">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <SteinzLogo size={24} />
            <div>
              <div className="text-xs font-bold text-white leading-none">ADMIN</div>
              <div className="text-[10px] text-gray-500 leading-none mt-0.5">Control Panel</div>
            </div>
          </Link>
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live infrastructure health — turns amber/red when Upstash, Supabase,
            CoinGecko, DexScreener, or Anthropic is degraded. Click to see
            the full health table. */}
        <div className="px-3 py-2.5 border-b border-[#1E2433]">
          <HealthBadge />
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group ${active ? 'bg-[#0A1EFF]/15 text-[#0A1EFF] font-semibold' : 'text-gray-400 hover:text-white hover:bg-[#1E2433]'}`}>
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1E2433]">
          <button onClick={() => { sessionStorage.removeItem('admin_token'); setAuthed(false); setToken(''); }}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 w-full">
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[#1E2433] bg-[#0D1120]">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white">Admin Panel</span>
          <div className="ml-auto">
            <HealthBadge />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
