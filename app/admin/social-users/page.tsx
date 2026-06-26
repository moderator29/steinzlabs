'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldX, ShieldCheck, Trash2 } from 'lucide-react';

interface UserDump {
  profile: { id: string; username: string; display_name: string | null; role: string; social_suspended_until: string | null; created_at: string };
  counts: Record<string, number>;
  suspicious_flags: string[];
}

function Inner() {
  const sp = useSearchParams();
  const [id, setId] = useState(sp.get('id') ?? '');
  const [data, setData] = useState<UserDump | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (uid: string) => {
    setData(null); setError(null);
    if (!uid) return;
    try {
      const res = await fetch(`/api/admin/social/users/${uid}`);
      const json = await res.json();
      if (!res.ok) setError(json.error ?? 'Failed');
      else setData(json);
    } catch { setError('Network error'); }
  };

  useEffect(() => { void load(id); }, [id]);

  const moderate = async (action: string, durationHours?: number) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action, user_id: id };
      if (durationHours) body.duration_hours = durationHours;
      await fetch('/api/admin/social/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load(id);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">Per-user social view</h1>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="Paste a profile UUID…"
        className="w-full mb-4 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 font-mono"
      />
      {error ? <div className="text-sm text-red-400">{error}</div>
        : data === null ? (id ? <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> : null)
        : (
        <div className="space-y-4">
          <section className="rounded-2xl nl-glass p-4">
            <div className="text-sm font-semibold text-white">@{data.profile.username}</div>
            <div className="text-[11px] text-slate-400">Role: {data.profile.role} · Joined {new Date(data.profile.created_at).toLocaleDateString()}</div>
            {data.profile.social_suspended_until && new Date(data.profile.social_suspended_until) > new Date() && (
              <div className="mt-2 text-[11px] text-amber-300">Suspended from social until {new Date(data.profile.social_suspended_until).toLocaleString()}</div>
            )}
          </section>

          {data.suspicious_flags.length > 0 && (
            <section className="rounded-2xl bg-red-500/[0.06] border border-red-500/25 p-4">
              <h2 className="text-sm font-bold text-red-300 mb-2">Suspicious activity flags</h2>
              <ul className="text-[12px] text-red-200 list-disc list-inside space-y-1">
                {data.suspicious_flags.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </section>
          )}

          <section className="rounded-2xl nl-glass p-4">
            <h2 className="text-sm font-bold text-white mb-2">Counts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
              {Object.entries(data.counts).map(([k, v]) => (
                <div key={k} className="rounded-lg nl-glass px-3 py-2">
                  <div className="text-[10px] uppercase text-slate-400">{k.replace(/_/g, ' ')}</div>
                  <div className="text-base font-bold text-white tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl nl-glass p-4">
            <h2 className="text-sm font-bold text-white mb-3">Moderator actions</h2>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => moderate('suspend_social', 24)} className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[12px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"><ShieldX className="w-3.5 h-3.5" />Suspend social 24h</button>
              <button disabled={busy} onClick={() => moderate('suspend_social', 24 * 7)} className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[12px] font-semibold disabled:opacity-50">Suspend 7d</button>
              <button disabled={busy} onClick={() => moderate('unsuspend_social')} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Unsuspend</button>
              <button disabled={busy} onClick={() => moderate('force_disable')} className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[12px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Force-disable</button>
              <button disabled={busy} onClick={() => moderate('restore_user')} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold disabled:opacity-50">Restore</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function SocialUsersAdminPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}><Inner /></Suspense>;
}
