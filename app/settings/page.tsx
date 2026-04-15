'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, User, Shield, Bell, Wallet, Key, Moon, Globe, Check } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

const PREFS_KEY = 'steinz_user_preferences';

function loadPrefs() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); } catch { return null; }
}

function savePrefs(prefs: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [saved, setSaved] = useState(false);
  const stored = loadPrefs();
  const [notifications, setNotifications] = useState({
    threats: stored?.threats ?? true,
    whaleAlerts: stored?.whaleAlerts ?? true,
    priceAlerts: stored?.priceAlerts ?? true,
    entityMoves: stored?.entityMoves ?? false,
  });
  const [slippage, setSlippage] = useState(stored?.slippage ?? '1');
  const [theme, setTheme] = useState(stored?.theme ?? 'dark');

  const persist = useCallback(() => {
    savePrefs({ ...notifications, slippage, theme });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [notifications, slippage, theme]);

  useEffect(() => { persist(); }, [notifications, slippage, theme]);

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'trading', label: 'Trading', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Settings" description="Manage your account, security, and trading preferences" />

        <div className="flex gap-6">
          {/* Sidebar Nav */}
          <div className="w-48 flex-shrink-0">
            <div className="bg-[#141824] rounded-lg p-2 border border-[#1E2433]">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-[#0A1EFF] text-white'
                      : 'text-gray-400 hover:bg-[#1E2433] hover:text-white'
                  }`}
                >
                  <section.icon size={16} />
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeSection === 'profile' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Profile Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Display Name</label>
                    <input
                      type="text"
                      placeholder="Enter your name..."
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      placeholder="Enter your email..."
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Wallet Address</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      readOnly
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-gray-400 placeholder-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <button className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium px-6 py-2 rounded-lg">
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Security Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div>
                      <div className="text-white font-medium">Shadow Guardian</div>
                      <div className="text-gray-400 text-sm">AI-powered scam protection on all trades</div>
                    </div>
                    <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div>
                      <div className="text-white font-medium">Two-Factor Authentication</div>
                      <div className="text-gray-400 text-sm">Add extra security to your account</div>
                    </div>
                    <button className="bg-[#0A1EFF] text-white text-sm px-4 py-2 rounded-lg">Enable</button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div>
                      <div className="text-white font-medium">Session Management</div>
                      <div className="text-gray-400 text-sm">Manage active sessions</div>
                    </div>
                    <button className="text-red-400 text-sm hover:text-red-300">Revoke All</button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Notification Preferences</h3>
                <div className="space-y-3">
                  {Object.entries(notifications).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                      <div>
                        <div className="text-white font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {key === 'threats' ? 'Portfolio security threats' :
                           key === 'whaleAlerts' ? 'Large wallet movements' :
                           key === 'priceAlerts' ? 'Price target alerts' : 'Entity trading activity'}
                        </div>
                      </div>
                      <button
                        onClick={() => setNotifications((prev) => ({ ...prev, [key]: !enabled }))}
                        className={`w-12 h-6 rounded-full relative transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'trading' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Trading Preferences</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Default Slippage (%)</label>
                    <div className="flex gap-2">
                      {['0.5', '1', '3', '5'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSlippage(s)}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                            slippage === s
                              ? 'bg-[#0A1EFF] text-white'
                              : 'bg-[#0A0E1A] text-gray-400 border border-[#1E2433]'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div>
                      <div className="text-white font-medium">Expert Mode</div>
                      <div className="text-gray-400 text-sm">Disable confirmation dialogs</div>
                    </div>
                    <div className="w-12 h-6 bg-gray-600 rounded-full relative cursor-pointer">
                      <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5" />
                    </div>
                  </div>
                  <button className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium px-6 py-2 rounded-lg">
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
