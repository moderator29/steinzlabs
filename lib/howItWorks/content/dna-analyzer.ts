import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const dnaAnalyzerHowItWorks: HowItWorksContent = {
  title: 'DNA Analyzer',
  tagline: 'Decode any wallet into a full on-chain profile, from trading style to portfolio quality.',
  howItWorks: [
    'You enter any EVM or Solana wallet address and the analyzer assembles a complete profile from live on-chain data, including current holdings, USD balances, transaction history, and the active span between when the wallet was first seen and last active.',
    'Each chain has its own grounded pipeline: Solana wallets are read through Alchemy as the authoritative source, priced with Birdeye, and enriched with token logos and identity from DexScreener, while EVM wallets are read through Alchemy with DexScreener and CoinGecko pricing and fall back to Zerion when needed.',
    'A transparent rule-based engine reads transaction frequency, meme token exposure, and holdings breadth to assign a behavioral archetype such as Diamond Hands, Scalper, Degen, Whale Follower, or Holder, so the label always traces back to what the wallet actually does on-chain.',
    'Naka Intelligence then writes the qualitative read, including a personality profile, strengths, weaknesses, recommendations, and a market outlook, all constrained to the real holdings and activity shown rather than invented prices or fabricated win rates.',
    'The Overall Score and Portfolio Grade come from a fixed formula over diversification, blue chip quality, holdings breadth, and whether the wallet is active, so the gauge and letter grade stay consistent run to run instead of drifting with the model.',
    'Supporting panels round out the picture with a Live Market Context strip showing the Fear and Greed index and trending tokens, a sector breakdown across memecoins, DeFi, stablecoins, and Layer 1 and Layer 2, recent transactions linked out to Solscan or Etherscan, and on Solana a Coins Worth Watching list tuned to the wallet style that excludes tokens it already holds.',
  ],
  howToUse: [
    'Open the DNA Analyzer from your dashboard, or arrive prefilled when you tap a DNA scan action on a whale card so the analysis runs automatically.',
    'Connect your wallet and choose Analyze My DNA to profile your own address, or paste any EVM or Solana wallet into the input field instead.',
    'Run the scan and let it fetch balances, parse history, identify the archetype, and complete the intelligence pass; if you paste a smart contract by mistake it tells you and points you to the Token Scanner.',
    'Read the hero cards first for the Overall Score out of 100 and the Portfolio Grade, then check the Identity Profile for first seen, last active, transaction count, and portfolio value.',
    'Work through the Trading DNA Profile to see the behavioral archetype, primary chain, trading style, favorite tokens, performance metrics, and the sector breakdown bars.',
    'Open the Naka Intelligence Analysis for the personality read, strengths and weaknesses, recommendations you can rate with thumbs up or down, and recent transactions you can click through to a block explorer.',
    'Finish with Quick Actions to copy the address, track the wallet in Alerts, or analyze another address, and on Solana review Coins Worth Watching for fresh leads that match the wallet style.',
  ],
  why: [
    'It turns a raw address into an instant, readable profile, so you can judge a wallet before you follow it, copy its trades, or add it to your watchlist.',
    'Every headline number is grounded in real on-chain data or a published formula, never an invented win rate or fabricated profit and loss, which makes the scores trustworthy enough to act on.',
    'Reach for it when you spot an interesting wallet in Whale Tracker or Smart Money and want to understand its style, conviction, and risk posture before committing attention or capital.',
    'On Solana it also surfaces Coins Worth Watching that fit the wallet style and filters out what it already holds, handing you a research lead that extends naturally into the rest of your workflow.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Overall Score and Portfolio Grade now come from a transparent formula over diversification, blue chip quality, holdings breadth, and activity, replacing model-guessed numbers that varied between runs.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Activity rate is now measured from the wallet\'s real active span instead of a fixed assumption, and unverifiable buy and sell counts were removed rather than estimated so the intelligence read stays honest.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'DNA Analyzer profiles any EVM or Solana wallet with a rule-based behavioral archetype, a grounded portfolio grade, a live market context strip, and an AI read of its real holdings and activity.',
    },
  ],
};
