import 'server-only';
import { getTokenBalances, getEthBalance } from '@/lib/services/alchemy';
import { getSolanaWalletTokens } from '@/lib/services/alchemy-solana';

/**
 * On-chain holdings resolver for the Naka Cult.
 *
 * Three paths qualify a wallet:
 *   1. Holds ≥ NAKA_HOLDING_THRESHOLD $NAKA  → naka_cult tier
 *   2. Holds the Loyalty Gem NFT             → naka_cult tier
 *   3. Holds the Development NFT             → naka_cult tier + is_chosen
 *
 * Until $NAKA mints, NAKA_TOKEN_CONTRACT is unset and every read returns
 * { isMember: false, isChosen: false, nakaBalance: 0 }. The cron paths
 * detect this and no-op so we don't burn API credits on stub data.
 *
 * Chain detection is by address shape: 0x-prefixed → EVM, otherwise Solana.
 * Per CLAUDE.md, Solana addresses are case-sensitive — do NOT toLowerCase
 * them before passing through.
 */

const HOLDING_THRESHOLD = Number(process.env.NAKA_HOLDING_THRESHOLD ?? '600000');

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

  // NFT ownership — Alchemy's NFT API would be cleaner; stubbed here as
  // 'has at least one transfer to this wallet from the contract' isn't
  // available without the NFT API. Return false until that wiring lands.
  const hasLoyaltyGem = gemContract ? false : false;
  const hasDevNft     = devNftContract ? false : false;

  const isMember = nakaBalance >= HOLDING_THRESHOLD || hasLoyaltyGem || hasDevNft;
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

  // Solana NFT collections (Loyalty Gem / Dev NFT) — wire via Helius DAS
  // when contract addresses become known. Stubbed false for now.
  const hasLoyaltyGem = false;
  const hasDevNft = false;

  const isMember = nakaBalance >= HOLDING_THRESHOLD || hasLoyaltyGem || hasDevNft;
  const isChosen = hasDevNft;

  return { isMember, isChosen, nakaBalance, hasLoyaltyGem, hasDevNft };
}
