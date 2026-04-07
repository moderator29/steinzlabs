'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Tag, Calendar, ChevronRight, Loader2, BookOpen, ArrowLeft, Clock, TrendingUp, Shield, BarChart3, Layers, Globe, Zap } from 'lucide-react';

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

const CATEGORY_COLORS: Record<string, string> = {
  DeFi: 'bg-[#0A1EFF]/15 text-[#6B7FFF]',
  Security: 'bg-[#EF4444]/15 text-[#EF4444]',
  'Market Analysis': 'bg-[#10B981]/15 text-[#10B981]',
  Protocols: 'bg-[#7C3AED]/15 text-[#7C3AED]',
  'On-Chain': 'bg-[#F59E0B]/15 text-[#F59E0B]',
  General: 'bg-white/10 text-gray-400',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function estimateReadTime(content: string) {
  const words = content?.split(' ')?.length || 300;
  return Math.max(1, Math.ceil(words / 200));
}

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || 'bg-white/10 text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {category}
    </span>
  );
}

function ArticleCard({ post, onClick, featured }: { post: ResearchPost; onClick: () => void; featured?: boolean }) {
  const readTime = estimateReadTime(post.content);

  if (featured) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left glass rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-200 group"
      >
        {post.image_url ? (
          <div className="h-48 w-full overflow-hidden">
            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        ) : (
          <div className="h-48 w-full bg-gradient-to-br from-[#0A1EFF]/10 to-[#7C3AED]/10 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0A1EFF10_0%,_transparent_70%)]" />
            <BookOpen className="w-12 h-12 text-[#0A1EFF]/30" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold text-[#0A1EFF] uppercase tracking-widest">Featured</span>
            <span className="text-gray-600">·</span>
            <CategoryBadge category={post.category} />
          </div>
          <h2 className="text-lg font-heading font-bold text-white mb-2 leading-snug group-hover:text-[#6B7FFF] transition-colors">
            {post.title}
          </h2>
          <p className="text-[12px] text-gray-400 leading-relaxed mb-4 line-clamp-2">{post.summary}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at || post.created_at)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{readTime} min read</span>
            </div>
            <span className="text-[11px] font-semibold text-[#0A1EFF] flex items-center gap-1 group-hover:gap-2 transition-all">
              Read <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left glass rounded-xl border border-white/[0.07] overflow-hidden hover:border-white/15 transition-all duration-200 group flex"
    >
      {post.image_url ? (
        <div className="w-24 flex-shrink-0 overflow-hidden" style={{ minHeight: '90px' }}>
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="w-24 flex-shrink-0 bg-gradient-to-br from-[#0A1EFF]/08 to-[#7C3AED]/08 flex items-center justify-center" style={{ minHeight: '90px' }}>
          <BookOpen className="w-5 h-5 text-[#0A1EFF]/30" />
        </div>
      )}
      <div className="flex-1 p-3.5 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <CategoryBadge category={post.category} />
        </div>
        <h3 className="text-[13px] font-semibold text-white leading-snug mb-1 line-clamp-2 group-hover:text-[#6B7FFF] transition-colors">
          {post.title}
        </h3>
        <p className="text-[11px] text-gray-500 line-clamp-1 mb-2">{post.summary}</p>
        <div className="flex items-center gap-3 text-[9px] text-gray-600">
          <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{formatDate(post.published_at || post.created_at)}</span>
          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{readTime} min read</span>
        </div>
      </div>
    </button>
  );
}

function ArticleView({ post, onBack }: { post: ResearchPost; onBack: () => void }) {
  const readTime = estimateReadTime(post.content);
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Research
      </button>
      {post.image_url && (
        <div className="h-52 w-full rounded-xl overflow-hidden mb-5 border border-white/10">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <CategoryBadge category={post.category} />
        <span className="text-[10px] text-gray-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.published_at || post.created_at)}</span>
        <span className="text-[10px] text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />{readTime} min read</span>
      </div>
      <h1 className="text-xl font-heading font-bold text-white mb-3 leading-tight">{post.title}</h1>
      <p className="text-[13px] text-gray-400 leading-relaxed mb-5 pb-5 border-b border-white/[0.06]">{post.summary}</p>
      <div className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</div>
      {post.tags && post.tags.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-gray-600 flex-shrink-0" />
            {post.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-500">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
      const params = new URLSearchParams({ page: String(page), limit: '20' });
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
    p.summary.toLowerCase().includes(search.toLowerCase()) ||
    (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) {
    return (
      <div className="min-h-screen bg-[#060A12] text-white">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <ArticleView post={selected} onBack={() => setSelected(null)} />
        </div>
      </div>
    );
  }

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-[#060A12] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Research Lab</h1>
            <p className="text-[11px] text-gray-500">Intelligence reports and on-chain analysis</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/30 transition-colors"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map(label => (
            <button
              key={label}
              onClick={() => { setCategory(label); setPage(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                category === label
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 border border-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#0A1EFF] animate-spin mb-3" />
            <p className="text-xs text-gray-500">Loading research...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">No research found</p>
            <p className="text-xs text-gray-600">
              {search ? `No results for "${search}"` : 'Check back soon for new intelligence reports'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {featured && !search && (
              <div className="mb-5">
                <ArticleCard post={featured} onClick={() => setSelected(featured)} featured />
              </div>
            )}
            {(search ? filtered : rest).map(post => (
              <ArticleCard key={post.id} post={post} onClick={() => setSelected(post)} />
            ))}
            {total > 20 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 20 >= total}
                  className="px-4 py-2 text-xs font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
