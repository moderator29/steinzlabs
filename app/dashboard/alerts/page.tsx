'use client';

import { Bell, ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Zap, TrendingUp, Shield, Fish } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Alert {
  id: string;
  name: string;
  type: string;
  condition: string;
  active: boolean;
  triggered: number;
  icon: React.ElementType;
  color: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', name: 'ETH Price Alert', type: 'Price', condition: 'ETH > $4,000', active: true, triggered: 3, icon: TrendingUp, color: '#10B981' },
    { id: '2', name: 'Whale Movement', type: 'Whale', condition: 'Any tx > $1M on ETH', active: true, triggered: 12, icon: Fish, color: '#0A1EFF' },
    { id: '3', name: 'Rug Pull Warning', type: 'Security', condition: 'Liquidity removal > 50%', active: true, triggered: 1, icon: Shield, color: '#EF4444' },
    { id: '4', name: 'Gas Spike Alert', type: 'Network', condition: 'ETH gas > 100 Gwei', active: false, triggered: 8, icon: Zap, color: '#F59E0B' },
  ]);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
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
          <button className="ml-auto bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] p-2 rounded-lg">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#0A1EFF]">{alerts.filter(a => a.active).length}</div>
            <div className="text-[10px] text-gray-500">Active</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#F59E0B]">{alerts.reduce((sum, a) => sum + a.triggered, 0)}</div>
            <div className="text-[10px] text-gray-500">Triggered (24h)</div>
          </div>
        </div>

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
                    <button onClick={() => deleteAlert(alert.id)} className="text-gray-600 hover:text-[#EF4444] transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 font-mono">{alert.condition}</span>
                  <span className="text-gray-500">{alert.triggered}x triggered</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
