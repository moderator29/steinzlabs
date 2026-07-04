import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const clusterRadarHowItWorks: HowItWorksContent = {
  title: 'Coordinated Cluster Radar',
  tagline: 'See the largest coordinated wallet clusters by trading volume, and decode the seed wallet behind each one.',
  howItWorks: [
    'A coordinated cluster is a group of wallets that move together — funded from a common source, trading the same tokens in sync, or otherwise behaving as one operator — and this radar ranks those clusters by how much volume they pushed in the last twenty-four hours.',
    'Each cluster is identified by its seed address, the representative wallet at the centre of the group, along with how many member wallets belong to it and the cluster’s twenty-four-hour volume.',
    'When the seed wallet is a tracked whale it is shown with its directory label and archetype, and either way the seed is a real address you can decode further.',
    'Tapping any cluster opens the seed wallet in Whale DNA, so you can see how it trades and find the other wallets that behave like it, turning a cluster into a lead you can actually follow.',
    'Everything shown is real cluster data — volume and member counts are measured, not estimated — and the board deliberately surfaces volume only, because in this dataset the net-flow figure is identical to volume and showing both would just repeat the same number.',
  ],
  howToUse: [
    'Open Coordinated Cluster Radar from the sidebar or the Wallet Clusters area.',
    'Filter by chain to focus on one network, or leave it on All chains.',
    'Read the board top-down — the clusters pushing the most volume sit at the top, with their member counts alongside.',
    'Tap a cluster to decode its seed wallet in Whale DNA and explore the operators behind the coordination.',
  ],
  why: [
    'Coordinated clusters are where manipulation, insider accumulation, and organized farming actually happen, so seeing which clusters are moving the most money is a direct window into organized on-chain behavior.',
    'Identifying each cluster by a real seed address rather than an anonymous id makes the signal actionable — you can decode the wallet, follow it, and map its cohort instead of staring at a number.',
    'Ranking by real twenty-four-hour volume keeps the board focused on the clusters that are active right now, which is where attention is worth spending.',
    'Reach for it to spot large coordinated moves as they happen, to investigate who is behind a suspicious run, or as a starting point for mapping an operator’s full network with Whale DNA.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Coordinated Cluster Radar launched: the biggest coordinated wallet clusters by 24h volume, each with a decodable seed wallet and member count from real cluster data.',
    },
  ],
};
