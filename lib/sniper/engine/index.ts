/**
 * Sniper engine dispatcher.
 *
 * Single entry point used by the relayer / pending-trades flow / kill-switch.
 * Routes by chain to the correct adapter and exposes the same build/submit
 * surface for every supported chain.
 */

import type { SniperChain } from "../chains";
import type { BuildParams, BuildResult, EngineAdapter, SubmitParams, SubmitResult } from "./types";
import { solanaAdapter } from "./solana";
import { ethereumAdapter, bscAdapter, avalancheAdapter } from "./evm";
import { tonAdapter } from "./ton";

const ADAPTERS: Record<SniperChain, EngineAdapter> = {
  solana: solanaAdapter,
  ethereum: ethereumAdapter,
  bsc: bscAdapter,
  avalanche: avalancheAdapter,
  ton: tonAdapter,
};

export function getAdapter(chain: SniperChain): EngineAdapter {
  const a = ADAPTERS[chain];
  if (!a) throw new Error(`No sniper engine adapter for chain: ${chain}`);
  return a;
}

export async function buildSnipe(params: BuildParams): Promise<BuildResult> {
  return getAdapter(params.chain).build(params);
}

export async function submitSnipe(params: SubmitParams): Promise<SubmitResult> {
  return getAdapter(params.chain).submit(params);
}

export type { BuildParams, BuildResult, SubmitParams, SubmitResult, EngineAdapter };
