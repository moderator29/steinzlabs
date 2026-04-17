'use client';

import Link from 'next/link';
import SteinzLogo from '@/components/ui/SteinzLogo';

const PLATFORM_LINKS = [
  { label: 'Features',    href: '#features' },
  { label: 'Security',    href: '/dashboard/security' },
  { label: 'Swap',        href: '/dashboard/swap' },
  { label: 'Sniper Bot',  href: '/dashboard/sniper' },
  { label: 'Market',      href: '/market' },
];

const INTELLIGENCE_LINKS = [
  { label: 'VTX AI',       href: '/dashboard' },
  { label: 'Wallet DNA',   href: '/dashboard' },
  { label: 'Bubble Map',   href: '/dashboard/bubble-map' },
  { label: 'Research Labs',href: '/research' },
];

const RESOURCES_LINKS = [
  { label: 'Docs',    href: '/docs' },
  { label: 'API',     href: '/docs' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms',   href: '/terms' },
  { label: 'Support', href: '/contact' },
];

export function LandingFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: '#07090f' }}>
      <div className="max-w-7xl mx-auto px-5 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

          {/* Brand column */}
          <div className="flex flex-col gap-5 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <SteinzLogo size={22} animated={false} />
              <span className="text-white font-bold text-base tracking-[3px]" style={{ letterSpacing: 3 }}>NAKA LABS</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Institutional-grade crypto intelligence for every trader. On-chain data, AI analysis, and real-time market intelligence.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-[#6d85ff] transition-colors"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-[#6d85ff] transition-colors"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}
                aria-label="Discord">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest opacity-60">Platform</h4>
            <ul className="flex flex-col gap-3">
              {PLATFORM_LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/40 hover:text-white text-sm transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Intelligence */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest opacity-60">Intelligence</h4>
            <ul className="flex flex-col gap-3">
              {INTELLIGENCE_LINKS.map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-white/40 hover:text-white text-sm transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest opacity-60">Resources</h4>
            <ul className="flex flex-col gap-3">
              {RESOURCES_LINKS.map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-white/40 hover:text-white text-sm transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <p className="text-[11px]" style={{ color: '#080e20' }}>
            &copy; {new Date().getFullYear()} Naka Labs. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: '#080e20' }}>
            <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-white/40 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
