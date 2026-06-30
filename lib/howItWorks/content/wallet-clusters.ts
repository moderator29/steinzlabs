import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const walletClustersHowItWorks: HowItWorksContent = {
  title: 'Wallet Clusters',
  tagline: 'See the coordinated groups of wallets moving behind the scenes on-chain.',
  howItWorks: [
    'Wallet Clusters reads the platform\'s own on-chain whale activity feed and runs five independent detection algorithms over it: direct transfers between tracked wallets, common funding from a shared source, coordinated trading of the same token inside a tight time window, behavioral fingerprints where wallets repeatedly trade the same basket of tokens, and a sybil pattern that combines near-simultaneous funding with matching trade behavior.',
    'Each algorithm emits weighted, confidence-scored edges, and the system stitches those edges into a single graph using connected-components analysis, so every wallet that is linked by any signal lands in the same cluster.',
    'For each cluster the engine identifies a hub wallet as the most connected member, finds the token the group focuses on most, and infers an archetype such as Alpha Hive, Smart Money Pack, Insider Ring, Whale Syndicate, Bot Swarm, Sybil Farm, or Institutional, falling back to Unclassified when the signals are not decisive.',
    'Two headline numbers summarize each group: a whale score from 0 to 100 that reflects size, transfer value, behavioral overlap, and edge confidence, and a risk score that climbs when sybil and tight shared-funding patterns dominate.',
    'A short narrative and a vivid name are generated for each cluster so the raw edge list reads as a plain-language profile, and when automated naming is unavailable a grounded archetype description is used instead.',
    'Community labels that members have submitted and the network has upvoted past the approval threshold appear on top of the automated read, adding human context, and on a cluster\'s detail page you also get a force-directed graph, a member list with roles, an edge table, and temporal stats.',
    'Cards in the directory surface the community label or archetype, the member count, the hub wallet, and the whale score at a glance, with score color shifting as it crosses the higher confidence bands.',
  ],
  howToUse: [
    'Open Wallet Clusters to browse the live directory, where each detected group appears as a card showing its name or archetype, member count, hub wallet, and whale score.',
    'Narrow the view with the archetype pills, each of which shows how many clusters carry that label, then set a minimum whale score and search by cluster id to focus on the groups you care about.',
    'Change the sort between whale score, recently updated, and member count to reorder the directory around size, freshness, or breadth.',
    'Tap any card to open the full cluster view with its AI name and narrative, the interactive member and edge graph, the hub and roles, the edge table, and the temporal stats.',
    'On a cluster page, contribute a community label or vote existing ones up or down, since labels that clear the approval threshold surface across the directory and earn reputation toward the Scout, Analyst, Detective, and Officer tiers.',
    'Paste any EVM or Solana address into the analyze panel to run all five detectors live against that wallet\'s recent activity and its neighbors, then open the resulting cluster cards to see scores, risk, and narrative.',
    'Use the export control in the header to download your current filtered cluster set as a CSV for spreadsheets or downstream analysis.',
  ],
  why: [
    'A single wallet rarely tells the whole story, so revealing the coordinated group behind it exposes insider rings, smart money packs, and farming operations before the obvious price signals show up.',
    'The whale and risk scores let you separate genuinely market-moving collectives from sybil farms and bot swarms in seconds, which is exactly the triage you want when a token suddenly moves.',
    'Reach for it when you are sizing up a new token, vetting a wallet you are tracking, or trying to understand who is really accumulating, and feed the results straight into the rest of your research workflow through the cluster pages or a CSV export.',
    'Because community labels layer shared human knowledge on top of machine detection, the picture keeps sharpening over time as more analysts contribute and curate.',
  ],
  whatsNew: [
    { date: '2026', tag: 'NEW', text: 'Export your filtered cluster view to CSV directly from the directory header.' },
    { date: '2026', tag: 'NEW', text: 'Paste any EVM or Solana wallet to run all five detectors live and get an AI-named cluster on demand.' },
    { date: '2026', tag: 'NEW', text: 'Community labels with voting now curate clusters, with approved labels surfacing in the directory and earning reputation tiers.' },
  ],
};
