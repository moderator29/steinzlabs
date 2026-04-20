'use client';

import { useEffect, useState } from 'react';
import { Brain, Shield, Check, Loader2 } from 'lucide-react';

// Profile toggle: does VTX get to see your wallet holdings?
// Default OFF. Persisted in user_preferences.vtx_wallet_access (jsonb key).
// The VTX server route reads this before injecting wallet context.

export function VtxWalletAccessCard() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { preferences?: Record<string, unknown> } | null) => {
        if (cancelled) return;
        const v = d?.preferences?.vtx_wallet_access;
        setEnabled(typeof v === 'boolean' ? v : false);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    try {
      const r = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vtx_wallet_access: next }),
      });
      if (!r.ok) throw new Error('save failed');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      // revert on failure
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0A1EFF]/10 border border-[#0A1EFF]/25 flex items-center justify-center flex-shrink-0">
          <Brain className="w-5 h-5 text-[#4D6BFF]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">VTX Wallet Access</h3>
          <p className="text-xs text-gray-400 leading-relaxed mt-0.5">
            Let VTX Agent see your wallet holdings so it can answer personalised questions like &ldquo;how is my portfolio doing&rdquo; or &ldquo;is my memecoin exposure too high.&rdquo;
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2.5">
          <Shield className={`w-4 h-4 ${enabled ? 'text-[#10B981]' : 'text-gray-500'}`} />
          <span className="text-sm text-white font-medium">
            {enabled ? 'VTX can see my wallet' : 'Private mode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          ) : savedFlash ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : saving ? (
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={loading || saving}
            onClick={() => toggle(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-[#0A1EFF]' : 'bg-slate-700'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </label>

      <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        {enabled ? (
          <>Your default wallet address is passed to VTX with each request. Turn off any time.</>
        ) : (
          <>VTX only sees data you explicitly paste or ask about. Default for privacy.</>
        )}
      </div>
    </div>
  );
}
