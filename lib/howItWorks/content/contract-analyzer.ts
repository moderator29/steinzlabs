import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const contractAnalyzerHowItWorks: HowItWorksContent = {
  title: 'Contract Analyzer',
  tagline: 'Scan any token or contract address for honeypots, dangerous permissions, and rug risk before you commit funds.',
  howItWorks: [
    'You paste a contract or token address and pick its chain, and the analyzer fans out to several real providers in parallel, then merges everything into one normalized report so you never have to stitch the data together yourself.',
    'GoPlus supplies token security and address intelligence, covering honeypot behavior, unverified source code, mint and proxy flags, hidden owners, the ability to reclaim ownership or rewrite balances, self destruct and external calls, buy and sell taxes, and whether the address is tied to phishing, mixing, malicious activity, or blacklists.',
    'DexScreener provides live price, 24 hour change, volume, liquidity, market cap, the token logo, and socials, with GeckoTerminal filling in market data for very fresh EVM pools that have not been indexed yet, and the platform sniper feed contributing launchpad, holder count, and freshness when the token has already been seen.',
    'A transparent scoring formula deducts points for each detected risk to produce a 0 to 100 security score and a verdict of Safe, Caution, Warning, or Danger, while the Risk Breakdown bars split that exposure across honeypot, ownership, contract security, and tax so you can see exactly where the danger sits.',
    'A written Naka Intelligence assessment summarizes the key risks in plain language with a one line verdict, and you can rate whether it was helpful so the read stays useful over time.',
    'When a result is unknown the analyzer returns a clear no data state instead of a fabricated report, and when a token has only just launched it shows a too early notice with the light context it genuinely has, such as age, launchpad, creator, and any early authority flags.',
    'Below the report, related panels surface other tokens sharing the same ticker so you can spot impersonators, plus the creator, owner, and top holder wallets with copy and block explorer links so you can verify the people behind the contract.',
  ],
  howToUse: [
    'Open the Contract Analyzer from your dashboard, or arrive prefilled from another tool such as the sniper, which can hand off an address and chain that run automatically.',
    'Pick the chain for the token you are checking: Ethereum, BSC, Polygon, Base, Arbitrum, Avalanche, or Solana.',
    'Paste the contract or token address into the input field, making sure the format matches the chain you selected, then press Analyze or hit Enter.',
    'Read the score ring and verdict first for a fast verdict, then scan the Risk Flags list and the Risk Breakdown bars to understand which category of risk is driving the score.',
    'Open the token security details and expand the Full Security Checklist to inspect honeypot status, buy and sell taxes, holder count, and each individual security check.',
    'Review the Naka Intelligence assessment summary for the plain language read and verdict, and use the thumbs control to flag whether it landed.',
    'Check the Similar Tokens panel to rule out same ticker impersonators and the Related Wallets panel to verify the creator, owner, and top holders before you trade, then use Analyze another contract to run the next address.',
  ],
  why: [
    'It lets you catch honeypots, rug pulls, and dangerous owner permissions before you commit funds rather than after a trade has already trapped you.',
    'Every number comes from real provider data with honest empty states, so an unknown address returns no data and a brand new token returns a too early notice instead of a confident but fabricated verdict you cannot trust.',
    'The single score, verdict, and category breakdown give you a fast and consistent read that fits naturally into a trading or research workflow, whether you are vetting a fresh launch or sanity checking a token before adding liquidity.',
    'The related token and wallet panels extend the check beyond the contract itself, helping you confirm you are on the genuine token and understand who controls supply, which is often where the real risk hides.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Added Similar Tokens and Related Wallets panels that surface same ticker impersonators and the creator, owner, and top holder addresses with copy and explorer links.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Reports now show honest no data and too early states with the light context available instead of a fabricated verdict, and very fresh EVM pools fall back to GeckoTerminal market data.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'The analyzer scans tokens across seven chains for honeypots, permissions, and taxes, pairing a transparent security score and Risk Breakdown with a written Naka Intelligence assessment.',
    },
  ],
};
