/**
 * §4.2: Whale logo resolver — produces a real, recognizable image for any
 * tracked wallet. Sources, in priority order:
 *
 *   1. Arkham — labeled-entity logo if Arkham has identified the wallet.
 *   2. ENS avatar (EVM only) — Alchemy's ENS profile lookup.
 *   3. Dicebear identicon — deterministic fallback so every whale gets a
 *      clean, unique avatar instead of broken-image gibberish.
 *
 * The TTL on cached logos is 7 days (logo_resolved_at column). The weekly
 * /api/cron/whale-logo-backfill cron sweeps and refreshes stale entries.
 *
 * NB: never throws. A logo failure must not block whale-card render —
 * fallback always returns at minimum a Dicebear URL.
 */

import { arkhamAPI } from "@/lib/arkham/api";

export type LogoSource = "x" | "website" | "arkham" | "ens" | "dicebear";

export interface ResolvedLogo {
  url: string;
  source: LogoSource;
}

// A curated X/Twitter handle is the most recognizable image for a named whale
// (Vitalik, a fund, a public CT figure), so it takes priority over Arkham/ENS.
// unavatar.io is a free public avatar resolver; ?fallback=false makes it 404
// when the handle has no avatar, so a bad/stale handle degrades to the next
// source instead of silently serving unavatar's generic placeholder.
function fromXHandle(xHandle: string | null | undefined): ResolvedLogo | null {
  if (!xHandle) return null;
  const h = xHandle.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return null; // valid X handle shape only
  return { url: `https://unavatar.io/x/${encodeURIComponent(h)}?fallback=false`, source: "x" };
}

// For entities that publish an official site (exchanges, funds, protocols) the
// brand logo is the recognizable image — same approach Nansen/Arkham use to badge
// labeled entities. unavatar resolves a site's logo/OG image by domain.
function fromWebsite(website: string | null | undefined): ResolvedLogo | null {
  if (!website) return null;
  let domain = website.trim().toLowerCase();
  try {
    if (!/^https?:\/\//.test(domain)) domain = `https://${domain}`;
    const host = new URL(domain).hostname.replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return { url: `https://unavatar.io/${encodeURIComponent(host)}?fallback=false`, source: "website" };
  } catch {
    return null;
  }
}

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

function dicebearFallback(address: string): ResolvedLogo {
  const safe = address && address.length > 0 ? address.toLowerCase() : "unknown-whale";
  const seed = encodeURIComponent(safe);
  return {
    url: `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=0a0e1a`,
    source: "dicebear",
  };
}

function isRenderableHttpUrl(s: unknown): s is string {
  // <img src=...> only renders absolute http(s) URLs. ipfs://, ar://,
  // data:, and relative paths break the avatar — fall through to ENS or
  // Dicebear instead of letting the broken URL persist on the row.
  // Trim whitespace because some upstream APIs surface " https://..." with
  // leading/trailing space and the regex would otherwise pass without
  // <img> being able to actually load the URL.
  if (typeof s !== "string") return false;
  return /^https?:\/\//i.test(s.trim());
}

async function fromArkham(address: string, chain?: string): Promise<ResolvedLogo | null> {
  if (!process.env.ARKHAM_API_KEY) return null;
  try {
    const intel = await arkhamAPI.getAddressIntel(address, chain);
    const logo = intel?.arkhamEntity?.logo;
    if (isRenderableHttpUrl(logo)) {
      return { url: logo, source: "arkham" };
    }
  } catch {
    // Silently fall through — observability handled by Arkham client.
  }
  return null;
}

async function fromEns(address: string): Promise<ResolvedLogo | null> {
  if (!ALCHEMY_KEY) return null;
  try {
    // ENS reverse lookup → primary name → text record "avatar".
    // Alchemy's NFT API exposes the resolved owner name + avatar via
    // getOwnersForToken / getNftMetadata, but the cleanest path is the
    // public ENS API which returns the avatar URL directly.
    const res = await fetch(
      `https://api.ensideas.com/ens/resolve/${address.toLowerCase()}`,
      { next: { revalidate: 86400 } as any },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; avatar?: string };
    if (isRenderableHttpUrl(data.avatar)) {
      return { url: data.avatar, source: "ens" };
    }
  } catch {
    // Network/parse failure — fall through.
  }
  return null;
}

export async function resolveWhaleLogo(
  address: string,
  chain: string | null = null,
  xHandle: string | null = null,
  website: string | null = null,
): Promise<ResolvedLogo> {
  // Curated X avatar first — the most recognizable image for a named whale.
  const x = fromXHandle(xHandle);
  if (x) return x;
  // Then the entity's official site logo (exchanges / funds / protocols).
  const site = fromWebsite(website);
  if (site) return site;
  const arkham = await fromArkham(address, chain ?? undefined);
  if (arkham) return arkham;
  if (chain !== "solana") {
    const ens = await fromEns(address);
    if (ens) return ens;
  }
  return dicebearFallback(address);
}
