// Resolve a Cluster Radar seed to a live, relevant destination.
//
// A radar "seed" is one of two things depending on the data source:
//   1. token_convergence fallback (whale_convergence_clusters) — the seed is a
//      TOKEN address. Route it to Token X-Ray, which accepts any token via the
//      shared `?token=<addressOrSymbol>&chain=<chainId>` deep-link contract.
//   2. Dune cluster aggregate (default) — the seed is a wallet/whale seed
//      ADDRESS. Route it to the cluster detail at
//      /dashboard/wallet-clusters/<address>, whose by-address API derives a
//      cluster from wallet_edges for ANY address and always renders.
//
// The old destination (/dashboard/whale-tracker/dna?address=<seed>) resolves
// only for curated whales and returns found:false for every other seed, so it
// dead-ends for the common case.

export interface SeedLinkInput {
  seed: string;
  chain: string;
  archetype: string | null;
}

export function seedLinkHref({ seed, chain, archetype }: SeedLinkInput): string {
  if (archetype === 'token_convergence') {
    const params = new URLSearchParams({ token: seed });
    if (chain) params.set('chain', chain);
    return `/dashboard/token-xray?${params.toString()}`;
  }
  return `/dashboard/wallet-clusters/${encodeURIComponent(seed)}`;
}
