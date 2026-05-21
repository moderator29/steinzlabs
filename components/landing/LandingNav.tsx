'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Naka Labs brand icons — Menu, X swapped to glowing-geometric.
import { Menu, X } from '@/components/icons/brand';
import SteinzLogo from '@/components/ui/SteinzLogo';
import GlobalControls from '@/components/GlobalControls';

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
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <SteinzLogo size={28} animated={false} />
            {/* §nav-polish — wordmark tracking dropped from 3px to 2px and
                font-size scales up at sm+. Owner reported the 3px letter-
                spacing on a 14px line pushed the wordmark wide enough that
                the adjacent CULT pill touched it on mobile. */}
            <span className="font-bold text-[13px] sm:text-[14px] text-white/90 whitespace-nowrap" style={{ letterSpacing: 2 }}>NAKA LABS</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <GlobalControls className="hidden sm:flex" />
            {/* NakaCult landing toggle — flips the user to the token-gated
                cult marketing surface (/naka-cult) so they can read the
                Cult lore before signing up. Crimson accent matches the
                cult brand color and visually distinguishes from the
                blue 'Get Started' primary CTA. */}
            {/* NakaCult landing toggle — now visible at every breakpoint
                (was `hidden md:inline-flex`, which hid it on phones). The
                compact mobile variant drops the label to a sigil-only
                pill at <sm so the nav row still fits next to the
                hamburger; from sm+ the full "NakaCult" label returns. */}
            <Link
              href="/naka-cult"
              aria-label="Enter NakaCult"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-white/90 border border-[#DC143C]/50 hover:border-[#DC143C] hover:text-white transition-all"
              style={{ background: 'linear-gradient(135deg,rgba(220,20,60,0.18),rgba(220,20,60,0.06))', boxShadow: '0 0 14px rgba(220,20,60,0.18)' }}
            >
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[#DC143C] shadow-[0_0_8px_rgba(220,20,60,0.8)] animate-pulse" />
              <span className="hidden sm:inline">NakaCult</span>
              <span className="sm:hidden">Cult</span>
            </Link>
            <Link href="/login" className="hidden md:block text-sm text-white/60 hover:text-white transition-colors px-3 py-2">
              Log In
            </Link>
            {/* §nav-polish — Get Started was wrapping to two lines on
                mobile because the parent flex row had no room and the
                button had no whitespace-nowrap. Made the button a clean
                square-cornered rounded-xl pill, single line, with a
                tighter font on phones. text-[13px] on mobile keeps the
                button compact next to the CULT pill + hamburger. */}
            <Link href="/signup"
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-[13px] sm:text-sm font-bold text-white flex items-center whitespace-nowrap transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', boxShadow: '0 0 20px rgba(10,30,255,.35)', letterSpacing: '0.01em' }}>
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
          <div className="relative ms-auto w-72 bg-[#0D1120] h-full p-6 flex flex-col border-l border-white/10">
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
              <Link
                href="/naka-cult"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 text-base font-bold uppercase tracking-wider text-[#FFD0DC] hover:text-white transition-colors"
              >
                <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-[#DC143C] shadow-[0_0_10px_rgba(220,20,60,0.8)]" />
                NakaCult
              </Link>
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
