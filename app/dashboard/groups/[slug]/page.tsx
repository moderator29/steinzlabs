'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Lock, Globe, ShieldQuestion, Settings, Share2, Loader2, Check } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { renderRichText } from '@/lib/wire/richText';
import { GroupComposer } from '@/components/groups/GroupComposer';

interface Group { id: string; name: string; slug: string; description: string | null; avatar_url: string | null; privacy: string; member_count: number; owner_id: string; invite_code?: string; }
type Membership = { role: string; status: string } | null;
interface Author { id: string; username: string | null; display_name: string | null; avatar_url: string | null; }
interface Msg { id: string; author_id: string; body: string; media_urls: string[]; created_at: string; author: Author | null; }

function PrivacyIcon({ p }: { p: string }) {
  if (p === 'public') return <Globe className="w-3.5 h-3.5" />;
  if (p === 'request') return <ShieldQuestion className="w-3.5 h-3.5" />;
  return <Lock className="w-3.5 h-3.5" />;
}

export default function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<Membership>(null);
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const active = membership?.status === 'active';
  const manager = active && (membership?.role === 'owner' || membership?.role === 'admin');

  const loadGroup = useCallback(async () => {
    try {
      const r = await fetch(`/api/groups/${slug}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setGroup(j.group); setMembership(j.membership); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [slug]);

  const loadMsgs = useCallback(async (gid: string) => {
    try { const r = await fetch(`/api/groups/${gid}/messages`, { cache: 'no-store' }); const j = await r.json(); setMsgs(Array.isArray(j.messages) ? j.messages : []); } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadGroup(); }, [loadGroup]);
  useEffect(() => { if (group && active) void loadMsgs(group.id); }, [group, active, loadMsgs]);
  useEffect(() => { if (active) endRef.current?.scrollIntoView(); }, [msgs.length, active]);
  // Light polling while viewing the group chat.
  useEffect(() => {
    if (!group || !active) return;
    const t = setInterval(() => void loadMsgs(group.id), 15_000);
    return () => clearInterval(t);
  }, [group, active, loadMsgs]);

  const join = async (action: 'join' | 'request' | 'accept_invite') => {
    if (!group) return;
    setJoining(true);
    try { await fetch(`/api/groups/${group.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); await loadGroup(); } catch { /* ignore */ } finally { setJoining(false); }
  };

  const share = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/groups/${slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!group) return <div className="min-h-screen flex items-center justify-center text-white/50 text-sm">Group not found.</div>;

  const initial = group.name.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-[#080b14]/85 backdrop-blur-xl border-b border-[#0066FF]/20">
        <BackButton href="/dashboard/groups" />
        {group.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#7C3AED)' }}>{initial}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white truncate">{group.name}</div>
          <div className="text-[11px] text-white/45 inline-flex items-center gap-1"><PrivacyIcon p={group.privacy} /><span className="capitalize">{group.privacy}</span> · {group.member_count} member{group.member_count === 1 ? '' : 's'}</div>
        </div>
        <button type="button" onClick={share} aria-label="Share group" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06]">{copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}</button>
        {manager ? <Link href={`/dashboard/groups/${slug}/settings`} aria-label="Group settings" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06]"><Settings className="w-4 h-4" /></Link> : null}
      </div>

      {!active ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 gap-4">
          <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#7C3AED)', boxShadow: '0 0 34px rgba(0,102,255,.5)' }}>{initial}</motion.div>
          <div>
            <div className="text-lg font-bold text-white">{group.name}</div>
            {group.description ? <p className="text-sm text-white/55 mt-1 max-w-sm">{group.description}</p> : null}
            <div className="text-[12px] text-white/40 mt-1 inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {group.member_count} member{group.member_count === 1 ? '' : 's'}</div>
          </div>
          {membership?.status === 'pending' ? (
            <div className="text-sm text-[#7FB2FF]">Your request is pending approval.</div>
          ) : membership?.status === 'invited' ? (
            <button type="button" disabled={joining} onClick={() => join('accept_invite')} className="px-6 py-2.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>{joining ? '…' : 'Accept invite'}</button>
          ) : group.privacy === 'public' ? (
            <button type="button" disabled={joining} onClick={() => join('join')} className="px-6 py-2.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>{joining ? '…' : 'Join group'}</button>
          ) : group.privacy === 'request' ? (
            <button type="button" disabled={joining} onClick={() => join('request')} className="px-6 py-2.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}>{joining ? '…' : 'Request to join'}</button>
          ) : (
            <div className="text-sm text-white/50">This group is invite only.</div>
          )}
        </motion.div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
            {msgs.length === 0 ? (
              <div className="text-center text-white/45 text-sm py-10">No messages yet. Say hi to the group.</div>
            ) : msgs.map((m) => {
              const nm = m.author?.display_name || m.author?.username || 'Member';
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex gap-2.5"
                >
                  {m.author?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.author.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{nm.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]"><span className="font-semibold text-white">{nm}</span></div>
                    {m.body ? <div className="text-[14px] text-white/90 whitespace-pre-wrap break-words leading-relaxed">{renderRichText(m.body)}</div> : null}
                    {m.media_urls?.length ? (
                      <div className={`mt-1.5 grid gap-1 rounded-xl overflow-hidden border border-white/10 ${m.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m.media_urls.slice(0, 4).map((u) => <img key={u} src={u} alt="" className="w-full max-h-[300px] object-cover" />)}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </div>
          <GroupComposer groupId={group.id} onSent={(m) => setMsgs((prev) => [...prev, m as unknown as Msg])} />
        </>
      )}
    </div>
  );
}
