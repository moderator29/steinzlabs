'use client';

import Link from 'next/link';
import { CheckCircle, Wallet, MessageCircle, BookOpen, ArrowRight } from 'lucide-react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export default function OnboardingCompletePage() {
  return (
    <AuroraBackground fullHeight>
    <div className="min-h-screen text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You're in.</h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md">
            Email verified. Three quick steps to get the most out of your
            Naka Labs account — each one's optional, you can come back
            later.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <FunnelStep
            icon={Wallet}
            title="Connect a wallet"
            body="Track holdings, get PnL, and trade in one tap. Non-custodial — we never see your keys."
            ctaHref="/settings"
            ctaLabel="Connect"
          />
          <FunnelStep
            icon={MessageCircle}
            title="Join Telegram for live alerts"
            body="Whale moves, price targets, and sniper fills delivered to your DMs in real time."
            ctaHref="https://t.me/nakalabs"
            ctaLabel="Open Telegram"
            external
          />
          <FunnelStep
            icon={BookOpen}
            title="Bookmark the support docs"
            body="Quick-start guides, NAKA token gating, how the chambers work — keep it one tab away."
            ctaHref="/docs"
            ctaLabel="Open docs"
          />
        </div>

        <Link
          href="/dashboard"
          className="nl-btn-neon block w-full text-center py-3 rounded-xl text-sm font-bold"
        >
          Go to dashboard <ArrowRight className="inline w-4 h-4 ms-1" />
        </Link>
        <p className="text-center text-[11px] text-slate-500 mt-4">
          Need help? Reply to your verification email or hit /help on the
          dashboard.
        </p>
      </div>
    </div>
    </AuroraBackground>
  );
}

function FunnelStep({
  icon: Icon,
  title,
  body,
  ctaHref,
  ctaLabel,
  external = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
  external?: boolean;
}) {
  const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl nl-glass"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
    >
      <div className="w-9 h-9 rounded-lg bg-[#0066FF]/15 border border-[#0066FF]/30 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#8FA3FF]" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold mb-0.5">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-2">{body}</p>
        <Link
          href={ctaHref}
          {...linkProps}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8FA3FF] hover:text-white"
        >
          {ctaLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
