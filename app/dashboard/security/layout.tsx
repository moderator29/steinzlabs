'use client';

import { useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, KeyRound, PieChart, Wallet, Plug } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useTabListKeys } from '@/hooks/useTabListKeys';

const TABS = [
  { slug: 'health',          label: 'Health',          href: '/dashboard/security',                  Icon: Shield },
  { slug: 'approvals',       label: 'Approvals',       href: '/dashboard/security/approvals',        Icon: KeyRound },
  { slug: 'portfolio-risk',  label: 'Portfolio Risk',  href: '/dashboard/security/portfolio-risk',   Icon: PieChart },
  { slug: 'wallet-analysis', label: 'Wallet Analysis', href: '/dashboard/security/wallet-analysis',  Icon: Wallet },
  { slug: 'connected-apps',  label: 'Connected Apps',  href: '/dashboard/security/connected-dapps',  Icon: Plug },
] as const;

type TabSlug = typeof TABS[number]['slug'];

function activeFromPath(pathname: string): TabSlug {
  if (pathname.startsWith('/dashboard/security/approvals')) return 'approvals';
  if (pathname.startsWith('/dashboard/security/portfolio-risk')) return 'portfolio-risk';
  if (pathname.startsWith('/dashboard/security/wallet-analysis')) return 'wallet-analysis';
  if (pathname.startsWith('/dashboard/security/connected-dapps')) return 'connected-apps';
  return 'health';
}

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/dashboard/security';
  const router = useRouter();
  const active = activeFromPath(pathname);
  const tabSlugs = useMemo(() => TABS.map(t => t.slug) as ReadonlyArray<TabSlug>, []);
  const activeIndex = TABS.findIndex(t => t.slug === active);
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const onKeyDown = useTabListKeys<TabSlug>(tabSlugs, activeIndex, (next) => {
    const idx = TABS.findIndex(t => t.slug === next);
    if (idx >= 0) {
      router.push(TABS[idx].href);
      tabRefs.current[idx]?.focus();
    }
  });

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4" aria-hidden="true" />
          </div>
          <h1 className="text-sm font-heading font-bold">Security Center</h1>
          <span className="ms-auto px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg text-[9px] font-bold">VERIFIED</span>
        </div>
        <div
          role="tablist"
          aria-label="Security Center sections"
          onKeyDown={onKeyDown}
          className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-none"
        >
          {TABS.map((tab, i) => {
            const isActive = tab.slug === active;
            const Icon = tab.Icon;
            return (
              <Link
                key={tab.slug}
                ref={(el) => { tabRefs.current[i] = el; }}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                aria-controls={`security-panel-${tab.slug}`}
                id={`security-tab-${tab.slug}`}
                tabIndex={isActive ? 0 : -1}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
                  isActive
                    ? 'bg-[#0066FF]/15 border-[#0066FF]/40 text-white'
                    : 'bg-[#0f1320] border-[#1a1f2e] text-gray-400 hover:text-white hover:border-[#0066FF]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`security-panel-${active}`}
        aria-labelledby={`security-tab-${active}`}
      >
        {children}
      </div>
    </div>
  );
}
