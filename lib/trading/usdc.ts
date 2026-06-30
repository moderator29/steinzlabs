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

// USDC decimals per chain. Almost everywhere USDC is 6dp, BUT Binance-Peg USDC
// on BSC is 18dp — hardcoding 1e6 there silently converts $50 into dust and
// corrupts proceeds/cost-basis. Resolve decimals per chain on every USD↔base-unit
// conversion. Default 6 for any chain not explicitly 18.
const USDC_DECIMALS_BY_CHAIN: Record<string, number> = {
  bsc: 18,
  bnb: 18,
};

export function usdcDecimalsForChain(chain: string): number {
  return USDC_DECIMALS_BY_CHAIN[chain.toLowerCase()] ?? 6;
}

/** USD amount → USDC base units (BigInt-safe; handles 6dp and 18dp chains). */
export function usdToUsdcBaseUnits(amountUsd: number, chain: string): string {
  const decimals = usdcDecimalsForChain(chain);
  // Scale via the 6-sig-fig micro-USD intermediate so 18dp never overflows Number.
  return (BigInt(Math.round(amountUsd * 1e6)) * (BigInt(10) ** BigInt(decimals)) / BigInt(1e6)).toString();
}

/** USDC base units → USD number (handles 6dp and 18dp chains). */
export function usdcBaseUnitsToUsd(baseUnits: string | number | bigint, chain: string): number {
  const decimals = usdcDecimalsForChain(chain);
  return Number(baseUnits) / 10 ** decimals;
}
