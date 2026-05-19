'use client';

import { useState, useEffect, useCallback } from 'react';
// Naka Labs brand icons — User, Shield, Bell, Wallet, Eye, EyeOff,
// AlertTriangle swapped. Loader2 stays on lucide.
import { User, Shield, Bell, Wallet, Eye, EyeOff, AlertTriangle } from '@/components/icons/brand';
import { Loader2, Download, RotateCcw } from 'lucide-react';
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
  // Bio + socials live in auth user_metadata alongside display_name —
  // same persistence pattern as the existing display_name field. No
  // schema change needed; the profile-fields audit asked for these and
  // user_metadata is the path of least friction since updateUser({data})
  // is already the save mechanism.
  const [bio, setBio] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [github, setGithub] = useState('');
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
        setBio(user.user_metadata?.bio ?? '');
        setTwitter(user.user_metadata?.twitter ?? '');
        setDiscord(user.user_metadata?.discord ?? '');
        setGithub(user.user_metadata?.github ?? '');
      }
    });
  }, []);

  // Strip a leading @ from handles so users can paste @phantomfcalls
  // or phantomfcalls and we store the canonical form.
  const cleanHandle = (s: string) => s.trim().replace(/^@+/, '').slice(0, 32);

  const handleSaveProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          bio: bio.slice(0, 280),
          twitter: cleanHandle(twitter),
          discord: cleanHandle(discord),
          github: cleanHandle(github),
        },
      });
      if (error) throw error;
      toast.success('Profile saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileLoading(false);
    }
  }, [displayName, bio, twitter, discord, github]);

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
    { id: 'account', label: 'Account', icon: Download },
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

                  {/* Bio — short free-form description shown on public
                      profile surfaces. 280-char Twitter-style cap so it
                      stays visually balanced in card / hover preview
                      contexts. */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 280))}
                      placeholder="A short description of who you are and what you trade."
                      rows={3}
                      className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF] resize-y"
                    />
                    <p className="text-[10px] text-gray-600 mt-1 text-right">{bio.length} / 280</p>
                  </div>

                  {/* Social handles. Stored without leading @ for a
                      canonical form so links can prepend the platform
                      base URL cleanly. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Twitter / X</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                        <input
                          type="text"
                          value={twitter}
                          onChange={(e) => setTwitter(e.target.value)}
                          placeholder="handle"
                          maxLength={32}
                          className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-7 pr-3 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Discord</label>
                      <input
                        type="text"
                        value={discord}
                        onChange={(e) => setDiscord(e.target.value)}
                        placeholder="username"
                        maxLength={32}
                        className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">GitHub</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                        <input
                          type="text"
                          value={github}
                          onChange={(e) => setGithub(e.target.value)}
                          placeholder="username"
                          maxLength={32}
                          className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-7 pr-3 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                        />
                      </div>
                    </div>
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
                  <p className="text-xs text-gray-400">Preferences are saved automatically.</p>
                </div>
              </div>
            )}

            {activeSection === 'account' && (
              <div className="space-y-4">
                <AccountActionsCard />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountActionsCard() {
  const [replaying, setReplaying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed_at: null })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Onboarding reset — refreshing…');
      setTimeout(() => window.location.assign('/dashboard'), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset onboarding');
    } finally {
      setReplaying(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export', { method: 'GET' });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naka-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Your data export has downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
        <h3 className="text-white font-bold text-lg mb-2">Replay onboarding</h3>
        <p className="text-gray-300 text-sm mb-4">Run the 10-card onboarding flow again to revisit security, wallet, and notification setup.</p>
        <button
          onClick={handleReplay}
          disabled={replaying}
          className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          {replaying ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RotateCcw size={14} aria-hidden />}
          Replay onboarding
        </button>
      </div>

      <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
        <h3 className="text-white font-bold text-lg mb-2">Download my data</h3>
        <p className="text-gray-300 text-sm mb-4">GDPR-compliant export of your profile, watchlists, trades, copy rules, notifications, and preferences as a single JSON file.</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />}
          Download my data
        </button>
      </div>
    </>
  );
}
