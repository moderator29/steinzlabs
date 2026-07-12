'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, Newspaper } from 'lucide-react';

/**
 * ArticleReader — opens a news story INSIDE the platform. Fetches a clean
 * reader-mode version (title, hero image, paragraphs) via /api/news/article so
 * the user never leaves. If the source is paywalled/unparseable it falls back to
 * the headline + snippet + a single honest "open original" link.
 */

interface ReaderData {
  ok: boolean;
  url: string;
  host?: string;
  title?: string | null;
  image?: string | null;
  siteName?: string | null;
  description?: string | null;
  paragraphs?: string[];
}

export function ArticleReader({
  url,
  fallbackTitle,
  publisher,
  onClose,
}: {
  url: string;
  fallbackTitle: string;
  publisher: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/news/article?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const title = data?.title || fallbackTitle;
  const host = data?.host || publisher;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto overscroll-contain nl-glass rounded-t-3xl sm:rounded-3xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-[#0a0e1a]/92 backdrop-blur-md border-b border-white/10 rounded-t-3xl">
          <div className="flex items-center gap-2 min-w-0">
            <Newspaper className="w-4 h-4 text-[#4d94ff] shrink-0" />
            <span className="text-xs font-semibold text-white/70 truncate">{host}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5">
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">{title}</h1>

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-white/45 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading story…
            </div>
          ) : (
            <>
              {data?.image ? (
                <img src={data.image} alt="" className="mt-4 w-full rounded-2xl border border-white/10 object-cover" style={{ maxHeight: 320 }} />
              ) : null}

              {data?.ok && data.paragraphs && data.paragraphs.length >= 2 ? (
                <div className="mt-4 space-y-3.5">
                  {data.paragraphs.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-white/80">{p}</p>
                  ))}
                </div>
              ) : (
                // Paywalled / unparseable — honest fallback.
                <div className="mt-4 space-y-3">
                  {data?.description ? <p className="text-[15px] leading-relaxed text-white/80">{data.description}</p> : null}
                  <p className="text-sm text-white/45">
                    The full story couldn&apos;t be loaded in-app (the source may be paywalled). You can read it at the publisher.
                  </p>
                </div>
              )}

              <a
                href={data?.url || url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4d94ff] hover:text-[#0066FF]"
              >
                View original on {host} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
