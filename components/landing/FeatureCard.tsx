'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

export interface FeatureCardProps {
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  gradient: string;
  cta: string;
  href: string;
}

export function FeatureCard({ tag, title, description, bullets, icon: Icon, gradient, cta, href }: FeatureCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-8 md:p-10 flex flex-col gap-5" style={{ background: gradient }}>
      {/* Tag pill */}
      <div className="inline-flex w-fit">
        <span className="px-3 py-1 bg-white/15 border border-white/25 rounded-full text-xs font-semibold text-white">{tag}</span>
      </div>

      {/* 3D floating icon */}
      <div>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,.15)',
            border: '1px solid rgba(255,255,255,.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,.3)',
            animation: 'floatIcon 3s ease-in-out infinite',
          }}>
          <Icon className="w-9 h-9 text-white" strokeWidth={1.5} />
          <div className="absolute top-1.5 left-2 w-12 h-5 rounded-full"
            style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.3) 0%,transparent 100%)', filter: 'blur(4px)' }} />
        </div>
      </div>

      {/* Text */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{title}</h3>
        <p className="text-white/75 text-sm leading-relaxed">{description}</p>
      </div>

      {/* Bullets */}
      <ul className="space-y-2">
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2 text-sm text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0 mt-2" />
            {b}
          </li>
        ))}
      </ul>

      {/* CTA — auto-width, left-aligned */}
      <div>
        <Link href={href}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:bg-white/30"
          style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)' }}>
          {cta} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
