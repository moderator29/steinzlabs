'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { CashtagChip } from '@/components/wire/CashtagChip';

/**
 * Rich text for wires and DMs: turns #hashtags into links, $cashtags into live
 * price chips, and http(s) URLs into clickable links.
 *
 * Links to OUR OWN site navigate IN-PLATFORM (client nav, no reload). Every
 * other link is EXTERNAL: tapping it does not jump straight out. It flicks up a
 * small confirm that says the user is leaving for their browser, with one button
 * to continue. That open happens in a new tab, i.e. the user's default browser
 * (Chrome / Safari), and they carry on there. Nothing external is ever framed
 * inside the app.
 */

const RICH_RE = /(https?:\/\/[^\s<]+|#[\p{L}\p{N}_]+|\$[A-Za-z][A-Za-z0-9]{0,9})/giu;
const INTERNAL_HOSTS = ['nakalabs.xyz', 'www.nakalabs.xyz'];

function splitTrailingPunct(url: string): [string, string] {
  const m = url.match(/[)\].,!?;:'"]+$/);
  if (!m) return [url, ''];
  return [url.slice(0, url.length - m[0].length), m[0]];
}

export function isInternalUrl(raw: string): boolean {
  try {
    return INTERNAL_HOSTS.includes(new URL(raw).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function hostOf(raw: string): string {
  try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return raw; }
}

function prettyUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = (u.pathname + u.search).replace(/\/$/, '');
    const label = u.hostname.replace(/^www\./, '') + path;
    return label.length > 42 ? label.slice(0, 41) + '…' : label;
  } catch {
    return raw;
  }
}

/** External link: tap → small "leaving the platform" confirm → open in browser. */
function ExternalLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const host = hostOf(url);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className="text-[#4d94ff] hover:underline break-words inline items-center"
      >
        {prettyUrl(url)}
        <ExternalLinkIcon className="inline w-3 h-3 ms-0.5 -mt-0.5 opacity-70" aria-hidden />
      </button>
      {open ? (
        <span
          role="dialog"
          aria-label="Open external link"
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <span
            className="block w-full sm:max-w-sm nl-glass rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2 text-white font-semibold text-[15px]">
              <ExternalLinkIcon className="w-4 h-4 text-[#7FB2FF]" /> Leaving Naka Labs
            </span>
            <span className="block text-[13px] text-white/55 mt-2 leading-relaxed">
              This link opens outside the platform, in your browser.
            </span>
            <span className="block mt-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-[13px] text-white/80 break-all">
              {host}
            </span>
            <span className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white/80 bg-white/[0.05] border border-white/10 hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white text-center inline-flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: '0 6px 20px rgba(0,102,255,.35)' }}
              >
                Open in browser <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </span>
          </span>
        </span>
      ) : null}
    </>
  );
}

function UrlLink({ url }: { url: string }) {
  const [clean, trail] = splitTrailingPunct(url);
  if (isInternalUrl(clean)) {
    let path = clean;
    try { const u = new URL(clean); path = u.pathname + u.search + u.hash; } catch { /* keep */ }
    return (
      <>
        <Link href={path} onClick={(e) => e.stopPropagation()} className="text-[#4d94ff] hover:underline break-words">{prettyUrl(clean)}</Link>
        {trail}
      </>
    );
  }
  return (
    <>
      <ExternalLink url={clean} />
      {trail}
    </>
  );
}

export function renderRichText(text: string, opts?: { onHashtag?: (tag: string) => void }): React.ReactNode[] {
  return text.split(RICH_RE).map((part, i) => {
    if (i % 2 === 1) {
      if (/^https?:\/\//i.test(part)) return <UrlLink key={i} url={part} />;
      if (part.startsWith('#')) {
        const tag = part.slice(1).toLowerCase();
        if (opts?.onHashtag) {
          return (
            <button key={i} type="button" onClick={(e) => { e.stopPropagation(); opts.onHashtag!(tag); }} className="text-[#4d94ff] hover:underline font-medium">
              {part}
            </button>
          );
        }
        return <span key={i} className="text-[#4d94ff] font-medium">{part}</span>;
      }
      return <CashtagChip key={i} symbol={part.slice(1)} />;
    }
    return <span key={i}>{part}</span>;
  });
}
