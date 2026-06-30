'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { BookOpen, Clock, Tag, Eye, ArrowRight } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

interface Post {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  author: string;
  tags: string[];
  read_time: number | null;
  published_at: string;
  view_count: number;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

// Brief posts ship as HTML; admin posts may be plain text. Detect tags so we
// render each correctly (and never dump raw markup as text).
function looksLikeHtml(s: string) { return /<\/?[a-z][\s\S]*>/i.test(s); }

export default function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/research/${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() as Promise<{ post: Post }> : Promise.reject())
      .then(d => { if (!cancelled) { setPost(d.post); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen text-white">
        <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <BackButton href="/research" label="Research" />
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="w-4 h-4 text-[#0066FF]" /> Research
            </div>
            <Link href="/dashboard" className="text-xs bg-[#0066FF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Open App
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {state === 'loading' && (
            <div className="space-y-4">
              <div className="h-8 w-2/3 rounded-lg bg-white/[0.05] animate-pulse" />
              <div className="aspect-[16/9] rounded-2xl bg-white/[0.03] animate-pulse" />
              <div className="h-4 w-full rounded bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-white/[0.04] animate-pulse" />
            </div>
          )}

          {state === 'error' && (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-base">This post could not be found.</p>
              <Link href="/research" className="inline-flex items-center gap-1 mt-4 text-sm text-[#4D6BFF] hover:underline">
                Back to Research <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {state === 'ready' && post && (
            <article className="nl-hero-glow">
              <div className="flex items-center gap-2 mb-4 text-[11px] text-gray-500 nl-fade-up nl-fade-up-1">
                <Tag className="w-3 h-3" />
                <span className="uppercase tracking-wide text-[#4D6BFF] font-semibold">{post.category}</span>
                <span className="opacity-30">·</span>
                <Clock className="w-3 h-3" />
                <span>{fmtDate(post.published_at)}</span>
                {post.read_time ? (<><span className="opacity-30">·</span><span>{post.read_time} min read</span></>) : null}
                {post.view_count > 0 ? (<><span className="opacity-30">·</span><Eye className="w-3 h-3" /><span>{post.view_count.toLocaleString()}</span></>) : null}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4 nl-fade-up nl-fade-up-1">{post.title}</h1>
              <p className="text-gray-400 text-sm mb-6 nl-fade-up nl-fade-up-2">By {post.author}</p>

              {post.image_url && (
                <div style={{ perspective: '1200px' }} className="mb-8 nl-fade-up nl-fade-up-2">
                  <TiltCard max={6} className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/[0.08] nl-glass">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  </TiltCard>
                </div>
              )}

              <div className="nl-fade-up nl-fade-up-3">
                {looksLikeHtml(post.content) ? (
                  <div className="nl-research-content" dangerouslySetInnerHTML={{ __html: post.content }} />
                ) : (
                  <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</div>
                )}
              </div>

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-white/[0.06]">
                  {post.tags.map(t => (
                    <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.04] text-gray-400">{t}</span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="mt-12 rounded-3xl border border-[#0066FF]/25 bg-gradient-to-br from-[#0066FF]/10 to-[#8B5CF6]/10 p-8 text-center nl-sheen nl-fade-up nl-fade-up-4">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-3">Track this live on Naka Labs</h3>
                <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6">
                  Whale feeds, wallet intelligence, and AI scanners. Free to start, grounded in real on-chain data.
                </p>
                <Link href="/dashboard" className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0818CC] text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors">
                  Open the app <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>
          )}
        </div>
      </div>
    </AuroraBackground>
  );
}
