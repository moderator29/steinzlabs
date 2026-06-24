'use client';

/**
 * OnboardingMention — three-step "how to start" strip on the landing
 * page. Added per master prompt §7.1.
 */

import Link from 'next/link';
import { Wallet, Sparkles, TrendingUp } from 'lucide-react';

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect a wallet',
    body: 'Bring your own or use the built-in BIP39 wallet (AES-256-GCM, your keys, your crypto).',
  },
  {
    icon: Sparkles,
    title: 'Meet VTX Agent',
    body: 'Your AI co-pilot. Ask for token analysis, whale moves, swap quotes — it has full on-chain context.',
  },
  {
    icon: TrendingUp,
    title: 'Trade with intelligence',
    body: 'Sub-2s sniper, copy-trade with three modes, anti-MEV protection, eight chains.',
  },
];

export function OnboardingMention() {
  return (
    <section id="onboarding" className="relative py-20 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
            style={{
              background: 'rgba(0,102,255,.10)',
              color: 'var(--nl-text-secondary,#8FA3FF)',
              border: '1px solid rgba(0,102,255,.25)',
            }}
          >
            Get Started
          </span>
          <h2 className="text-[36px] max-md:text-[26px] font-black text-white tracking-tight">
            Three steps. Then you&apos;re trading.
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: 'var(--nl-text-muted,#B4C0E0)' }}>
            First-time sign-in opens a 10-card tour. You can replay it anytime from Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="rounded-2xl p-5 border relative"
              style={{
                background: 'rgba(255,255,255,.025)',
                borderColor: 'rgba(255,255,255,.08)',
              }}
            >
              <span
                aria-hidden
                className="absolute top-3 right-3 text-[11px] font-mono font-bold tabular-nums"
                style={{ color: 'var(--nl-text-tertiary,#9CA3AF)' }}
              >
                0{i + 1}
              </span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(0,102,255,.10)' }}
              >
                <Icon className="w-4 h-4 text-[var(--nl-blue,#0066FF)]" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">{title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--nl-text-muted,#B4C0E0)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/docs/onboarding"
            className="text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--nl-text-secondary,#8FA3FF)' }}
          >
            See the full onboarding tour →
          </Link>
        </div>
      </div>
    </section>
  );
}
