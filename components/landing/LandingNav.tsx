'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// lucide Menu/X: the brand glowing-geometric variants paint with a fixed
// gradient stroke and ignore text-* colour, leaving the mobile toggle
// invisible on the dark nav; lucide honours the button's currentColor.
import { Menu, X, ArrowRight } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Research', href: '/research' },
  { label: 'Docs', href: '/docs' },
  { label: 'NakaCult', href: '/naka-cult' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'border-b border-white/10' : ''}`}
        style={{ background: scrolled ? 'rgba(4,6,14,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-shrink">
            <SteinzLogo size={28} animated={false} />
            <span className="font-bold text-[13px] sm:text-[14px] text-white truncate" style={{ letterSpacing: 2 }}>NAKA LABS</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm font-medium text-white/55 hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link href="/login" className="hidden md:block text-sm text-white/60 hover:text-white transition-colors px-2 py-2">
              Log In
            </Link>
            <Link href="/dashboard"
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-full text-[13px] sm:text-sm font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg,#0066FF,#1E90FF)', boxShadow: '0 0 22px rgba(0,102,255,.4)' }}>
              <span className="sm:hidden">Launch</span>
              <span className="hidden sm:inline">Launch App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button className="md:hidden text-white/70 hover:text-white" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative ms-auto w-72 h-full p-6 flex flex-col border-l border-white/10"
            style={{ background: '#05081a' }}>
            <div className="flex justify-end mb-8">
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 flex-1">
              {NAV_LINKS.map(l => (
                <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                  className="text-base font-medium text-white/70 hover:text-white transition-colors">{l.label}</a>
              ))}
              <Link href="/login" onClick={() => setOpen(false)}
                className="text-base font-medium text-white/70 hover:text-white transition-colors">Log In</Link>
            </div>
            <Link href="/dashboard" onClick={() => setOpen(false)}
              className="w-full py-3.5 rounded-full font-bold text-white text-center inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#0066FF,#1E90FF)', boxShadow: '0 0 22px rgba(0,102,255,.4)' }}>
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
