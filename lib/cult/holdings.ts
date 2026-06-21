import 'server-only';
import { getTokenBalances, getEthBalance, isHolderOfContract } from '@/lib/services/alchemy';
import { getSolanaWalletTokens, getSolanaAssetsByOwner } from '@/lib/services/alchemy-solana';

/**
 * On-chain holdings resolver for the Naka Cult.
 *
 * Qualifies a wallet for cult membership (profiles.cult_member — a standalone
 * entitlement, decoupled from the platform tier ladder):
 *   1. Holds ≥ NAKA_HOLDING_THRESHOLD $NAKA  → cult member
 *   2. Holds a qualifying cult NFT           → cult member
 *      (the Development-NFT path also sets is_chosen)
 *
 * Until $NAKA mints, NAKA_TOKEN_CONTRACT is unset and every read returns
 * { isMember: false, isChosen: false, nakaBalance: 0 }. The cron paths
 * detect this and no-op so we don't burn API credits on stub data.
 *
 * Chain detection is by address shape: 0x-prefixed → EVM, otherwise Solana.
 * Per CLAUDE.md, Solana addresses are case-sensitive — do NOT toLowerCase
 * them before passing through.
 */

/**
 * Default threshold floor. The live value comes from
 * platform_settings.naka_threshold (DB-editable from /admin/cult)
 * via getCultThreshold(); this constant only kicks in when the DB
 * read fails and the env override is also absent.
 */
const DEFAULT_HOLDING_THRESHOLD = Number(process.env.NAKA_HOLDING_THRESHOLD ?? '1227000');

let _cachedThreshold: number | null = null;
let _cachedAt = 0;
const THRESHOLD_CACHE_MS = 60_000;

async function getCultThreshold(): Promise<number> {
  const now = Date.now();
  if (_cachedThreshold !== null && now - _cachedAt < THRESHOLD_CACHE_MS) return _cachedThreshold;
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('platform_settings').select('naka_threshold').limit(1).maybeSingle();
    const v = typeof data?.naka_threshold === 'number' ? data.naka_threshold : Number(data?.naka_threshold);
    if (Number.isFinite(v) && v > 0) {
      _cachedThreshold = v;
      _cachedAt = now;
      return v;
    }
  } catch {
    /* DB unreachable in this context — fall through. */
  }
  _cachedThreshold = DEFAULT_HOLDING_THRESHOLD;
  _cachedAt = now;
  return DEFAULT_HOLDING_THRESHOLD;
}

/** Hook for admin edits to bust the threshold cache. */
export function invalidateCultThresholdCache() {
  _cachedThreshold = null;
  _cachedAt = 0;
}

export interface CultHoldings {
  isMember: boolean;
  isChosen: boolean;
  nakaBalance: number;
  hasLoyaltyGem: boolean;
  hasDevNft: boolean;
}

export const EMPTY_HOLDINGS: CultHoldings = {
  isMember: false,
  isChosen: false,
  nakaBalance: 0,
  hasLoyaltyGem: false,
  hasDevNft: false,
};

/** True when the resolver has all the env it needs to actually query a chain. */
export function holdingsResolverEnabled(): boolean {
  return Boolean(
    process.env.NAKA_TOKEN_CONTRACT
      || process.env.NAKA_LOYALTY_GEM_CONTRACT
      || process.env.NAKA_DEV_NFT_CONTRACT
  );
}

function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/**
 * Resolve holdings for a single wallet. Returns EMPTY_HOLDINGS if env is
 * unset or any chain call throws — never throws.
 */
export async function resolveHoldings(walletAddress: string): Promise<CultHoldings> {
  if (!holdingsResolverEnabled()) return EMPTY_HOLDINGS;
  if (!walletAddress) return EMPTY_HOLDINGS;

  try {
    return isEvmAddress(walletAddress)
      ? await resolveEvm(walletAddress)
      : await resolveSolana(walletAddress);
  } catch {
    return EMPTY_HOLDINGS;
  }
}

async function resolveEvm(addr: string): Promise<CultHoldings> {
  const tokenContract  = process.env.NAKA_TOKEN_CONTRACT ?? '';
  const gemContract    = process.env.NAKA_LOYALTY_GEM_CONTRACT ?? '';
  const devNftContract = process.env.NAKA_DEV_NFT_CONTRACT ?? '';

  let nakaBalance = 0;
  if (tokenContract && isEvmAddress(tokenContract)) {
    // Reads the NAKA ERC-20 balance via Alchemy. getEthBalance is for native
    // ETH; for ERC-20 we use getTokenBalances and pick the matching entry.
    // EVM contract addresses are lower-case-comparable (Solana mints are not).
    try {
      const balances = await getTokenBalances(addr, 'ethereum');
      const match = balances.find(b => b.contractAddress.toLowerCase() === tokenContract.toLowerCase());
      if (match?.tokenBalance) {
        const decimals = match.decimals ?? 18;
        nakaBalance = Number(BigInt(match.tokenBalance)) / 10 ** decimals;
      }
    } catch {
      // Reference getEthBalance so unused-import lint stays happy and the
      // helper is wired for future native-token reads.
      void getEthBalance;
    }
  }

  // NFT ownership via Alchemy NFT API (getNftsForOwner filtered by contract).
  const [hasLoyaltyGem, hasDevNft] = await Promise.all([
    gemContract    ? isHolderOfContract(addr, gemContract,    'ethereum').catch(() => false) : Promise.resolve(false),
    devNftContract ? isHolderOfContract(addr, devNftContract, 'ethereum').catch(() => false) : Promise.resolve(false),
  ]);

  const threshold = await getCultThreshold();
  const isMember = nakaBalance >= threshold || hasLoyaltyGem || hasDevNft;
  const isChosen = hasDevNft;

  return { isMember, isChosen, nakaBalance, hasLoyaltyGem, hasDevNft };
}

async function resolveSolana(addr: string): Promise<CultHoldings> {
  const tokenMint = process.env.NAKA_TOKEN_CONTRACT ?? '';
  let nakaBalance = 0;

  if (tokenMint) {
    try {
      const tokens = await getSolanaWalletTokens(addr);
      // Solana mint addresses are case-sensitive — direct equality only.
      const match = tokens.find(t => t.mint === tokenMint);
      if (match) nakaBalance = Number(match.uiAmount ?? 0);
    } catch {
      /* swallow — empty holdings on any error */
    }
  }

  // Solana NFT ownership via Helius DAS. NAKA_LOYALTY_GEM_CONTRACT /
  // NAKA_DEV_NFT_CONTRACT are interpreted as the **collection** address
  // (the MCC group value) when the wallet looks Solana-shaped.
  const gemCollection = process.env.NAKA_LOYALTY_GEM_CONTRACT ?? '';
  const devCollection = process.env.NAKA_DEV_NFT_CONTRACT ?? '';
  let hasLoyaltyGem = false;
  let hasDevNft = false;
  if (gemCollection || devCollection) {
    try {
      const res = (await getSolanaAssetsByOwner(addr, 1, 1000)) as
        | { items?: Array<{ grouping?: Array<{ group_key?: string; group_value?: string }> }> }
        | null;
      const items = res?.items ?? [];
      const collections = new Set<string>();
      for (const it of items) {
        for (const g of it.grouping ?? []) {
          if (g.group_key === 'collection' && g.group_value) collections.add(g.group_value);
        }
      }
      if (gemCollection) hasLoyaltyGem = collections.has(gemCollection);
      if (devCollection) hasDevNft = collections.has(devCollection);
    } catch {
      /* swallow — empty NFT state on any error */
    }
  }

  const threshold = await getCultThreshold();
  const isMember = nakaBalance >= threshold || hasLoyaltyGem || hasDevNft;
  const isChosen = hasDevNft;

  return { isMember, isChosen, nakaBalance, hasLoyaltyGem, hasDevNft };
}
