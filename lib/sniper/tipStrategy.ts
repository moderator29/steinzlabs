/**
 * Sniper tip-strategy auto-bid. Calculates the validator/builder tip
 * (Jito tip on Solana, Flashbots/MEV-Boost tip on EVM) for a sniper
 * fill given current network congestion, the user's aggressiveness
 * setting, and the trade size.
 *
 * Goal: stop landing dead-last in the block when 40 other snipers
 * are racing for the same LP-add. Static tip presets (e.g. 0.001
 * SOL) work in calm markets and lose every race in hot ones.
 *
 * Pure — no IO. Caller fetches the inputs (lib/sniper/congestion.ts
 * once it lands, currently the caller passes congestionPct from
 * its own datasource). Audit §B.2 P2.
 */

export type SniperChain = 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'bsc' | 'polygon' | 'solana';

export type SniperAggressiveness = 'conservative' | 'standard' | 'aggressive' | 'kamikaze';

export interface TipInputs {
  chain: SniperChain;
  /** 0..100 — congestion percentile right now. 0 = empty, 100 = fully saturated. */
  congestionPct: number;
  /** Trade size in USD. Larger trades justify larger tips. */
  tradeSizeUsd: number;
  aggressiveness: SniperAggressiveness;
}

export interface TipQuote {
  /** Native-token amount to tip. SOL on Solana, ETH equivalent on EVM (in wei is the caller's job to convert). */
  tipNative: number;
  /** USD equivalent for UI display. */
  tipUsd: number;
  /** Human-readable explanation for the audit log. */
  rationale: string;
}

const AGGRESSIVENESS_MULT: Record<SniperAggressiveness, number> = {
  conservative: 0.6,
  standard: 1,
  aggressive: 1.8,
  kamikaze: 3.5,
};

interface ChainParams {
  /** Native-token spot price for USD conversion. Caller supplies. */
  baseTipNative: number; // tip at congestionPct=0, standard aggressiveness
  /** Maximum tip cap, native units. */
  capNative: number;
}

const CHAIN_PARAMS: Record<SniperChain, ChainParams> = {
  ethereum:  { baseTipNative: 0.0008, capNative: 0.08 },
  base:      { baseTipNative: 0.00005, capNative: 0.004 },
  arbitrum:  { baseTipNative: 0.00005, capNative: 0.004 },
  optimism:  { baseTipNative: 0.00005, capNative: 0.004 },
  bsc:       { baseTipNative: 0.0008, capNative: 0.05 },
  polygon:   { baseTipNative: 0.05, capNative: 3 },
  solana:    { baseTipNative: 0.0005, capNative: 0.05 },
};

export function quoteTip(inputs: TipInputs, nativePriceUsd: number): TipQuote {
  const params = CHAIN_PARAMS[inputs.chain];
  const congestionScalar = 1 + (Math.max(0, Math.min(100, inputs.congestionPct)) / 100) * 5;
  const aggressivenessScalar = AGGRESSIVENESS_MULT[inputs.aggressiveness];
  // Bigger trades justify a bigger tip, but the relationship is
  // sub-linear — a $10k buy tips ~3x a $1k buy, not 10x.
  const sizeScalar = inputs.tradeSizeUsd > 0
    ? 1 + Math.log10(Math.max(1, inputs.tradeSizeUsd / 1000)) * 0.5
    : 1;

  let tipNative = params.baseTipNative * congestionScalar * aggressivenessScalar * sizeScalar;
  tipNative = Math.min(tipNative, params.capNative);

  const tipUsd = tipNative * Math.max(0, nativePriceUsd);
  const rationale =
    `base ${params.baseTipNative} × cong ${congestionScalar.toFixed(2)}` +
    ` × ${inputs.aggressiveness} ${aggressivenessScalar} × size ${sizeScalar.toFixed(2)}` +
    ` (capped at ${params.capNative})`;

  return { tipNative, tipUsd, rationale };
}
