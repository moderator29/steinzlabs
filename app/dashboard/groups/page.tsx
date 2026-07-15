'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Plus, Lock, Globe, ShieldQuestion, ChevronRight } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Group { id: string; name: string; slug: string; description: string | null; avatar_url: string | null; privacy: string; member_count: number; myStatus?: string; }

function PrivacyIcon({ p }: { p: string }) {
  if (p === 'public') return <Globe className="w-3.5 h-3.5" />;
  if (p === 'request') return <ShieldQuestion className="w-3.5 h-3.5" />;
  return <Lock className="w-3.5 h-3.5" />;
}

function GroupCard({ g, i = 0 }: { g: Group; i?: number }) {
  const initial = g.name.trim().charAt(0).toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -2 }}>
    <Link href={`/dashboard/groups/${g.slug}`} className="flex items-center gap-3 nl-glass rounded-2xl p-3 hover:bg-white/[0.05] transition-colors" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.14)' }}>
      {g.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={g.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#7C3AED)' }}>{initial}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-white truncate">{g.name}</div>
        <div className="text-[12px] text-white/45 inline-flex items-center gap-1.5">
          <PrivacyIcon p={g.privacy} /> <span className="capitalize">{g.privacy}</span> · {g.member_count} member{g.member_count === 1 ? '' : 's'}
          {g.myStatus && g.myStatus !== 'active' ? <span className="ms-1 text-[#7FB2FF] capitalize">· {g.myStatus}</span> : null}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
    </Link>
    </motion.div>
  );
}

export default function GroupsPage() {
  const [mine, setMine] = useState<Group[] | null>(null);
  const [discover, setDiscover] = useState<Group[]>([]);
  const [allowInvites, setAllowInvites] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/groups', { cache: 'no-store' });
        const j = await r.json();
        setMine(Array.isArray(j.mine) ? j.mine : []);
        setDiscover(Array.isArray(j.discover) ? j.discover : []);
        setAllowInvites(j.allowGroupInvites !== false);
      } catch { setMine([]); }
    })();
  }, []);

  const toggleInvites = async (next: boolean) => {
    setAllowInvites(next); // optimistic
    try {
      await fetch('/api/social/profile/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow_group_invites: next }) });
    } catch { setAllowInvites(!next); }
  };

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 py-5 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" />
        <h1 className="text-lg font-bold inline-flex items-center gap-2"><Users className="w-5 h-5 text-[#7FB2FF]" /> Groups</h1>
        <Link href="/dashboard/groups/create" className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: '0 6px 20px rgba(0,102,255,.35)' }}>
          <Plus className="w-4 h-4" /> Create
        </Link>
      </div>

      {/* Invite consent: let friends add me to groups without asking. */}
      <label className="flex items-center gap-3 nl-glass rounded-2xl p-3.5 mb-5 cursor-pointer">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-white">Let friends add me to groups</span>
          <span className="block text-[12px] text-white/45">When off, friends must send an invite you accept first.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allowInvites}
          onClick={() => toggleInvites(!allowInvites)}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${allowInvites ? 'bg-[#0066FF]' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${allowInvites ? 'translate-x-5' : ''}`} />
        </button>
      </label>

      <section className="mb-6">
        <h2 className="text-[13px] font-semibold text-white/70 mb-2 px-0.5">Your groups</h2>
        {mine === null ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-white/[0.03] animate-pulse" />)}</div>
        ) : mine.length === 0 ? (
          <div className="nl-glass rounded-2xl p-5 text-center text-white/50 text-sm">You are not in any group yet. Create one or join from Discover.</div>
        ) : (
          <div className="space-y-2">{mine.map((g, i) => <GroupCard key={g.id} g={g} i={i} />)}</div>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold text-white/70 mb-2 px-0.5">Discover</h2>
        {discover.length === 0 ? (
          <div className="nl-glass rounded-2xl p-5 text-center text-white/50 text-sm">No public groups yet. Be the first to create one.</div>
        ) : (
          <div className="space-y-2">{discover.map((g, i) => <GroupCard key={g.id} g={g} i={i} />)}</div>
        )}
      </section>
    </div>
  );
}
