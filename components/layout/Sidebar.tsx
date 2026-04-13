'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, TrendingUp, Shield, Activity, Users, AlertCircle, Search, Settings, DollarSign } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const nav = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Portfolio', icon: Wallet, href: '/portfolio' },
    { name: 'Trading', icon: TrendingUp, href: '/trading' },
    { name: 'Swap', icon: DollarSign, href: '/swap' },
    { name: 'DNA Analyzer', icon: Search, href: '/dna-analyzer' },
    { name: 'Wallet Tracer', icon: Activity, href: '/wallet-tracer' },
    { name: 'Smart Money', icon: Users, href: '/smart-money' },
    { name: 'Security Center', icon: Shield, href: '/security-center' },
    { name: 'Alerts', icon: AlertCircle, href: '/alerts' },
    { name: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#0A0E1A] border-r border-[#1E2433] flex flex-col">
      <div className="p-6 border-b border-[#1E2433]">
        <h1 className="text-2xl font-bold text-white">STEINZ <span className="text-[#0A1EFF]">Labs</span></h1>
        <p className="text-xs text-gray-500 mt-1">On-chain Intelligence</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button key={item.name} onClick={() => router.push(item.href)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-[#0A1EFF] text-white' : 'text-gray-400 hover:bg-[#141824] hover:text-white'}`}>
              <item.icon size={20} />
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#1E2433]">
        <div className="bg-[#141824] rounded-lg p-3 text-xs text-gray-400">
          <div className="flex items-center justify-between mb-1">
            <span>Status</span>
            <span className="text-green-500 flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full" />Online</span>
          </div>
          <div className="text-gray-600">Protected by Shadow Guardian</div>
        </div>
      </div>
    </div>
  );
}
