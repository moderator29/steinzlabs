"use client";

/**
 * §4.2 — Shared whale avatar.
 *
 * Render order:
 *   1. cached logoUrl (Arkham/ENS/Dicebear written by /api/whales/.../logo)
 *   2. lazy fetch via /api/whales/[address]/logo if no cached URL passed
 *   3. deterministic Dicebear identicon (always renders something)
 *
 * Lazy fetch is one-shot per address — debounced via a module-level
 * in-flight set so a list of 50 whales doesn't fire 50 redundant
 * resolutions.  It writes back to the whales row, so subsequent renders
 * (or other tabs) get the cached version.
 */

import { useEffect, useState } from "react";

interface Props {
  address: string;
  chain?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

const inflight = new Set<string>();

function dicebearFor(address: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    address.toLowerCase(),
  )}&backgroundColor=0a0e1a`;
}

export function WhaleAvatar({ address, chain, logoUrl, size = 32, className = "" }: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(logoUrl ?? null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setResolvedUrl(logoUrl ?? null);
    setErrored(false);
  }, [logoUrl, address]);

  useEffect(() => {
    if (resolvedUrl) return;
    const key = `${chain ?? ""}:${address.toLowerCase()}`;
    if (inflight.has(key)) return;
    inflight.add(key);
    let cancelled = false;
    const controller = new AbortController();
    const search = chain ? `?chain=${encodeURIComponent(chain)}` : "";
    fetch(`/api/whales/${encodeURIComponent(address)}/logo${search}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { url?: string } | null) => {
        if (cancelled) return;
        if (j?.url) setResolvedUrl(j.url);
      })
      .catch(() => undefined)
      .finally(() => inflight.delete(key));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resolvedUrl, address, chain]);

  const src = resolvedUrl && !errored ? resolvedUrl : dicebearFor(address);

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
