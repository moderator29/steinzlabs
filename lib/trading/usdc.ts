import 'server-only';

// Canonical USDC contract/mint per chain, shared by the copy-trade and
// sniper-autosell paths so neither hardcodes the literal string "USDC" (which
// is not an address and breaks the relayer/GoPlus). Returns null for a chain
// we don't have a USDC address for.
const USDC_BY_CHAIN: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  eth: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  matic: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  arb: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  op: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  bnb: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  avax: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  sol: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export function usdcForChain(chain: string): string | null {
  return USDC_BY_CHAIN[chain.toLowerCase()] ?? null;
}
