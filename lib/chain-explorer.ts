/**
 * Returns the block explorer URL for a given chain + address.
 * This is a shared utility used by both server (API routes) and client components.
 */
export function getExplorerUrl(chain: string, address: string): string {
  switch (chain.toLowerCase()) {
    case 'solana':    return `https://solscan.io/account/${address}`;
    case 'ethereum':  return `https://etherscan.io/address/${address}`;
    case 'bsc':       return `https://bscscan.com/address/${address}`;
    case 'base':      return `https://basescan.org/address/${address}`;
    case 'arbitrum':  return `https://arbiscan.io/address/${address}`;
    case 'polygon':   return `https://polygonscan.com/address/${address}`;
    case 'optimism':  return `https://optimistic.etherscan.io/address/${address}`;
    case 'avalanche': return `https://snowtrace.io/address/${address}`;
    case 'sui':       return `https://suiscan.xyz/mainnet/account/${address}`;
    case 'ton':       return `https://tonscan.org/address/${address}`;
    case 'tron':      return `https://tronscan.org/#/address/${address}`;
    default:          return `https://etherscan.io/address/${address}`;
  }
}
