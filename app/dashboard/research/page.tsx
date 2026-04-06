'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FlaskConical, BookOpen, Tag, Calendar,
  ChevronRight, Search, Loader2, ExternalLink
} from 'lucide-react';

interface ResearchPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
}

const CATEGORIES = ['All', 'DeFi', 'Security', 'Market Analysis', 'Protocols', 'On-Chain', 'General'];

export default function ResearchPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ResearchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<ResearchPost | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (category !== 'All') params.set('category', category);
      const res = await fetch(`/api/research?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [category, page]);

  const filtered = posts.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.summary.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  if (selected) {
    return (
      <div className="min-h-screen bg-[#060A12] text-white pb-20">
        <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setSelected(null)} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-500 font-mono">{selected.category}</span>
          </div>
        </div>
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {selected.image_url && (
            <img
              src={selected.image_url}
              alt={selected.title}
              className="w-full rounded-2xl object-cover max-h-48"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#0A1EFF]/10 text-blue-300 border border-[#0A1EFF]/20">
                {selected.category}
              </span>
              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(selected.published_at)}
              </span>
            </div>
            <h1 className="text-xl font-bold font-heading leading-tight mb-3">{selected.title}</h1>
            {selected.summary && (
              <p className="text-sm text-gray-400 leading-relaxed border-l-2 border-[#0A1EFF]/30 pl-3 mb-4">{selected.summary}</p>
            )}
            <div className="prose prose-invert prose-sm max-w-none">
              {selected.content.split('\n').map((line, i) => (
                <p key={i} className={`text-sm leading-relaxed mb-2 ${line.startsWith('#') ? 'text-base font-bold text-white' : 'text-gray-400'}`}>
                  {line.replace(/^#+\s/, '')}
                </p>
              ))}
            </div>
          </div>
          {selected.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1a1f2e]">
              {selected.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/5 p-2 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-heading font-bold">Research Lab</h1>
            <p className="text-[10px] text-gray-500">Intelligence reports and analysis</p>
          </div>
          <span className="ml-auto px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg text-[9px] font-bold">NEW</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search research..."
            className="w-full bg-[#0f1320] border border-[#1a1f2e] rounded-xl pl-9 pr-4 py-2.5 text-xs placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                category === cat
                  ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-blue-300'
                  : 'bg-[#0f1320] border-[#1a1f2e] text-gray-500 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#0A1EFF] animate-spin" />
          </div>
        )}

        {/* Posts Grid */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelected(post)}
                className="w-full text-left bg-[#0f1320] rounded-2xl border border-[#1a1f2e] hover:border-[#0A1EFF]/20 transition-all overflow-hidden"
              >
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full h-32 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#0A1EFF]/10 text-blue-300 border border-[#0A1EFF]/20">
                      {post.category}
                    </span>
                    <span className="text-[10px] text-gray-600 flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.published_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{post.title}</h3>
                  {post.summary && (
                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{post.summary}</p>
                  )}
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[#0A1EFF]">
                    <BookOpen className="w-3 h-3" />
                    Read report
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0A1EFF]/10 flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-[#0A1EFF]/40" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500">No research posts yet</h3>
            <p className="text-[11px] text-gray-600 mt-1.5">
              Intelligence reports and analysis will appear here
            </p>
          </div>
        )}

        {/* Pagination */}
        {total > 12 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-[#0f1320] border border-[#1a1f2e] text-xs text-gray-400 disabled:opacity-30 hover:border-[#0A1EFF]/30"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={filtered.length < 12}
              className="px-3 py-1.5 rounded-lg bg-[#0f1320] border border-[#1a1f2e] text-xs text-gray-400 disabled:opacity-30 hover:border-[#0A1EFF]/30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
