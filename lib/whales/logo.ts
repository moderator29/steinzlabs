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

export type LogoSource = "arkham" | "ens" | "dicebear";

export interface ResolvedLogo {
  url: string;
  source: LogoSource;
}

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

function dicebearFallback(address: string): ResolvedLogo {
  const seed = encodeURIComponent(address.toLowerCase());
  return {
    url: `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=0a0e1a`,
    source: "dicebear",
  };
}

async function fromArkham(address: string, chain?: string): Promise<ResolvedLogo | null> {
  if (!process.env.ARKHAM_API_KEY) return null;
  try {
    const intel = await arkhamAPI.getAddressIntel(address, chain);
    const logo = intel?.arkhamEntity?.logo;
    if (logo && typeof logo === "string" && logo.startsWith("http")) {
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
    if (data.avatar && typeof data.avatar === "string" && data.avatar.startsWith("http")) {
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
): Promise<ResolvedLogo> {
  const arkham = await fromArkham(address, chain ?? undefined);
  if (arkham) return arkham;
  if (chain !== "solana") {
    const ens = await fromEns(address);
    if (ens) return ens;
  }
  return dicebearFallback(address);
}
