import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isHolderOfContract, getTokenBalances, getTokenMetadata } from '@/lib/services/alchemy';
import { normalizeTier } from '@/lib/subscriptions/tierCheck';

/**
 * Wallet → entitlement resolver for the new (decoupled) model.
 *
 *   NIPPO NFT (0x6941…)        → cult membership (cult_source = 'nippo_nft')
 *   >= 1,227,000 $NAKA         → cult membership (cult_source = 'naka_holdings')
 *   Founder Pass NFT (0x14Ab…) → Max-tier PLATFORM access (tier_source =
 *                                'founder_pass_nft'), 6 months from first link.
 *                                Grants NO cult access.
 *
 * Cult membership and platform tier are independent (see the decouple
 * migration). A wallet can satisfy either, both, or neither.
 *
 * Contract addresses default to the live mainnet deployments so the resolver
 * works without any env wiring; env vars override for testing / redeploys.
 */

const NIPPO_CONTRACT = (
  process.env.NIPPO_NFT_CONTRACT ?? '0x69411ADa5CccF7bbfb19428462a7bB6c38BCb4Cb'
).toLowerCase();
const FOUNDER_PASS_CONTRACT = (
  process.env.FOUNDER_PASS_NFT_CONTRACT ?? '0x14Ab8f5c26eBABD31A66b89dC38d2D21D5E01C67'
).toLowerCase();
const NAKA_TOKEN = (
  process.env.NEXT_PUBLIC_NAKA_TOKEN_ADDRESS ?? '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898'
).toLowerCase();
const NAKA_THRESHOLD = Number(process.env.NAKA_CULT_THRESHOLD ?? '1227000');

// Founder Pass bakes in 6 months of Max. Clock starts on first verified link
// (owner decision) and is written once — never re-extended while held. The
// rare 1-year tokens are deferred; every Founder Pass is 6 months for now.
const FOUNDER_GRANT_DAYS = 180;

export interface WalletEntitlements {
  cult: boolean;
  cultSource: 'nippo_nft' | 'naka_holdings' | null;
  max: boolean; // holds a Founder Pass
}

const isEvm = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

/**
 * Real on-chain decimals for the $NAKA contract. Hardcoding 1e18 mis-scales
 * the balance (and the membership threshold + vote weight) by orders of
 * magnitude if $NAKA is not an 18-decimal token. getTokenMetadata is cached,
 * so this is effectively free after the first call. Degrades to 18 only when
 * metadata is unreadable.
 */
async function nakaDecimals(): Promise<number> {
  try {
    const meta = await getTokenMetadata(NAKA_TOKEN, 'ethereum');
    return typeof meta?.decimals === 'number' ? meta.decimals : 18;
  } catch {
    return 18;
  }
}

/**
 * Pure on-chain read across one or more verified addresses. Never throws —
 * a chain error degrades to "not detected" rather than blocking login.
 */
export async function resolveWalletEntitlements(addresses: string[]): Promise<WalletEntitlements> {
  const evm = Array.from(new Set(addresses.filter(isEvm).map((a) => a.toLowerCase())));
  if (evm.length === 0) return { cult: false, cultSource: null, max: false };

  let hasNippo = false;
  let hasFounder = false;
  let nakaBalance = 0;
  const decimals = await nakaDecimals();

  for (const addr of evm) {
    const [nippo, founder] = await Promise.all([
      isHolderOfContract(addr, NIPPO_CONTRACT, 'ethereum').catch(() => false),
      isHolderOfContract(addr, FOUNDER_PASS_CONTRACT, 'ethereum').catch(() => false),
    ]);
    hasNippo = hasNippo || nippo;
    hasFounder = hasFounder || founder;

    try {
      const balances = await getTokenBalances(addr, 'ethereum');
      const match = balances.find((b) => b.contractAddress.toLowerCase() === NAKA_TOKEN);
      if (match?.tokenBalance) {
        nakaBalance += Number(BigInt(match.tokenBalance)) / 10 ** decimals;
      }
    } catch {
      /* balance read failed for this address — ignore, sum the rest */
    }
  }

  const meetsNaka = nakaBalance >= NAKA_THRESHOLD;
  return {
    cult: hasNippo || meetsNaka,
    cultSource: hasNippo ? 'nippo_nft' : meetsNaka ? 'naka_holdings' : null,
    max: hasFounder,
  };
}

/**
 * Sum a user's verified on-chain $NAKA balance across their EVM addresses.
 * Never throws — a chain hiccup degrades to 0 rather than blocking the caller.
 */
export async function resolveNakaBalance(addresses: string[]): Promise<number> {
  const evm = Array.from(new Set(addresses.filter(isEvm).map((a) => a.toLowerCase())));
  let nakaBalance = 0;
  const decimals = await nakaDecimals();
  for (const addr of evm) {
    try {
      const balances = await getTokenBalances(addr, 'ethereum');
      const match = balances.find((b) => b.contractAddress.toLowerCase() === NAKA_TOKEN);
      if (match?.tokenBalance) nakaBalance += Number(BigInt(match.tokenBalance)) / 10 ** decimals;
    } catch {
      /* per-address read failed — sum the rest */
    }
  }
  return nakaBalance;
}

/**
 * Holdings-weighted Conclave vote weight, sqrt-scaled so whales can't dominate:
 *   weight = max(1, floor(sqrt(nakaBalance / threshold)))
 * Every cult member weighs at least 1 (NIPPO holders with little/no $NAKA), and
 * a holder at the entry threshold weighs 1, 4x → 2, 9x → 3, etc. This replaces
 * the old fabricated `isChosen ? 2 : 1` constant with real on-chain holdings.
 */
export async function resolveNakaVoteWeight(addresses: string[]): Promise<number> {
  const balance = await resolveNakaBalance(addresses);
  return Math.max(1, Math.floor(Math.sqrt(balance / NAKA_THRESHOLD)));
}

/**
 * Resolve + persist entitlements for a user across their verified wallets.
 *
 * Idempotent and non-destructive of unrelated state:
 *   - never re-extends an existing Founder-Pass grant (clock stays from first
 *     link); never overwrites a paying Stripe tier;
 *   - only revokes what THIS pipeline granted on-chain (cult_source
 *     nippo_nft/naka_holdings, tier_source founder_pass_nft) — legacy/admin
 *     grants and Stripe subscriptions are left untouched.
 *
 * Returns the resolved entitlements so callers can surface them.
 */
export async function applyWalletEntitlements(
  userId: string,
  addresses: string[],
): Promise<WalletEntitlements> {
  const ent = await resolveWalletEntitlements(addresses);
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: prof } = await sb
    .from('profiles')
    .select('cult_member, cult_source, tier, tier_source, tier_expires_at, verified_badge')
    .eq('id', userId)
    .maybeSingle<{
      cult_member: boolean | null;
      cult_source: string | null;
      tier: string | null;
      tier_source: string | null;
      tier_expires_at: string | null;
      verified_badge: string | null;
    }>();

  const update: Record<string, unknown> = {};

  // ── Cult entitlement (NIPPO / NAKA) ──────────────────────────────────────
  if (ent.cult) {
    if (!prof?.cult_member) {
      update.cult_member = true;
      update.cult_source = ent.cultSource;
      update.cult_member_since = nowIso;
    }
  } else if (
    prof?.cult_member &&
    (prof.cult_source === 'nippo_nft' || prof.cult_source === 'naka_holdings')
  ) {
    update.cult_member = false;
    update.cult_source = null;
    update.cult_member_since = null;
  }

  // ── Founder Pass → Max platform grant ────────────────────────────────────
  if (ent.max) {
    // Grant only when the user is NOT already on a Max plan from any source.
    // This protects a paid Stripe sub, a comped legacy/admin grant (some are
    // permanent, expiry NULL), and an existing Founder-Pass grant — clobbering
    // any of them would wrongly re-stamp a 180-day expiry over a permanent
    // grant. Only a non-Max user is upgraded; Founder-Pass holders who are
    // already Max keep their existing expiry (never re-extended).
    if (normalizeTier(prof?.tier) !== 'max') {
      update.tier = 'max';
      update.tier_source = 'founder_pass_nft';
      update.tier_expires_at = new Date(Date.now() + FOUNDER_GRANT_DAYS * 86_400_000).toISOString();
      update.tier_nft_token_id = FOUNDER_PASS_CONTRACT;
      // Automatic gold "NAKA MAX" badge for Founder Pass holders.
      update.verified_badge = 'gold';
    }
  } else if (prof?.tier_source === 'founder_pass_nft') {
    // No longer holds a Founder Pass → revoke the NFT-granted Max only.
    update.tier = 'free';
    update.tier_source = null;
    update.tier_expires_at = null;
    update.tier_nft_token_id = null;
    // Clear the auto gold badge only if it's the one we set (never wipe a
    // manually-assigned badge of another value).
    if (prof.verified_badge === 'gold') update.verified_badge = null;
  }

  if (Object.keys(update).length > 0) {
    await sb.from('profiles').update(update).eq('id', userId);
  }

  return ent;
}
