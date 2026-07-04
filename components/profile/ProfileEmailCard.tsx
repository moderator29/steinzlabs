'use client';

import { useEffect, useState } from 'react';
import { Mail, Check, Loader2, Pencil } from 'lucide-react';

/**
 * Profile email row. Wallet-signup / wallet-connect users have a synthetic
 * Supabase auth email ({address}@wallet.nakalabs.xyz) that must NEVER be shown
 * as "their email". This card:
 *   - shows the real auth email for password/email users (verified), OR
 *   - shows the user's saved contact_email, OR
 *   - offers an "Add email" field for wallet users with no contact email yet.
 * Saves to profiles.contact_email via PATCH /api/social/profile/me.
 */
export function ProfileEmailCard() {
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [isWalletUser, setIsWalletUser] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/social/profile/me', { cache: 'no-store' });
        if (!cancelled && res.ok) {
          const j = await res.json() as { contactEmail: string | null; authEmail: string | null; isWalletUser: boolean };
          setAuthEmail(j.authEmail);
          setContactEmail(j.contactEmail);
          setIsWalletUser(j.isWalletUser);
          setDraft(j.contactEmail ?? '');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    const email = draft.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/social/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_email: email }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not save'); }
      setContactEmail(email || null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="glass rounded-lg p-3 mb-3 border border-white/10 flex items-center gap-2 text-gray-500 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading email…
      </div>
    );
  }

  // The email we actually show: real auth email (email/password users) or the
  // saved contact email (wallet users). Never the synthetic wallet address.
  const shownEmail = authEmail ?? contactEmail;

  return (
    <div className="glass rounded-lg p-3 mb-3 border border-white/10">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-[#0066FF] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500">Email</div>
          {editing ? (
            <input
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="you@example.com"
              autoFocus
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0066FF]/50"
            />
          ) : shownEmail ? (
            <div className="text-xs text-gray-300 truncate">{shownEmail}</div>
          ) : (
            <div className="text-xs text-gray-500">No email added yet</div>
          )}
          {error && <div className="text-[10px] text-amber-400 mt-1">{error}</div>}
        </div>

        {/* Right control: verified check for real auth email; edit/add for wallet users. */}
        {authEmail && !editing ? (
          <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
        ) : editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={save} disabled={saving} className="px-2.5 py-1 rounded-lg bg-[#0066FF]/15 border border-[#0066FF]/40 text-[#cfe0ff] text-[11px] font-semibold hover:bg-[#0066FF]/25 disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setDraft(contactEmail ?? ''); setError(null); }} className="px-2 py-1 text-[11px] text-gray-400 hover:text-white">Cancel</button>
          </div>
        ) : (
          // Wallet user (or any user with no auth email) → add / edit contact email.
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0066FF]/15 border border-[#0066FF]/40 text-[#cfe0ff] text-[11px] font-semibold hover:bg-[#0066FF]/25"
          >
            <Pencil className="w-3 h-3" /> {contactEmail ? 'Edit' : 'Add email'}
          </button>
        )}
      </div>
      {isWalletUser && !authEmail && !editing && (
        <p className="text-[10px] text-gray-600 mt-1.5 ms-6">Add an email to receive alerts and recover your account. Optional for wallet users.</p>
      )}
    </div>
  );
}
