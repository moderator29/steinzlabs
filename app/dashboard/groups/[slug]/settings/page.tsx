'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Lock, ShieldQuestion, Check, Loader2, Trash2, UserPlus, Copy } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Group { id: string; name: string; slug: string; description: string | null; privacy: string; invite_code?: string; owner_id: string; }
interface Member { user_id: string; role: string; status: string; profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null; }
interface Friend { id: string; username: string | null; display_name: string | null; avatar_url: string | null; }
type Privacy = 'public' | 'invite' | 'request';

const PRIVACY_OPTS: { value: Privacy; label: string; Icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', Icon: Globe },
  { value: 'request', label: 'Request', Icon: ShieldQuestion },
  { value: 'invite', label: 'Invite only', Icon: Lock },
];

export default function GroupSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/groups/${slug}`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !j.group) { router.replace('/dashboard/groups'); return; }
    setGroup(j.group); setName(j.group.name); setDescription(j.group.description ?? ''); setPrivacy(j.group.privacy);
    const [mr, fr] = await Promise.all([
      fetch(`/api/groups/${j.group.id}/members`, { cache: 'no-store' }).then((x) => x.json()).catch(() => ({})),
      fetch('/api/groups/friends', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({})),
    ]);
    setMembers(Array.isArray(mr.members) ? mr.members : []);
    setFriends(Array.isArray(fr.friends) ? fr.friends : []);
  }, [slug, router]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!group) return;
    setSaving(true);
    try { await fetch(`/api/groups/${group.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), description: description.trim(), privacy }) }); await load(); } finally { setSaving(false); }
  };

  const memberAction = async (action: string, userId?: string) => {
    if (!group) return;
    await fetch(`/api/groups/${group.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, userId }) });
    await load();
  };
  const invite = async (userId: string) => {
    if (!group) return;
    await fetch(`/api/groups/${group.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', userIds: [userId] }) });
    await load();
  };
  const del = async () => {
    if (!group || !confirm('Delete this group? This cannot be undone.')) return;
    await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    router.replace('/dashboard/groups');
  };

  const copyLink = async () => {
    if (!group?.invite_code) return;
    const url = `${window.location.origin}/dashboard/groups/${slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  if (!group) return <div className="min-h-screen flex items-center justify-center text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const isOwner = true; // page only reachable by managers; owner-only actions guarded server-side
  const memberIds = new Set(members.map((m) => m.user_id));
  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const invitable = friends.filter((f) => !memberIds.has(f.id));

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 py-5 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href={`/dashboard/groups/${slug}`} />
        <h1 className="text-lg font-bold">Group settings</h1>
      </div>

      {/* Identity */}
      <section className="nl-glass rounded-2xl p-4 mb-4 space-y-3">
        <div>
          <label className="text-[13px] font-semibold text-white/80">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="mt-1.5 w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 text-base text-white outline-none focus:border-[#0066FF]/50" />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-white/80">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className="mt-1.5 w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-[#0066FF]/50 resize-none" />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-white/80">Privacy</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {PRIVACY_OPTS.map(({ value, label, Icon }) => (
              <button key={value} type="button" onClick={() => setPrivacy(value)} className={`flex flex-col items-center gap-1 rounded-xl py-2.5 border text-[12px] font-semibold ${privacy === value ? 'bg-[#0066FF]/12 border-[#0066FF]/45 text-white' : 'bg-white/[0.03] border-white/10 text-white/60'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={save} disabled={saving} className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white inline-flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</button>
      </section>

      {/* Invite link */}
      <section className="nl-glass rounded-2xl p-4 mb-4">
        <div className="text-[13px] font-semibold text-white/80 mb-2">Share link</div>
        <button type="button" onClick={copyLink} className="w-full flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-[13px] text-white/80">
          <Copy className="w-4 h-4 text-[#7FB2FF]" /> <span className="truncate">nakalabs.xyz/dashboard/groups/{slug}</span>
          <span className="ms-auto text-[12px] text-[#7FB2FF]">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </section>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section className="nl-glass rounded-2xl p-4 mb-4">
          <div className="text-[13px] font-semibold text-white/80 mb-2">Requests ({pending.length})</div>
          <div className="space-y-1.5">
            {pending.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{(m.profile?.display_name || m.profile?.username || '?').charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1 text-[14px] text-white truncate">{m.profile?.display_name || m.profile?.username || 'Member'}</span>
                <button type="button" onClick={() => memberAction('approve', m.user_id)} className="text-[12px] font-semibold text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">Approve</button>
                <button type="button" onClick={() => memberAction('remove', m.user_id)} className="text-[12px] font-semibold text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25">Deny</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite friends */}
      {invitable.length > 0 && (
        <section className="nl-glass rounded-2xl p-4 mb-4">
          <div className="text-[13px] font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-[#7FB2FF]" /> Invite friends</div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {invitable.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{(f.display_name || f.username || '?').charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1 text-[14px] text-white truncate">{f.display_name || f.username || 'Friend'}</span>
                <button type="button" onClick={() => invite(f.id)} className="text-[12px] font-semibold text-[#7FB2FF] px-2.5 py-1 rounded-lg bg-[#0066FF]/12 border border-[#0066FF]/30">Invite</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section className="nl-glass rounded-2xl p-4 mb-4">
        <div className="text-[13px] font-semibold text-white/80 mb-2">Members ({active.length})</div>
        <div className="space-y-1.5">
          {active.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{(m.profile?.display_name || m.profile?.username || '?').charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1 text-[14px] text-white truncate">{m.profile?.display_name || m.profile?.username || 'Member'}</span>
              <span className="text-[11px] text-white/40 capitalize">{m.role}</span>
              {m.user_id !== group.owner_id ? <button type="button" onClick={() => memberAction('remove', m.user_id)} className="text-[12px] text-rose-300/80 hover:text-rose-300">Remove</button> : null}
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <button type="button" onClick={del} className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/25 inline-flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete group</button>
      )}
    </div>
  );
}
