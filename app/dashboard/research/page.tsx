'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Tag,
  Calendar,
  ChevronRight,
  Loader2,
  BookOpen,
  ArrowLeft,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
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
  source?: string;
  url?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'DeFi', 'NFT', 'Layer2', 'Meme', 'BTC', 'ETH', 'SOL', 'Market Analysis', 'Security', 'Protocols', 'On-Chain', 'General'];

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest', icon: Clock },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
];

const CATEGORY_COLORS: Record<string, string> = {
  DeFi: 'bg-[#0A1EFF]/15 text-[#6B7FFF] border-[#0A1EFF]/20',
  NFT: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Layer2: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  Meme: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20',
  BTC: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  ETH: 'bg-indigo-400/15 text-indigo-300 border-indigo-400/20',
  SOL: 'bg-[#9945FF]/15 text-[#C77DFF] border-[#9945FF]/20',
  Security: 'bg-red-500/15 text-red-400 border-red-500/20',
  'Market Analysis': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Protocols: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  'On-Chain': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  General: 'bg-white/8 text-gray-400 border-white/10',
};

const SOURCE_COLORS: Record<string, string> = {
  CryptoPanic: 'text-orange-400',
  CoinGecko: 'text-emerald-400',
  DexScreener: 'text-[#0A1EFF]',
  Supabase: 'text-gray-400',
};

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function estimateReadTime(content: string) {
  const words = content?.split(' ')?.length || 300;
  return Math.max(1, Math.ceil(words / 200));
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || 'bg-white/8 text-gray-400 border-white/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${cls}`}>
      {category}
    </span>
  );
}

function SourceTag({ source }: { source?: string }) {
  if (!source) return null;
  const cls = SOURCE_COLORS[source] || 'text-gray-500';
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {source}
    </span>
  );
}

function ArticleCard({
  post,
  onClick,
  featured,
}: {
  post: ResearchPost;
  onClick: () => void;
  featured?: boolean;
}) {
  const readTime = estimateReadTime(post.content);

  if (featured) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl border border-white/[0.06] bg-[#0A0E1A] overflow-hidden hover:border-[#0A1EFF]/30 hover:shadow-[0_0_24px_rgba(10,30,255,0.08)] transition-all duration-200 group"
      >
        {post.image_url ? (
          <div className="h-44 w-full overflow-hidden">
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="h-44 w-full bg-gradient-to-br from-[#0A1EFF]/10 to-[#7C3AED]/10 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(10,30,255,0.06)_0%,_transparent_70%)]" />
            <BookOpen className="w-10 h-10 text-[#0A1EFF]/30" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold text-[#0A1EFF] uppercase tracking-widest flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Featured
            </span>
            <span className="text-white/20">·</span>
            <CategoryBadge category={post.category} />
            {post.source && (
              <>
                <span className="text-white/20">·</span>
                <SourceTag source={post.source} />
              </>
            )}
          </div>
          <h2 className="text-base font-heading font-bold text-white mb-2 leading-snug group-hover:text-[#6B7FFF] transition-colors line-clamp-2">
            {post.title}
          </h2>
          <p className="text-[12px] text-gray-400 leading-relaxed mb-4 line-clamp-2">{post.summary}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(post.published_at || post.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {readTime} min read
              </span>
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
      className="w-full text-left rounded-xl border border-white/[0.06] bg-[#0A0E1A] overflow-hidden hover:border-[#0A1EFF]/20 hover:shadow-[0_0_16px_rgba(10,30,255,0.06)] transition-all duration-200 group flex"
    >
      {post.image_url ? (
        <div className="w-20 flex-shrink-0 overflow-hidden" style={{ minHeight: '88px' }}>
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div
          className="w-20 flex-shrink-0 bg-gradient-to-br from-[#0A1EFF]/08 to-[#7C3AED]/06 flex items-center justify-center"
          style={{ minHeight: '88px' }}
        >
          <BookOpen className="w-4 h-4 text-[#0A1EFF]/25" />
        </div>
      )}
      <div className="flex-1 p-3.5 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <CategoryBadge category={post.category} />
          {post.source && <SourceTag source={post.source} />}
        </div>
        <h3 className="text-[13px] font-semibold text-white leading-snug mb-1 line-clamp-2 group-hover:text-[#6B7FFF] transition-colors">
          {post.title}
        </h3>
        <p className="text-[11px] text-gray-500 line-clamp-1 mb-2">{post.summary}</p>
        <div className="flex items-center gap-3 text-[9px] text-gray-600">
          <span className="flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" />
            {formatDate(post.published_at || post.created_at)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {readTime} min read
          </span>
        </div>
      </div>
    </button>
  );
}

function ArticleView({ post, onBack }: { post: ResearchPost; onBack: () => void }) {
  const readTime = estimateReadTime(post.content);
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Research
      </button>
      {post.image_url && (
        <div className="h-48 w-full rounded-xl overflow-hidden mb-5 border border-white/[0.06]">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CategoryBadge category={post.category} />
        {post.source && <SourceTag source={post.source} />}
        <span className="text-[10px] text-gray-600 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(post.published_at || post.created_at)}
        </span>
        <span className="text-[10px] text-gray-600 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {readTime} min read
        </span>
      </div>
      <h1 className="text-xl font-heading font-bold text-white mb-3 leading-tight">{post.title}</h1>
      <p className="text-[13px] text-gray-400 leading-relaxed mb-5 pb-5 border-b border-white/[0.06]">
        {post.summary}
      </p>
      <div className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</div>
      {post.url && (
        <div className="mt-5">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-lg text-[12px] font-semibold text-[#6B7FFF] hover:bg-[#0A1EFF]/20 transition-colors"
          >
            View Source <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-gray-600 flex-shrink-0" />
            {post.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ResearchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('latest');
  const [selected, setSelected] = useState<ResearchPost | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update "X mins ago" every 30s
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchPosts = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20', sort });
        if (category !== 'All') params.set('category', category);
        const res = await fetch(`/api/research?${params}`);
        const data = await res.json();
        setPosts(data.posts || []);
        setTotal(data.total || 0);
        setLastUpdated(new Date());
      } catch {
        if (!silent) setPosts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, page, sort]
  );

  // Initial load + re-fetch on filter/page change
  useEffect(() => {
    fetchPosts(false);
  }, [fetchPosts]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchPosts(true), AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPosts]);

  const filtered = posts.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.summary.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Article detail view ────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="min-h-screen bg-[#060A12] text-white">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <ArticleView post={selected} onBack={() => setSelected(null)} />
        </div>
      </div>
    );
  }

  const featured = !search ? filtered[0] : null;
  const rest = !search ? filtered.slice(1) : filtered;

  return (
    <div className="min-h-screen bg-[#060A12] text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-heading font-bold text-white">Research Labs</h1>
            <p className="text-[11px] text-gray-500">Live intel from DexScreener, CoinGecko & more</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-gray-600 flex items-center gap-1 whitespace-nowrap">
                <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin text-[#0A1EFF]' : ''}`} />
                {/* eslint-disable-next-line react-hooks/exhaustive-deps */}
                {timeAgo(lastUpdated)}
              </span>
            )}
            <button
              onClick={() => fetchPosts(true)}
              disabled={refreshing}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showFilters ? 'bg-[#0A1EFF]/20 text-[#6B7FFF]' : 'hover:bg-white/5 text-gray-400'
              }`}
              title="Filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Filter/Sort Panel ── */}
        {showFilters && (
          <div className="mb-5 rounded-xl border border-white/[0.06] bg-[#0A0E1A] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Filters</span>
              <button onClick={() => setShowFilters(false)}>
                <X className="w-3.5 h-3.5 text-gray-500 hover:text-white transition-colors" />
              </button>
            </div>

            {/* Sort */}
            <div>
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Sort by</p>
              <div className="flex gap-2">
                {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setSort(value); setPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                      sort === value
                        ? 'bg-[#0A1EFF] text-white'
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 border border-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category in panel */}
            <div>
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((label) => (
                  <button
                    key={label}
                    onClick={() => { setCategory(label); setPage(1); }}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      category === label
                        ? 'bg-[#0A1EFF] text-white'
                        : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 border border-white/[0.06]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search research..."
            className="w-full bg-[#0A0E1A] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Category Tabs ── */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {CATEGORIES.map((label) => (
            <button
              key={label}
              onClick={() => { setCategory(label); setPage(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                category === label
                  ? 'bg-[#0A1EFF] text-white shadow-[0_0_12px_rgba(10,30,255,0.4)]'
                  : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 border border-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#0A1EFF] animate-spin mb-3" />
            <p className="text-xs text-gray-500">Fetching latest research...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">No research found</p>
            <p className="text-xs text-gray-600">
              {search ? `No results for "${search}"` : 'Try a different category or check back soon'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {featured && (
              <div className="mb-4">
                <ArticleCard post={featured} onClick={() => setSelected(featured)} featured />
              </div>
            )}
            {rest.map((post) => (
              <ArticleCard key={post.id} post={post} onClick={() => setSelected(post)} />
            ))}

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= total}
                  className="px-4 py-2 text-xs font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Data sources footer */}
            <div className="pt-4 flex items-center justify-center gap-2 text-[9px] text-gray-700 uppercase tracking-wider">
              <span>Sources:</span>
              <span className="text-emerald-900">CoinGecko</span>
              <span>·</span>
              <span className="text-[#0A1EFF]/40">DexScreener</span>
              <span>·</span>
              <span className="text-orange-900">CryptoPanic</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
