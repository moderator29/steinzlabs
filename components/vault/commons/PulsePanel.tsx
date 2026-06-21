'use client';

import { useEffect, useState, useCallback } from 'react';
import { Radar, AlertTriangle, Eye, Activity } from 'lucide-react';

interface Signal {
  id: string;
  kind: string;
  title: string;
  detail: Record<string, unknown>;
  severity: 'info' | 'watch' | 'alert';
  created_at: string;
}

const SEV: Record<Signal['severity'], { color: string; ring: string; icon: typeof Activity }> = {
  info:  { color: 'text-[#9FB8FF]', ring: 'border-[#3D5AFE]/40 bg-[#3D5AFE]/8',  icon: Activity },
  watch: { color: 'text-[#FFD86B]', ring: 'border-[#FFD86B]/40 bg-[#FFD86B]/8',  icon: Eye },
  alert: { color: 'text-[#FF9DB0]', ring: 'border-[#E11D48]/45 bg-[#E11D48]/10', icon: AlertTriangle },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function PulsePanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cult/pulse', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = (await res.json()) as { signals: Signal[] };
      setSignals(json.signals);
      setError(null);
    } catch {
      setError('Could not reach the Pulse.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <p className="py-10 text-center text-sm text-[#8C9AC0]">Reading the Pulse…</p>;
  if (error) return <p className="py-10 text-center text-sm text-[#FF9DB0]">{error}</p>;
  if (signals.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-10 text-center">
        <Radar className="mx-auto mb-3 text-[#9FB8FF]" size={28} />
        <p className="text-sm text-[#8C9AC0]">The Pulse is quiet. Cult-only signals stream here the moment they fire.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {signals.map((s) => {
        const sev = SEV[s.severity] ?? SEV.info;
        const Icon = sev.icon;
        const note = typeof s.detail?.message === 'string' ? s.detail.message : null;
        return (
          <li key={s.id} className={`flex gap-3 rounded-xl border p-3.5 ${sev.ring}`}>
            <span className={`mt-0.5 ${sev.color}`}><Icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8C9AC0]">{s.kind}</span>
                <span className="ml-auto text-[11px] text-[#6B779C]">{timeAgo(s.created_at)}</span>
              </div>
              <p className="mt-1 text-[14px] font-semibold text-white">{s.title}</p>
              {note && <p className="mt-0.5 text-[13px] leading-relaxed text-[#B4C0E0]">{note}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
