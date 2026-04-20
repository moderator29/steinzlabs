'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, Tag, ArrowRight } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  tags: string[];
  published_at: string;
  view_count?: number;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export default function PublicResearchPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = category === 'All' ? '' : `?category=${encodeURIComponent(category)}`;
    fetch(`/api/research${q}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ posts: Post[] }> : { posts: [] as Post[] })
      .then(d => { if (!cancelled) setPosts(d.posts ?? []); })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category]);

  const categories = ['All', 'Market', 'Security', 'DeFi', 'On-Chain', 'Macro', 'Research'];

  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="w-4 h-4 text-[#0A1EFF]" /> Research
          </div>
          <Link href="/dashboard" className="text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
            Open App
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <div className="mb-10 pb-8 border-b border-white/[0.06]">
          <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/25 rounded-full px-3 py-1 text-xs text-[#4D6BFF] font-semibold mb-4">
            <BookOpen className="w-3 h-3" /> Naka Labs Research
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">On-chain research, open to everyone.</h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            Deep-dive analyses from the Naka Labs research desk. Tokens, narratives, security incidents, protocol plays. All grounded in on-chain data. Always citable. Always free to read.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                category === c
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 text-base">No research posts yet. Check back soon — the first reports ship shortly.</p>
            <Link href="/dashboard" className="inline-block mt-4 text-sm text-[#4D6BFF] hover:underline">
              Explore the platform instead &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map(p => (
              <Link
                key={p.id}
                href={`/research/${p.id}`}
                className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all"
              >
                {p.image_url && (
                  <div className="aspect-[16/9] overflow-hidden bg-white/[0.03]">
                    <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-500">
                    <Tag className="w-3 h-3" />
                    <span className="uppercase tracking-wide">{p.category}</span>
                    <span className="opacity-30">·</span>
                    <Clock className="w-3 h-3" />
                    <span>{fmtDate(p.published_at)}</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-[#4D6BFF] transition-colors">{p.title}</h2>
                  <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-3">{p.summary}</p>
                  <div className="flex items-center gap-1 text-xs text-[#4D6BFF] font-semibold mt-4">
                    Read post <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Signup CTA */}
        <div className="mt-16 rounded-3xl border border-[#0A1EFF]/25 bg-gradient-to-br from-[#0A1EFF]/10 to-[#8B5CF6]/10 p-8 sm:p-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Want the raw data behind the research?</h3>
          <p className="text-gray-400 text-sm max-w-xl mx-auto mb-6">
            The full intelligence platform — live whale feeds, VTX AI, portfolio tracking, and every security tool — is free to start. Pro unlocks unlimited VTX and copy-trading from $9/mo.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors">
            Open the app <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
