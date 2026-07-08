"use client";

import { normalizeAddress } from "@/lib/utils/addressNormalize";
import { NAKA_FALLBACK_AVATAR, isRealWhaleLogo } from "@/lib/whales/naming";

/**
 * §4.2 — Shared whale avatar. The single avatar used across the Whale Tracker,
 * Directory and Live Feed so every surface renders identically.
 *
 * Render order:
 *   1. a real cached logoUrl (curated X / website / Arkham / ENS)
 *   2. lazy fetch via /api/whales/[address]/logo if no real URL was passed
 *   3. the Naka brand logo (/logo.png) — the fallback for any whale that has no
 *      real profile picture (per the owner: no identicons, use the Naka logo).
 *
 * Lazy fetch is one-shot per address — debounced via a module-level in-flight
 * set so a list of 50 whales doesn't fire 50 redundant resolutions. It writes
 * back to the whales row, so subsequent renders get the cached version.
 */

import { useEffect, useState } from "react";

interface Props {
  address: string;
  chain?: string | null;
  logoUrl?: string | null;
  /** Optional logo source ('x' | 'website' | 'arkham' | 'ens' | 'dicebear'). */
  logoSource?: string | null;
  size?: number;
  className?: string;
}

const inflight = new Set<string>();

export function WhaleAvatar({ address, chain, logoUrl, logoSource, size = 32, className = "" }: Props) {
  // Only seed from a passed URL if it is a REAL avatar — a stale dicebear URL
  // must degrade to the Naka logo, not render an identicon.
  const seed = isRealWhaleLogo(logoUrl, logoSource) ? logoUrl! : null;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(seed);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setResolvedUrl(isRealWhaleLogo(logoUrl, logoSource) ? logoUrl! : null);
    setErrored(false);
  }, [logoUrl, logoSource, address]);

  useEffect(() => {
    if (resolvedUrl) return;
    // /api/whales/[address]/logo requires the chain — without it the route
    // will 400. When the caller doesn't know the chain we keep showing the
    // Naka logo rather than firing a guaranteed 400.
    if (!chain) return;
    const key = `${chain}:${normalizeAddress(address, chain)}`;
    if (inflight.has(key)) return;
    inflight.add(key);
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/whales/${encodeURIComponent(address)}/logo?chain=${encodeURIComponent(chain)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { url?: string; source?: string } | null) => {
        if (cancelled) return;
        // Only adopt a REAL avatar; a dicebear resolution stays on the Naka logo.
        if (j?.url && isRealWhaleLogo(j.url, j.source)) setResolvedUrl(j.url);
      })
      .catch(() => undefined)
      .finally(() => inflight.delete(key));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resolvedUrl, address, chain]);

  const src = resolvedUrl && !errored ? resolvedUrl : NAKA_FALLBACK_AVATAR;

  return (
    <img
      src={src}
      alt="whale"
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`rounded-full border border-slate-700 shrink-0 ${className}`}
      style={{ width: size, height: size, objectFit: "cover", background: "#0f172a" }}
    />
  );
}
