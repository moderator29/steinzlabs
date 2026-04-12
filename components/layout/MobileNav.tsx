'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Shield,
  User,
} from 'lucide-react';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navigation = [
    { name: 'Home', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Portfolio', icon: Wallet, href: '/portfolio' },
    { name: 'Trade', icon: TrendingUp, href: '/trading' },
    { name: 'Security', icon: Shield, href: '/security-center' },
    { name: 'Account', icon: User, href: '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0A0E1A] border-t border-[#1E2433] md:hidden">
      <div className="grid grid-cols-5 gap-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <button
              key={item.name}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]'
                  : 'text-gray-400'
              }`}
            >
              <item.icon size={20} />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
