'use client';

import { useState } from 'react';
import { Bell, Plus, Trash2, TrendingUp, Shield, Users, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

const ALERT_TYPES = [
  { value: 'PRICE', label: 'Price Alert', icon: TrendingUp, description: 'Alert when token price hits target' },
  { value: 'VOLUME', label: 'Volume Spike', icon: TrendingUp, description: 'Alert on unusual volume changes' },
  { value: 'WHALE', label: 'Whale Move', icon: Users, description: 'Alert when whales buy or sell' },
  { value: 'ENTITY_MOVEMENT', label: 'Entity Activity', icon: Users, description: 'Alert when tracked entity trades' },
  { value: 'SCAMMER', label: 'Scammer Detection', icon: Shield, description: 'Alert when scammer enters holdings' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [alertType, setAlertType] = useState('PRICE');
  const [condition, setCondition] = useState({ token: '', threshold: '', direction: 'above' });

  const createAlert = () => {
    if (!condition.token) return;
    const newAlert = {
      id: Date.now().toString(),
      alert_type: alertType,
      condition,
      active: true,
      created_at: new Date().toISOString(),
    };
    setAlerts((prev) => [newAlert, ...prev]);
    setShowForm(false);
    setCondition({ token: '', threshold: '', direction: 'above' });
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Alerts"
          description="Set custom alerts for prices, whale moves, entity activity, and scammer detection"
        />

        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-500 text-sm font-medium">{alerts.filter((a) => a.active).length} Active Alerts</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium px-5 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            New Alert
          </button>
        </div>

        {/* New Alert Form */}
        {showForm && (
          <div className="bg-[#141824] rounded-lg p-6 border border-[#0A1EFF] mb-6">
            <h3 className="text-white font-bold text-lg mb-4">Create Alert</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {ALERT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setAlertType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    alertType === type.value
                      ? 'border-[#0A1EFF] bg-[#0A1EFF]/10'
                      : 'border-[#1E2433] hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <type.icon size={16} className={alertType === type.value ? 'text-[#0A1EFF]' : 'text-gray-400'} />
                    <span className="text-white font-medium text-sm">{type.label}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{type.description}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={condition.token}
                onChange={(e) => setCondition({ ...condition, token: e.target.value })}
                placeholder="Token address or symbol..."
                className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
              />
              {(alertType === 'PRICE' || alertType === 'VOLUME') && (
                <div className="flex gap-3">
                  <select
                    value={condition.direction}
                    onChange={(e) => setCondition({ ...condition, direction: e.target.value })}
                    className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#0A1EFF]"
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                  <input
                    type="number"
                    value={condition.threshold}
                    onChange={(e) => setCondition({ ...condition, threshold: e.target.value })}
                    placeholder={alertType === 'PRICE' ? 'Price (USD)' : 'Volume threshold'}
                    className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={createAlert}
                className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium px-6 py-2 rounded-lg"
              >
                Create Alert
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="bg-[#1E2433] text-gray-400 hover:text-white px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Bell size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No alerts configured</p>
            <p className="text-sm mt-2">Create an alert to get notified on important events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const type = ALERT_TYPES.find((t) => t.value === alert.alert_type);
              return (
                <div key={alert.id} className="bg-[#141824] rounded-lg p-4 border border-[#1E2433] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${alert.active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    <div>
                      <div className="text-white font-medium">{type?.label || alert.alert_type}</div>
                      <div className="text-gray-400 text-sm">
                        {alert.condition.token} — {alert.condition.direction} {alert.condition.threshold}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
