import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletClustersHowItWorks: HowItWorksContent = {
  title: 'Wallet Clusters',
  tagline: 'See the coordinated groups of wallets moving behind the scenes on-chain.',
  howItWorks: [
    'Five on-chain detection signals run over recent whale activity and fuse into a single confidence graph, grouping related wallets into one cluster.',
    'Each cluster is sorted into an archetype such as Alpha Hive, Smart Money Pack, Insider Ring, Whale Syndicate, Bot Swarm, or Sybil Farm, and gets an AI-generated name and short narrative.',
    'Every cluster carries a whale score, a risk score, a member count, and a dominant hub wallet, so you can judge size and reputation at a glance.',
    'Community labels that the network has approved appear on a cluster to add human context on top of the automated detection.',
  ],
  howToUse: [
    'Open Wallet Clusters to browse the live directory of detected groups, each shown as a card with its archetype and score.',
    'Filter by archetype using the pills, set a minimum whale score, or search by cluster id, then sort by whale score, recent activity, or member count.',
    'Tap any card to open the full cluster view with its members, narrative, and graph.',
    'Paste any wallet address into the analyzer to run the five detectors live and surface the clusters that wallet belongs to.',
    'Use the export control in the header to download your current filtered view as a CSV for deeper analysis.',
  ],
  why: [
    'Single wallets rarely tell the whole story; spotting the coordinated group reveals insider rings, smart money packs, and farming operations before the obvious signals appear.',
    'Risk and whale scores let you separate market-moving collectives from sybil farms and bot swarms in seconds.',
    'Community labels combine machine detection with shared human knowledge so the picture keeps improving over time.',
  ],
  whatsNew: [
    { date: '2026', tag: 'NEW', text: 'Export your filtered cluster view to CSV directly from the directory header.' },
    { date: '2026', tag: 'NEW', text: 'Paste any wallet to run all five detectors live and get an AI-named cluster on demand.' },
  ],
};
