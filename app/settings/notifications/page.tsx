'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Clock, Mail, Zap, TrendingUp, Brain, ChevronDown, ChevronUp, Save, CheckCircle } from 'lucide-react';
import NotificationSetup from '@/components/notifications/NotificationSetup';

interface NotifSettings {
  whale_alerts_enabled: boolean;
  whale_min_trade_usd: number;
  whale_buys: boolean;
  whale_sells: boolean;
  whale_convergence: boolean;
  convergence_min_whales: number;
  smart_money_enabled: boolean;
  price_alerts_enabled: boolean;
  trend_alerts_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  quiet_timezone: string;
  quiet_exceptions: string[];
  email_backup_enabled: boolean;
}

const DEFAULTS: NotifSettings = {
  whale_alerts_enabled: true, whale_min_trade_usd: 50000,
  whale_buys: true, whale_sells: true, whale_convergence: true,
  convergence_min_whales: 3, smart_money_enabled: true,
  price_alerts_enabled: true, trend_alerts_enabled: true,
  quiet_hours_enabled: false, quiet_start: '22:00', quiet_end: '08:00',
  quiet_timezone: 'UTC', quiet_exceptions: ['convergence'],
  email_backup_enabled: false,
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-[#0A1EFF]' : 'bg-[#2a3040]'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

function SectionCard({ title, icon: Icon, color, children }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#0f1320] border border-[#1a1f2e] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#141824] transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm text-white font-medium">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function fmt(usd: number) {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore'];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [session, setSession] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session: s } } = await sb.auth.getSession();
      if (!s) { setLoading(false); return; }
      setSession(s.access_token);
      const res = await fetch('/api/notifications/settings', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      if (res.ok) {
        const data = await res.json() as Partial<NotifSettings>;
        setSettings(prev => ({ ...prev, ...data }));
      }
      setLoading(false);
    }
    init();
  }, []);

  const set = useCallback(<K extends keyof NotifSettings>(k: K, v: NotifSettings[K]) => {
    setSettings(prev => ({ ...prev, [k]: v }));
  }, []);

  async function save() {
    if (!session) return;
    setSaving(true);
    try {
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#0A1EFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6 pb-32">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Notification Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Control every alert across the platform</p>
        </div>

        {/* 1 — Status */}
        <SectionCard title="Push Status" icon={Bell} color="#0A1EFF">
          <NotificationSetup session={session} compact />
        </SectionCard>

        {/* 2 — Whale Alerts */}
        <SectionCard title="Whale Tracker Alerts" icon={Zap} color="#F59E0B">
          <Row label="Master Toggle" sub="All whale alert types">
            <Toggle on={settings.whale_alerts_enabled} onChange={v => set('whale_alerts_enabled', v)} />
          </Row>
          {settings.whale_alerts_enabled && <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">Minimum Trade Size</span>
                <span className="text-sm font-bold text-[#F59E0B]">{fmt(settings.whale_min_trade_usd)}</span>
              </div>
              <input type="range" min={10000} max={1000000} step={10000}
                value={settings.whale_min_trade_usd}
                onChange={e => set('whale_min_trade_usd', parseInt(e.target.value))}
                className="w-full accent-[#F59E0B]" />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>$10K</span><span>$100K</span><span>$500K</span><span>$1M</span>
              </div>
            </div>
            <Row label="Buy Alerts" sub="When whales enter positions">
              <Toggle on={settings.whale_buys} onChange={v => set('whale_buys', v)} />
            </Row>
            <Row label="Sell Alerts" sub="When whales exit positions">
              <Toggle on={settings.whale_sells} onChange={v => set('whale_sells', v)} />
            </Row>
            <Row label="Convergence Alerts" sub="Multiple whales buying same token">
              <Toggle on={settings.whale_convergence} onChange={v => set('whale_convergence', v)} />
            </Row>
            {settings.whale_convergence && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">Min Whales for Convergence</span>
                  <span className="text-sm font-bold text-[#F59E0B]">{settings.convergence_min_whales} whales</span>
                </div>
                <input type="range" min={2} max={10} step={1}
                  value={settings.convergence_min_whales}
                  onChange={e => set('convergence_min_whales', parseInt(e.target.value))}
                  className="w-full accent-[#F59E0B]" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>2</span><span>4</span><span>6</span><span>8</span><span>10</span>
                </div>
              </div>
            )}
          </>}
        </SectionCard>

        {/* 3 — Smart Money */}
        <SectionCard title="Smart Money Alerts" icon={Brain} color="#7C3AED">
          <Row label="Smart Money Signals" sub="Top wallet entry/exit signals">
            <Toggle on={settings.smart_money_enabled} onChange={v => set('smart_money_enabled', v)} />
          </Row>
        </SectionCard>

        {/* 4 — Price Alerts */}
        <SectionCard title="Price Alerts" icon={TrendingUp} color="#10B981">
          <Row label="Price Target Alerts" sub="When tokens hit your set targets">
            <Toggle on={settings.price_alerts_enabled} onChange={v => set('price_alerts_enabled', v)} />
          </Row>
        </SectionCard>

        {/* 5 — On-Chain Trends */}
        <SectionCard title="On-Chain Trend Alerts" icon={TrendingUp} color="#06B6D4">
          <Row label="Trend Alerts" sub="TVL spikes, volume anomalies, chain metrics">
            <Toggle on={settings.trend_alerts_enabled} onChange={v => set('trend_alerts_enabled', v)} />
          </Row>
        </SectionCard>

        {/* 6 — Quiet Hours */}
        <SectionCard title="Quiet Hours" icon={Clock} color="#8B5CF6">
          <Row label="Enable Quiet Hours" sub="Mute non-critical alerts during sleep">
            <Toggle on={settings.quiet_hours_enabled} onChange={v => set('quiet_hours_enabled', v)} />
          </Row>
          {settings.quiet_hours_enabled && <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start</label>
                <input type="time" value={settings.quiet_start}
                  onChange={e => set('quiet_start', e.target.value)}
                  className="w-full bg-[#141824] border border-[#1a1f2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End</label>
                <input type="time" value={settings.quiet_end}
                  onChange={e => set('quiet_end', e.target.value)}
                  className="w-full bg-[#141824] border border-[#1a1f2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#8B5CF6]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
              <select value={settings.quiet_timezone}
                onChange={e => set('quiet_timezone', e.target.value)}
                className="w-full bg-[#141824] border border-[#1a1f2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#8B5CF6]">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Smart Exceptions (always delivered)</div>
              <div className="flex gap-2 flex-wrap">
                {['convergence', 'price_alert', 'smart_money'].map(exc => {
                  const active = settings.quiet_exceptions.includes(exc);
                  return (
                    <button key={exc} onClick={() => set('quiet_exceptions',
                      active ? settings.quiet_exceptions.filter(x => x !== exc)
                             : [...settings.quiet_exceptions, exc]
                    )} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      active ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                             : 'bg-[#141824] text-gray-500 border border-[#1a1f2e]'
                    }`}>
                      {exc.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </>}
        </SectionCard>

        {/* 7 — Email Backup */}
        <SectionCard title="Email Backup" icon={Mail} color="#F472B6">
          <Row label="Email Notifications" sub="Critical alerts sent to your email when push fails">
            <Toggle on={settings.email_backup_enabled} onChange={v => set('email_backup_enabled', v)} />
          </Row>
          {settings.email_backup_enabled && (
            <p className="text-xs text-gray-500">Email will be sent to your account email address.</p>
          )}
        </SectionCard>
      </div>

      {/* Fixed Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0E1A]/95 backdrop-blur border-t border-[#1a1f2e] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          {saved && (
            <div className="flex items-center gap-2 text-[#10B981] text-sm">
              <CheckCircle className="w-4 h-4" /><span>Settings saved</span>
            </div>
          )}
          {!saved && <span className="text-xs text-gray-600">Changes are not saved automatically</span>}
          <button onClick={save} disabled={saving || !session}
            className="ml-auto flex items-center gap-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
