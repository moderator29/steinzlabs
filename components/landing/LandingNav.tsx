'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
// lucide Menu/X: the brand glowing-geometric variants paint with a fixed
// gradient stroke and ignore text-* colour, leaving the mobile toggle
// invisible on the dark nav; lucide honours the button's currentColor.
// Twitter renders the X glyph and Send the Telegram paper-plane, matching
// the social icons already used across the app (SidebarMenu, layout).
import { Menu, X, ArrowRight, ChevronRight, Twitter, Send } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Research', href: '/research' },
  { label: 'Docs', href: '/docs' },
  { label: 'NakaCult', href: '/naka-cult' },
];

const SOCIALS = [
  { label: 'Naka Labs on X', href: 'https://x.com/nakalabs', Icon: Twitter },
  { label: 'Naka Labs on Telegram', href: 'https://t.me/nakalabs', Icon: Send },
];

// Shiny neon-blue CTA: gradient body + outer glow + inset top highlight so
// the button reads as raised glass rather than a flat fill.
const SHINY_CTA_STYLE = {
  background: 'linear-gradient(135deg,#0066FF 0%,#1E90FF 100%)',
  boxShadow:
    '0 8px 24px rgba(0,102,255,.42), 0 0 0 1px rgba(30,144,255,.35), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -6px 14px rgba(0,40,120,.45)',
} as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Lock body scroll while the slide-in panel is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'border-b border-white/10' : ''}`}
        style={{ background: scrolled ? 'rgba(4,6,14,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-shrink">
            <SteinzLogo size={40} animated={false} />
            <span className="font-bold text-[14px] sm:text-[15px] text-white truncate" style={{ letterSpacing: 2 }}>NAKA LABS</span>
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
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-[13px] sm:text-sm font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-all hover:scale-[1.03]"
              style={SHINY_CTA_STYLE}>
              <span className="sm:hidden">Launch</span>
              <span className="hidden sm:inline">Launch App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl text-white/75 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] flex md:hidden">
            <motion.div
              className="absolute inset-0"
              style={{ background: 'rgba(2,4,10,0.72)', backdropFilter: 'blur(6px)' }}
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            />
            <motion.div
              className="relative ms-auto w-[86%] max-w-sm h-full flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(165deg, rgba(9,14,34,0.98) 0%, rgba(4,6,18,0.99) 60%)',
                borderLeft: '1px solid rgba(30,144,255,0.28)',
                boxShadow: '-24px 0 70px rgba(0,0,0,0.6), inset 1px 0 0 rgba(30,144,255,0.18)',
              }}
              initial={reduced ? { opacity: 0 } : { x: '100%' }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: '100%' }}
              transition={{ type: reduced ? 'tween' : 'spring', stiffness: 320, damping: 34, duration: reduced ? 0 : undefined }}
            >
              {/* Neon edge glow hugging the left border */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24"
                style={{ background: 'radial-gradient(120% 60% at 0% 30%, rgba(0,102,255,0.20), transparent 70%)' }} />

              <div className="relative flex items-center justify-between px-6 pt-6 pb-5">
                <div className="flex items-center gap-2.5">
                  <SteinzLogo size={36} animated={false} />
                  <span className="font-bold text-[14px] text-white" style={{ letterSpacing: 2 }}>NAKA LABS</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex items-center justify-center h-10 w-10 rounded-xl text-white/70 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto px-4">
                <nav className="flex flex-col gap-1">
                  {[...NAV_LINKS, { label: 'Log In', href: '/login' }].map((l, i) => (
                    <motion.a
                      key={l.label}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center justify-between rounded-xl px-4 py-3.5 text-[17px] font-semibold text-white/75 hover:text-white transition-colors"
                      initial={reduced ? false : { opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduced ? 0 : 0.08 + i * 0.045, duration: 0.3 }}
                    >
                      <span className="relative">
                        {l.label}
                        <span aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: 'linear-gradient(90deg, rgba(0,102,255,0.16), rgba(30,144,255,0.05) 70%, transparent)' }} />
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-[#1E90FF] group-hover:translate-x-0.5 transition-all" />
                    </motion.a>
                  ))}
                </nav>

                <div className="h-px my-5 mx-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(30,144,255,0.35), transparent)' }} />

                <div className="px-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 mb-3">Community</p>
                  <div className="flex items-center gap-3">
                    {SOCIALS.map(({ label, href, Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:text-white transition-all hover:-translate-y-0.5"
                        style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(30,144,255,0.22)' }}>
                        <Icon className="h-[18px] w-[18px]" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative px-4 pt-4" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
                <Link href="/dashboard" onClick={() => setOpen(false)}
                  className="relative w-full py-4 rounded-2xl font-bold text-white text-[16px] text-center inline-flex items-center justify-center gap-2 overflow-hidden transition-transform active:scale-[0.99]"
                  style={SHINY_CTA_STYLE}>
                  {/* subtle top-edge shine sweep */}
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
                  <span className="relative inline-flex items-center gap-2">
                    Launch App <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
