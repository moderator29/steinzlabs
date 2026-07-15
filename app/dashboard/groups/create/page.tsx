'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Lock, ShieldQuestion, Check, ArrowRight, Loader2, Users } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

/**
 * Group create flow — a clean three-step wizard (Identity → Privacy → Invite),
 * full page (no popup). Friends here are mutual follows who allow invites.
 */

interface Friend { id: string; username: string | null; display_name: string | null; avatar_url: string | null; }
type Privacy = 'public' | 'invite' | 'request';

const PRIVACY_OPTS: { value: Privacy; label: string; desc: string; Icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', desc: 'Anyone can find and join.', Icon: Globe },
  { value: 'request', label: 'Request to join', desc: 'People ask; you approve.', Icon: ShieldQuestion },
  { value: 'invite', label: 'Invite only', desc: 'Friends or the group link only.', Icon: Lock },
];

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invite, setInvite] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/groups/friends', { cache: 'no-store' }); const j = await r.json(); setFriends(Array.isArray(j.friends) ? j.friends : []); } catch { /* ignore */ }
    })();
  }, []);

  const toggleFriend = (id: string) => setInvite((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, privacy, invite: Array.from(invite) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j?.error || 'Could not create group'); return; }
      router.push(`/dashboard/groups/${j.group.slug}`);
    } catch { setError('Network error'); } finally { setBusy(false); }
  };

  const canNext = step === 1 ? name.trim().length > 0 : true;

  return (
    <div className="min-h-screen text-white max-w-lg mx-auto px-4 py-5 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/groups" />
        <h1 className="text-lg font-bold inline-flex items-center gap-2"><Users className="w-5 h-5 text-[#7FB2FF]" /> New group</h1>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: s <= step ? 'linear-gradient(90deg,#1E90FF,#0066FF)' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-white/80">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Alpha Callers" className="mt-1.5 w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 text-base text-white placeholder:text-white/35 outline-none focus:border-[#0066FF]/50" />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-white/80">Description <span className="text-white/40 font-normal">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="What is this group about?" className="mt-1.5 w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#0066FF]/50 resize-none" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2.5">
          {PRIVACY_OPTS.map(({ value, label, desc, Icon }) => {
            const active = privacy === value;
            return (
              <button key={value} type="button" onClick={() => setPrivacy(value)} className={`w-full flex items-center gap-3 rounded-2xl p-3.5 border text-left transition-colors ${active ? 'bg-[#0066FF]/12 border-[#0066FF]/45' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'}`}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-[#0066FF]/20 text-[#7FB2FF]' : 'bg-white/[0.05] text-white/60'}`}><Icon className="w-4 h-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">{label}</span>
                  <span className="block text-[12px] text-white/50">{desc}</span>
                </span>
                {active ? <Check className="w-4 h-4 text-[#7FB2FF] shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-[13px] text-white/60 mb-3">Invite friends (people you both follow who allow invites). You can add more later.</p>
          {friends.length === 0 ? (
            <div className="nl-glass rounded-2xl p-5 text-center text-white/50 text-sm">No friends to invite yet. You can share the group link after creating.</div>
          ) : (
            <div className="space-y-1.5 max-h-[46vh] overflow-y-auto">
              {friends.map((f) => {
                const on = invite.has(f.id);
                const nm = f.display_name || f.username || 'Member';
                return (
                  <button key={f.id} type="button" onClick={() => toggleFriend(f.id)} className={`w-full flex items-center gap-3 rounded-xl p-2.5 border transition-colors ${on ? 'bg-[#0066FF]/12 border-[#0066FF]/40' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'}`}>
                    {f.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{nm.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[14px] font-semibold text-white truncate">{nm}</span>
                      {f.username ? <span className="block text-[12px] text-white/45 truncate">@{f.username}</span> : null}
                    </span>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${on ? 'bg-[#0066FF] border-[#0066FF]' : 'border-white/25'}`}>{on ? <Check className="w-3 h-3 text-white" /> : null}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error ? <div className="mt-4 text-sm text-rose-400">{error}</div> : null}

      <div className="mt-6 flex items-center gap-2">
        {step > 1 ? <button type="button" onClick={() => setStep((s) => s - 1)} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white/80 bg-white/[0.05] border border-white/10">Back</button> : null}
        {step < 3 ? (
          <button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="ms-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" disabled={busy || !name.trim()} onClick={create} className="ms-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: '0 6px 20px rgba(0,102,255,.35)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create group
          </button>
        )}
      </div>
    </div>
  );
}
