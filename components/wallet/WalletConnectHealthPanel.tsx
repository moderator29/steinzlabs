'use client';

/**
 * WalletConnectHealthPanel (#21) — a compact, on-demand diagnostic for
 * "the WalletConnect modal opens but nothing connects." Renders the
 * structured snapshot from getWalletConnectHealth(): project-id presence,
 * the served vs metadata origin (the usual culprit), AppKit init state,
 * and the exact origin to allow-list in the Reown dashboard.
 *
 * Drop it behind a "Diagnose" toggle anywhere a connect failure surfaces.
 */

import { useState } from 'react';
import { Activity, Copy, Check } from 'lucide-react';
import { getWalletConnectHealth } from '@/lib/wallet/walletConnectHealth';

export function WalletConnectHealthPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Recompute on each open so a freshly-initialized AppKit / changed
  // origin is reflected without a remount.
  const health = open ? getWalletConnectHealth() : null;

  const dot =
    health?.status === 'ok' ? 'bg-[#10B981]' : health?.status === 'warn' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]';

  const copyReport = async () => {
    if (!health) return;
    const report = [
      `WalletConnect health: ${health.status}`,
      `projectId: ${health.hasProjectId ? `set (…${health.projectIdTail})` : 'MISSING'}`,
      `servedOrigin: ${health.servedOrigin}`,
      `metadataOrigin: ${health.metadataOrigin}`,
      `originMatches: ${health.originMatches}`,
      `appKitInitialized: ${health.appKitInitialized}`,
      ...health.notes.map((n) => `- ${n}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <Activity className="w-3 h-3" aria-hidden="true" />
        {open ? 'Hide connection diagnostics' : 'Diagnose connection'}
      </button>
      {health && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="text-[11px] font-semibold text-white uppercase tracking-wide">{health.status}</span>
            </div>
            <button
              type="button"
              onClick={() => void copyReport()}
              className="inline-flex items-center gap-1 text-[10px] text-[#8FA3FF] hover:text-white"
            >
              {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy report'}
            </button>
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[10px]">
            <dt className="text-slate-500">Project ID</dt>
            <dd className="text-slate-200 break-all">{health.hasProjectId ? `set (…${health.projectIdTail})` : 'MISSING'}</dd>
            <dt className="text-slate-500">Served origin</dt>
            <dd className="text-slate-200 break-all">{health.servedOrigin || '—'}</dd>
            <dt className="text-slate-500">Metadata origin</dt>
            <dd className="text-slate-200 break-all">{health.metadataOrigin}</dd>
            <dt className="text-slate-500">Origin match</dt>
            <dd className={health.originMatches ? 'text-[#10B981]' : 'text-[#F59E0B]'}>{health.originMatches ? 'yes' : 'no'}</dd>
            <dt className="text-slate-500">AppKit init</dt>
            <dd className={health.appKitInitialized ? 'text-[#10B981]' : 'text-[#F59E0B]'}>{health.appKitInitialized ? 'yes' : 'no'}</dd>
          </dl>
          <ul className="space-y-1 border-t border-white/5 pt-2">
            {health.notes.map((n, i) => (
              <li key={i} className="text-[10px] text-slate-400 leading-relaxed">• {n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
