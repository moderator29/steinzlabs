'use client';

import { useEffect, useState } from 'react';
import {
  X, Globe, Brain, Shield, TrendingUp, Image as ImageIcon, Repeat, ChevronDown,
  Save, Check, Loader2, Trash2,
} from 'lucide-react';

// Full VTX settings panel. Persists to Supabase user_preferences under the
// vtx_settings key. Settings apply immediately on save.

interface VtxSettings {
  language: string;
  response_style: 'concise' | 'detailed' | 'technical' | 'beginner';
  risk_appetite: 'conservative' | 'balanced' | 'aggressive';
  default_chain: 'ethereum' | 'solana' | 'base' | 'arbitrum' | 'polygon' | 'bsc' | 'avalanche';
  show_token_cards: boolean;
  show_swap_cards: boolean;
  auto_trending_refresh: boolean;
}

const DEFAULTS: VtxSettings = {
  language: 'English',
  response_style: 'detailed',
  risk_appetite: 'balanced',
  default_chain: 'ethereum',
  show_token_cards: true,
  show_swap_cards: true,
  auto_trending_refresh: true,
};

const LANGUAGES = ['English', 'Spanish', 'French', 'Portuguese', 'German', 'Italian', 'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Turkish', 'Vietnamese', 'Indonesian'];

interface Props { open: boolean; onClose: () => void; onClearChats?: () => void }

export function VtxSettingsDrawer({ open, onClose, onClearChats }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [settings, setSettings] = useState<VtxSettings>(DEFAULTS);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { preferences?: Record<string, unknown> } | null) => {
        if (cancelled) return;
        const v = (d?.preferences as Record<string, unknown> | undefined)?.vtx_settings;
        if (v && typeof v === 'object') {
          setSettings({ ...DEFAULTS, ...(v as Partial<VtxSettings>) });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vtx_settings: settings }),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  function exportHistory() {
    try {
      const raw = localStorage.getItem('vtx_messages') || '[]';
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naka-vtx-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex" role="dialog">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-[420px] bg-[#0b0f1a] border-l border-white/[0.06] h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0b0f1a] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A1EFF]/15 flex items-center justify-center">
              <Brain className="w-4 h-4 text-[#4D6BFF]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">VTX Settings</div>
              <div className="text-[10px] text-gray-500">Saved to your account</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {loading ? (
            <div className="text-xs text-gray-500 text-center py-10"><Loader2 className="w-4 h-4 inline animate-spin" /> Loading…</div>
          ) : (
            <>
              <Section title="Response" icon={Brain}>
                <Field label="Language" icon={Globe}>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm"
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Style">
                  <select
                    value={settings.response_style}
                    onChange={(e) => setSettings({ ...settings, response_style: e.target.value as VtxSettings['response_style'] })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="concise">Concise — 1-2 paragraphs</option>
                    <option value="detailed">Detailed — standard</option>
                    <option value="technical">Technical — for power users</option>
                    <option value="beginner">Beginner-friendly</option>
                  </select>
                </Field>
              </Section>

              <Section title="Risk profile" icon={Shield}>
                <Field label="Risk appetite">
                  <select
                    value={settings.risk_appetite}
                    onChange={(e) => setSettings({ ...settings, risk_appetite: e.target.value as VtxSettings['risk_appetite'] })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="conservative">Conservative — prioritise capital preservation</option>
                    <option value="balanced">Balanced — show both sides</option>
                    <option value="aggressive">Aggressive — asymmetric upside</option>
                  </select>
                </Field>
              </Section>

              <Section title="Defaults" icon={TrendingUp}>
                <Field label="Default chain">
                  <select
                    value={settings.default_chain}
                    onChange={(e) => setSettings({ ...settings, default_chain: e.target.value as VtxSettings['default_chain'] })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="solana">Solana</option>
                    <option value="base">Base</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="polygon">Polygon</option>
                    <option value="bsc">BNB Smart Chain</option>
                    <option value="avalanche">Avalanche</option>
                  </select>
                </Field>
              </Section>

              <Section title="Inline cards" icon={ImageIcon}>
                <Toggle
                  label="Show TokenCard inline"
                  desc="Render rich token cards for symbols and contracts mentioned in the chat."
                  value={settings.show_token_cards}
                  onChange={(v) => setSettings({ ...settings, show_token_cards: v })}
                />
                <Toggle
                  label="Show SwapCard inline"
                  desc="Render an actionable swap card when swap intent is detected."
                  value={settings.show_swap_cards}
                  onChange={(v) => setSettings({ ...settings, show_swap_cards: v })}
                />
                <Toggle
                  label="Auto-refresh trending data"
                  desc="Pull fresh CoinGecko + DexScreener trending every few minutes."
                  value={settings.auto_trending_refresh}
                  onChange={(v) => setSettings({ ...settings, auto_trending_refresh: v })}
                />
              </Section>

              <Section title="Data" icon={Repeat}>
                <button
                  onClick={exportHistory}
                  className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-sm text-white font-semibold flex items-center justify-center gap-2"
                >
                  Export chat history
                </button>
                {onClearChats && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all VTX chat history on this device? This cannot be undone.')) onClearChats();
                    }}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 text-sm text-red-400 font-semibold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear all chat history
                  </button>
                )}
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-white/[0.06] bg-[#0b0f1a] px-5 py-3 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedFlash ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Helpers */

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-3.5 h-3.5 text-[#4D6BFF]" />
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-gray-500">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-400 font-medium block mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${value ? 'bg-[#0A1EFF]' : 'bg-slate-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        <div className="text-[11px] text-gray-500 leading-snug">{desc}</div>
      </div>
    </label>
  );
}
