'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Users, ArrowRight } from 'lucide-react';

/**
 * Admin → NakaCult overview. Shows the current holding threshold +
 * a count of members. The threshold lives in lib/cult/holdings.ts via
 * NAKA_HOLDING_THRESHOLD env var (default 1,227,000); changing it
 * still requires a deploy. This page documents that, surfaces the
 * current effective value, and links to the cult members view so
 * staff can pull a list of who's qualifying.
 *
 * Future iteration (per PDF S5): make the threshold editable in the
 * admin DB so we can flip it without a redeploy. That requires a
 * platform_settings.naka_threshold column + a reader fallback in
 * lib/cult/holdings.ts; spec'd separately so it lands with explicit
 * migration approval.
 */

interface CultStats {
  threshold: number;
  totalMembers: number | null;
  nftMembers: number | null;
  holdingMembers: number | null;
}

export default function AdminCultPage() {
  const [stats, setStats] = useState<CultStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/cult-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CultStats | null) => {
        if (cancelled) return;
        setStats(
          d ?? {
            threshold: 1_227_000,
            totalMembers: null,
            nftMembers: null,
            holdingMembers: null,
          },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setStats({ threshold: 1_227_000, totalMembers: null, nftMembers: null, holdingMembers: null });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="min-h-screen text-white px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">NakaCult</h1>
      <p className="text-sm text-slate-400 mb-8">
        Token-gated apex tier. Members hold ≥ threshold $NAKA or any Naka Labs NFT.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-[#8FA3FF]" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Holding threshold
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {loading || !stats ? '…' : fmt(stats.threshold)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Live value pulled from <code className="text-slate-300">NAKA_HOLDING_THRESHOLD</code> env (default
            1,227,000). Editable without redeploy in a follow-up that adds
            <code className="ml-1 text-slate-300">platform_settings.naka_threshold</code>.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#8FA3FF]" />
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Members
            </span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {loading || !stats ? '…' : stats.totalMembers != null ? fmt(stats.totalMembers) : '—'}
          </div>
          {stats && stats.holdingMembers != null && stats.nftMembers != null ? (
            <p className="text-[11px] text-slate-500 mt-2">
              {fmt(stats.holdingMembers)} via holdings · {fmt(stats.nftMembers)} via NFT
            </p>
          ) : null}
        </div>
      </div>

      <Link
        href="/admin/users?tier=naka_cult"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-sm font-bold text-white"
      >
        View cult members
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
