'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Shield, Bell, Wallet, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
  const [displayName, setDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const stored = loadPrefs();
  const [notifications, setNotifications] = useState({
    threats: stored?.threats ?? true,
    whaleAlerts: stored?.whaleAlerts ?? true,
    priceAlerts: stored?.priceAlerts ?? true,
    entityMoves: stored?.entityMoves ?? false,
  });
  const [browserPushEnabled, setBrowserPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
      setBrowserPushEnabled(Notification.permission === 'granted');
    }
  }, []);
  const [slippage, setSlippage] = useState(stored?.slippage ?? '1');
  const [theme, setTheme] = useState(stored?.theme ?? 'dark');
  const [expertMode, setExpertMode] = useState<boolean>(stored?.expertMode ?? false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || '');
        setDisplayName(user.user_metadata?.display_name || user.user_metadata?.full_name || '');
      }
    });
  }, []);

  const handleSaveProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) throw error;
      toast.success('Profile saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileLoading(false);
    }
  }, [displayName]);

  const handleChangePassword = useCallback(async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  }, [newPassword, confirmPassword]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error('Delete failed');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleteLoading(false);
    }
  }, [deleteConfirm]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    savePrefs({ ...notifications, slippage, theme, expertMode });
    const timer = setTimeout(() => {
      supabase.from('user_preferences').upsert({
        whale_alerts: notifications.whaleAlerts,
        price_alerts: notifications.priceAlerts,
        security_alerts: notifications.threats,
        entity_moves: notifications.entityMoves,
        default_slippage: slippage,
        theme,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('[Settings] Failed to sync to Supabase:', error.message);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [notifications, slippage, theme, expertMode, mounted]);

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'trading', label: 'Trading', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Settings" description="Manage your account, security, and trading preferences" />

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Sidebar Nav — horizontal scroll chips on mobile, vertical on md+ */}
          <div className="w-full md:w-48 md:flex-shrink-0">
            <div className="bg-[#141824] rounded-lg p-2 border border-[#1E2433] flex md:block gap-1 md:gap-0 overflow-x-auto md:overflow-visible">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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
          <div className="flex-1 min-w-0">
            {activeSection === 'profile' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Profile Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name..."
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={userEmail}
                      readOnly
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-600 mt-1">Email cannot be changed from this page.</p>
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
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                  >
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-4">
                {/* Change Password */}
                <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                  <h3 className="text-white font-bold text-lg mb-4">Change Password</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF] pr-10"
                        />
                        <button onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={passwordLoading || !newPassword}
                      className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                    >
                      {passwordLoading && <Loader2 size={14} className="animate-spin" />}
                      Update Password
                    </button>
                  </div>
                </div>

                {/* Delete Account */}
                <div className="bg-[#141824] rounded-lg p-6 border border-red-900/40">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-red-400 font-bold text-lg">Delete Account</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">This action is irreversible. All your data will be permanently deleted.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Type <span className="text-white font-mono">DELETE</span> to confirm</label>
                      <input
                        type="text"
                        value={deleteConfirm}
                        onChange={e => setDeleteConfirm(e.target.value)}
                        placeholder="DELETE"
                        className="w-full bg-[#0A0E1A] border border-red-900/40 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500/60"
                      />
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || deleteConfirm !== 'DELETE'}
                      className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 hover:text-white border border-red-600/40 font-medium px-6 py-2 rounded-lg transition-colors"
                    >
                      {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                      Permanently Delete My Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <h3 className="text-white font-bold text-lg mb-6">Notification Preferences</h3>
                <div className="space-y-3">
                  {/* Browser push notifications */}
                  <div className="flex items-center justify-between p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div>
                      <div className="text-white font-medium">Browser Push Notifications</div>
                      <div className="text-gray-400 text-sm">
                        {pushPermission === 'denied' ? 'Blocked by browser — allow in site settings' : 'Instant alerts in your browser'}
                      </div>
                    </div>
                    <button
                      disabled={pushPermission === 'denied'}
                      onClick={async () => {
                        if (pushPermission === 'granted') {
                          setBrowserPushEnabled(false);
                        } else {
                          const result = await Notification.requestPermission();
                          setPushPermission(result);
                          setBrowserPushEnabled(result === 'granted');
                        }
                      }}
                      className={`w-12 h-6 rounded-full relative transition-colors disabled:opacity-40 ${browserPushEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${browserPushEnabled ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
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
                  <div className="flex items-center justify-between gap-4 p-4 bg-[#0A0E1A] rounded-lg border border-[#1E2433]">
                    <div className="min-w-0">
                      <div className="text-white font-medium">Expert Mode</div>
                      <div className="text-gray-400 text-sm">Disable confirmation dialogs</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpertMode((v) => !v)}
                      aria-pressed={expertMode}
                      className={`flex-shrink-0 w-12 h-6 rounded-full relative transition-colors ${expertMode ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${expertMode ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Preferences are saved automatically.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
