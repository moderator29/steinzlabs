'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: 'swap_enabled',         label: 'Swap Trading',          description: 'Enable multi-chain swap functionality', enabled: true,  category: 'Trading' },
  { key: 'sniper_enabled',       label: 'Sniper Agent',          description: 'Enable automated sniper agent jobs',   enabled: true,  category: 'Trading' },
  { key: 'ai_predictions',       label: 'VTX AI Predictions',    description: 'Enable AI price prediction module',    enabled: true,  category: 'AI' },
  { key: 'cluster_detection',    label: 'Cluster Detection',     description: 'Enable wallet cluster analysis',       enabled: true,  category: 'Intelligence' },
  { key: 'smart_money_feed',     label: 'Smart Money Feed',      description: 'Enable smart money tracking feed',     enabled: true,  category: 'Intelligence' },
  { key: 'security_scans',       label: 'Security Scans',        description: 'Enable Shadow Guardian token scans',   enabled: true,  category: 'Security' },
  { key: 'bubblemaps',           label: 'Bubblemaps Viz',        description: 'Enable holder distribution visualization', enabled: true, category: 'Visualization' },
  { key: 'portfolio_tracker',    label: 'Portfolio Tracker',     description: 'Enable multi-wallet portfolio tracking', enabled: true,  category: 'Portfolio' },
  { key: 'new_user_registration',label: 'New Registrations',     description: 'Allow new user sign-ups',              enabled: true,  category: 'Auth' },
  { key: 'maintenance_mode',     label: 'Maintenance Mode',      description: 'Show maintenance banner to all users', enabled: false, category: 'System' },
];

const CATEGORIES = ['All', ...Array.from(new Set(DEFAULT_FLAGS.map(f => f.category)))];

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [category, setCategory] = useState('All');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastPoll, setLastPoll] = useState(new Date());
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load current settings from Supabase on mount
  useEffect(() => {
    const token = sessionStorage.getItem('admin_token') ?? '';
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.flags && typeof data.flags === 'object') {
          // data.flags is { key: enabled } map from the GET endpoint
          const serverFlags = data.flags as Record<string, boolean>;
          setFlags(prev => prev.map(f => ({
            ...f,
            enabled: serverFlags[f.key] !== undefined ? serverFlags[f.key] : f.enabled,
          })));
        }
      })
      .catch(err => console.error('[Admin Settings] Load failed:', err))
      .finally(() => setLoadingSettings(false));
  }, []);

  const filtered = category === 'All' ? flags : flags.filter(f => f.category === category);

  const toggle = (key: string) => setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ flags: flags.reduce<Record<string, boolean>>((acc, f) => { acc[f.key] = f.enabled; return acc; }, {}) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setSaving(false);
      setLastPoll(new Date());
    }
  }, [flags]);

  const maintenanceOn = flags.find(f => f.key === 'maintenance_mode')?.enabled;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Feature flags — polled by frontend every 30 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          {maintenanceOn && (
            <div className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="w-3 h-3" /> Maintenance Mode Active
            </div>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors font-medium">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <StatusDot status="active" size="sm" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${category === c ? 'bg-[#0A1EFF] text-white' : 'text-gray-400 hover:text-white border border-[#1E2433] hover:border-[#2E3443]'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(flag => (
          <div key={flag.key} className={`bg-[#141824] border rounded-xl p-4 transition-all ${flag.key === 'maintenance_mode' && flag.enabled ? 'border-orange-500/30' : 'border-[#1E2433]'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <StatusDot status={flag.enabled ? 'active' : 'inactive'} pulse={flag.enabled} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{flag.label}</span>
                    <span className="text-[10px] bg-[#1E2433] text-gray-500 px-2 py-0.5 rounded font-mono">{flag.key}</span>
                    <span className="text-[10px] text-gray-600">{flag.category}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{flag.description}</p>
                </div>
              </div>
              <button onClick={() => toggle(flag.key)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${flag.enabled ? 'bg-[#0A1EFF]' : 'bg-[#1E2433]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${flag.enabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-600 text-center">
        Settings are stored in <code className="font-mono text-gray-500">platform_settings</code> Supabase table and read by frontend every 30s
      </div>
    </div>
  );
}
