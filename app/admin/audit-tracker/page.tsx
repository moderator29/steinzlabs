'use client';

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

/**
 * /admin/audit-tracker — single-pane summary of every feature audited
 * against industry standards. Source of truth is
 * docs/industry-standard-audit.md (Branch E ships the full content).
 * This page is the live tracker that surfaces gap counts at a glance.
 */

const AUDIT_AREAS = [
  { key: 'trading-swap',  label: 'Trading & Swap',  reference: 'Binance / Coinbase / Uniswap / Jupiter', status: 'in-progress' as const },
  { key: 'whale-tracker', label: 'Whale Tracker',   reference: 'Nansen / Arkham / Lookonchain',          status: 'in-progress' as const },
  { key: 'vtx-agent',     label: 'VTX Agent',       reference: 'ChatGPT / Claude / Perplexity',          status: 'partial' as const },
  { key: 'wallet',        label: 'Wallet',          reference: 'Trust Wallet / Phantom / Rabby',         status: 'in-progress' as const },
  { key: 'social-layer',  label: 'Social Layer',    reference: 'Twitter/X / Discord / Telegram',          status: 'fresh' as const },
  { key: 'dashboard',     label: 'Dashboard',       reference: 'Bloomberg Terminal / Linear / Notion',   status: 'in-progress' as const },
  { key: 'sniper-bot',    label: 'Sniper Bot',      reference: 'Maestro / Banana Gun / Trojan',          status: 'in-progress' as const },
];

const STATUS_TONE = {
  'fresh':       { c: 'text-[var(--nl-blue,#0A1EFF)]', bg: 'bg-[var(--nl-blue,#0A1EFF)]/[0.10]', label: 'New build' },
  'in-progress': { c: 'text-amber-300', bg: 'bg-amber-500/[0.08]', label: 'In progress' },
  'partial':     { c: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', label: 'Partial parity' },
  'done':        { c: 'text-emerald-400', bg: 'bg-emerald-500/[0.12]', label: 'Industry parity' },
} as const;

export default function AuditTrackerPage() {
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <ClipboardList className="w-5 h-5 text-[var(--nl-blue,#0A1EFF)]" />
        <h1 className="text-xl sm:text-2xl font-bold text-white">Industry Standard Audit</h1>
      </div>
      <p className="text-[12px] text-slate-400 mb-5">
        Full gap analysis in <Link href="/docs/industry-standard-audit" className="text-[var(--nl-blue,#0A1EFF)]">docs/industry-standard-audit.md</Link>. Per-area status here is updated after each audit pass.
      </p>
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] divide-y divide-white/[0.05]">
        {AUDIT_AREAS.map((a) => {
          const tone = STATUS_TONE[a.status];
          return (
            <div key={a.key} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{a.label}</div>
                <div className="text-[11px] text-slate-400">Reference: {a.reference}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${tone.c} ${tone.bg} border-current/30`}>
                {tone.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
