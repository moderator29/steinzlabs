'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Research', href: '/research' },
  { label: 'Docs', href: '/docs' },
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
        style={{ background: scrolled ? 'rgba(7,9,15,0.95)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <SteinzLogo size={28} animated={false} />
            <span className="font-bold text-[14px] tracking-[3px] text-white/90" style={{ letterSpacing: 3 }}>NAKA LABS</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <LanguageSwitcher variant="nav" />
              <ThemeToggle />
            </div>
            <Link href="/login" className="hidden md:block text-sm text-white/60 hover:text-white transition-colors px-3 py-2">
              Log In
            </Link>
            <Link href="/signup"
              className="h-11 px-5 rounded-full text-sm font-bold text-white flex items-center transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', boxShadow: '0 0 20px rgba(10,30,255,.35)' }}>
              Get Started
            </Link>
            <button className="md:hidden text-white/60 hover:text-white" onClick={() => setOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-72 bg-[#0D1120] h-full p-6 flex flex-col border-l border-white/10">
            <div className="flex justify-end mb-8">
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">
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
            <Link href="/signup" className="w-full py-3.5 rounded-xl font-bold text-white text-center"
              style={{ background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)' }}>
              Get Started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
