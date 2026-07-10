'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  rollout_pct: number;
  updated_by: string | null;
  updated_at: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feature-flags', { headers: adminHeaders() });
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const j = await res.json() as { flags: Flag[] };
      setFlags(j.flags ?? []);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (f: Flag) => {
    setBusy(f.key);
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ key: f.key, enabled: !f.enabled }),
      });
      if (!res.ok) { setError(`Toggle failed: ${res.status}`); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const setRollout = async (key: string, pct: number) => {
    setBusy(key);
    try {
      await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ key, rollout_pct: pct }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen nl-aurora-bg text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Feature Flags</h1>
        <p className="text-sm text-slate-400 mb-6">Toggleable surfaces + rollout %. Every change is logged to admin_audit_log.</p>

        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2">{error}</div>}

        {loading && flags.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading flags…</div>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.key} className="nl-glass rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void toggle(f)}
                    disabled={busy !== null}
                    className="shrink-0"
                    aria-label={f.enabled ? `Disable ${f.key}` : `Enable ${f.key}`}
                  >
                    {f.enabled
                      ? <ToggleRight className="w-9 h-9 text-emerald-300" />
                      : <ToggleLeft className="w-9 h-9 text-slate-500" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm">{f.key}</div>
                    {f.description && <div className="text-xs text-slate-400 mt-0.5">{f.description}</div>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <label className="flex items-center gap-1">
                        Rollout
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={f.rollout_pct}
                          onChange={(e) => void setRollout(f.key, Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="w-14 bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-0.5 text-white focus:outline-none focus:border-[#0066FF]/50 transition-colors"
                        />
                        %
                      </label>
                      <span>updated {new Date(f.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function adminHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  // Admin layout stores the bearer under 'admin_token' (not 'admin_bearer').
  const tok = sessionStorage.getItem('admin_token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}
