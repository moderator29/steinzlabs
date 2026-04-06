'use client';

import { Bell, ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Zap, TrendingUp, Shield, Fish, X, ChevronDown, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { notifyAlertFired } from '@/lib/notifications';

interface Alert {
  id: string;
  name: string;
  type: string;
  condition: string;
  active: boolean;
  triggered: number;
  icon: React.ElementType;
  color: string;
  createdAt: string;
}

interface AlertTemplate {
  name: string;
  type: string;
  icon: React.ElementType;
  color: string;
  conditions: string[];
}

const ALERT_TEMPLATES: AlertTemplate[] = [
  { name: 'Price Alert', type: 'Price', icon: TrendingUp, color: '#10B981', conditions: ['Price crosses above $', 'Price drops below $', 'Price changes by %'] },
  { name: 'Whale Movement', type: 'Whale', icon: Fish, color: '#0A1EFF', conditions: ['Any tx > $1M', 'Any tx > $500K', 'Any tx > $100K'] },
  { name: 'Security Alert', type: 'Security', icon: Shield, color: '#EF4444', conditions: ['Liquidity removal > 50%', 'Contract ownership change', 'Large token mint'] },
  { name: 'Gas Tracker', type: 'Network', icon: Zap, color: '#F59E0B', conditions: ['ETH gas > 100 Gwei', 'ETH gas > 50 Gwei', 'ETH gas drops below 20 Gwei'] },
  { name: 'Volume Spike', type: 'Volume', icon: Activity, color: '#8B5CF6', conditions: ['Volume 5x average', 'Volume 10x average', 'Unusual volume detected'] },
  { name: 'Portfolio Alert', type: 'Portfolio', icon: DollarSign, color: '#0A1EFF', conditions: ['Portfolio value drops 10%', 'Portfolio value up 20%', 'New token received'] },
];

const STORAGE_KEY = 'steinz_alerts';

function loadAlerts(): Alert[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [
    { id: '1', name: 'ETH Price Alert', type: 'Price', condition: 'ETH > $4,000', active: true, triggered: 0, icon: TrendingUp, color: '#10B981', createdAt: new Date().toISOString() },
    { id: '2', name: 'Whale Movement', type: 'Whale', condition: 'Any tx > $1M on ETH', active: true, triggered: 0, icon: Fish, color: '#0A1EFF', createdAt: new Date().toISOString() },
  ];
}

function saveAlerts(alerts: Alert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.map(a => ({ ...a, icon: undefined }))));
  } catch {}
}

function getIcon(type: string): React.ElementType {
  const map: Record<string, React.ElementType> = {
    Price: TrendingUp, Whale: Fish, Security: Shield, Network: Zap, Volume: Activity, Portfolio: DollarSign,
  };
  return map[type] || AlertTriangle;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AlertTemplate | null>(null);
  const [alertName, setAlertName] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loaded = loadAlerts();
    setAlerts(loaded.map(a => ({ ...a, icon: getIcon(a.type) })));
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) saveAlerts(alerts);
  }, [alerts, initialized]);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const createAlert = () => {
    if (!selectedTemplate || !selectedCondition) return;
    const name = alertName || selectedTemplate.name;
    const newAlert: Alert = {
      id: Date.now().toString(),
      name,
      type: selectedTemplate.type,
      condition: selectedCondition,
      active: true,
      triggered: 0,
      icon: selectedTemplate.icon,
      color: selectedTemplate.color,
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [...prev, newAlert]);

    // Fire an in-app notification confirming alert creation
    const alertTypeMap: Record<string, 'whale_alert' | 'price_target' | 'new_launch' | 'wallet_activity'> = {
      Whale: 'whale_alert',
      Price: 'price_target',
      Volume: 'price_target',
      Security: 'whale_alert',
      Network: 'wallet_activity',
      Portfolio: 'wallet_activity',
    };
    const notifType = alertTypeMap[selectedTemplate.type] || 'wallet_activity';
    notifyAlertFired(
      notifType,
      `Alert Created: ${name}`,
      `Your alert "${name}" is now active. Condition: ${selectedCondition}`
    );

    setShowCreate(false);
    setSelectedTemplate(null);
    setAlertName('');
    setSelectedCondition('');
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Bell className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Smart Alerts</h1>
          <button onClick={() => setShowCreate(true)} className="ml-auto bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] p-2 rounded-lg">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#0A1EFF]">{alerts.filter(a => a.active).length}</div>
            <div className="text-[10px] text-gray-500">Active</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-gray-400">{alerts.filter(a => !a.active).length}</div>
            <div className="text-[10px] text-gray-500">Paused</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#F59E0B]">{alerts.reduce((sum, a) => sum + a.triggered, 0)}</div>
            <div className="text-[10px] text-gray-500">Triggered</div>
          </div>
        </div>

        {alerts.length === 0 && (
          <div className="glass rounded-xl p-8 border border-white/10 text-center">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">No alerts yet</p>
            <p className="text-xs text-gray-500 mb-4">Create your first smart alert to monitor the market</p>
            <button onClick={() => setShowCreate(true)} className="bg-[#0A1EFF] px-4 py-2 rounded-lg text-xs font-semibold">
              Create Alert
            </button>
          </div>
        )}

        <div className="space-y-2">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <div key={alert.id} className={`glass rounded-xl p-4 border transition-all ${alert.active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${alert.color}20` }}>
                      <Icon className="w-4 h-4" style={{ color: alert.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{alert.name}</div>
                      <div className="text-[10px] text-gray-500">{alert.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleAlert(alert.id)}>
                      {alert.active ? <ToggleRight className="w-6 h-6 text-[#10B981]" /> : <ToggleLeft className="w-6 h-6 text-gray-600" />}
                    </button>
                    <button onClick={() => deleteAlert(alert.id)} className="p-1 hover:bg-white/10 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-400 bg-white/5 px-2 py-1 rounded font-mono">{alert.condition}</div>
                  {alert.triggered > 0 && (
                    <span className="text-[10px] text-gray-500">{alert.triggered} triggers</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full bg-[#0D1117] rounded-t-2xl border-t border-white/[0.06] z-10 max-h-[80vh] overflow-y-auto pb-8">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Create Alert</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {!selectedTemplate ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-3">Choose alert type</p>
                  {ALERT_TEMPLATES.map(template => (
                    <button
                      key={template.name}
                      onClick={() => { setSelectedTemplate(template); setAlertName(template.name); }}
                      className="w-full text-left p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:border-[#0A1EFF]/30 transition-all flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${template.color}20` }}>
                        <template.icon className="w-5 h-5" style={{ color: template.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{template.name}</div>
                        <div className="text-[10px] text-gray-500">{template.type} monitoring</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setSelectedTemplate(null)} className="text-xs text-[#0A1EFF] flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Back to types
                  </button>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Alert Name</label>
                    <input
                      type="text"
                      value={alertName}
                      onChange={e => setAlertName(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A1EFF]/40"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-2">Condition</label>
                    <div className="space-y-2">
                      {selectedTemplate.conditions.map(cond => (
                        <button
                          key={cond}
                          onClick={() => setSelectedCondition(cond)}
                          className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                            selectedCondition === cond
                              ? 'border-[#0A1EFF]/40 bg-[#0A1EFF]/10 text-white'
                              : 'border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-white/20'
                          }`}
                        >
                          {cond}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={createAlert}
                    disabled={!selectedCondition}
                    className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                  >
                    Create Alert
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
