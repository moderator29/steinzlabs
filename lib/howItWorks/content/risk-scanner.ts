import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const riskScannerHowItWorks: HowItWorksContent = {
  title: 'Risk Scanner',
  tagline: 'Scan every token a wallet holds for contract level security risk and get a clear score with the exact reasons behind it.',
  howItWorks: [
    'Risk Scanner inspects the actual ERC-20 holdings in a wallet and checks each token contract for the traps that drain traders, including honeypots, punishing buy and sell taxes, mint authority, blacklist functions, hidden owners, self destruct code, and upgradeable proxies that let the logic change after you buy.',
    'It first reads the wallet\'s live positions on the chain you choose through the platform\'s wallet intelligence feed, keeps only the holdings that carry a real token contract, and then runs each contract through GoPlus, the on-chain contract security source that powers the scan.',
    'The scanner supports seven EVM networks, namely Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, and Avalanche, and it analyzes up to fifteen token contracts in a single pass so a typical wallet is covered in one scan.',
    'At the top you get a circular gauge showing the average security score from 0 to 100 across every scanned token, plus an overall portfolio verdict of Low, Moderate, High, or Critical risk that is driven by how many holdings landed in the danger and warning bands.',
    'Below the gauge, a four count summary breaks the wallet into Scanned, Safe, Warning, and Danger, and each token then gets its own card with its own score bar, a Safe, Warning, or Danger badge, and the specific failed checks listed in plain language so you can see what tripped the rating.',
    'The Intelligence Report at the bottom reads only the real flags raised across your holdings and turns them into prioritized, severity ranked recommendations, so a honeypot or self destruct warning is called out as a hard exit risk while a high tax or weak liquidity lock is flagged for review.',
    'When a wallet holds only the native coin, untradeable dust, or tokens that GoPlus has not indexed on the selected chain, the scanner says so plainly rather than inventing a score.',
  ],
  howToUse: [
    'Open Risk Scanner and pick the network you want to scan on from the chain selector, choosing the chain where the wallet actually holds its tokens.',
    'Paste any wallet address into the search field, or leave it blank to scan the wallet you already have connected.',
    'Press Run Full Scan and wait while the scanner pulls the wallet\'s holdings and checks every token contract against GoPlus.',
    'Read the score gauge and the overall risk verdict first to gauge how exposed the wallet is at a glance.',
    'Work down the per-token cards, starting with the lowest scores, and open the listed flags on each one to see exactly which security checks failed.',
    'Use the Intelligence Report to prioritize action, treating the danger lines as hard exit signals and the warning lines as positions to review before you add to them.',
    'Press Scan Again to switch chains or check another address whenever you want to vet a new wallet.',
  ],
  why: [
    'Most catastrophic losses in tokens come from contract level traps that never show up on a price chart, and this scanner surfaces honeypots, owner controlled balances, mint authority, and unlocked liquidity before they cost you.',
    'Reach for it before you buy into a new token, after you receive an unexpected airdrop, or whenever you are deciding whether to copy or fund another wallet, since you can scan any address and not just your own.',
    'Because every flag and recommendation is tied to a real check returned by GoPlus rather than a guess, the output gives you concrete reasons you can act on instead of a vague risk feeling.',
    'It fits naturally between discovery and execution, letting you clear a wallet or a position for contract safety in one pass before you commit capital or route a trade.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Recommendations in the Intelligence Report are now built strictly from the real GoPlus flags on your holdings, so every line maps to an actual count of tokens that tripped a specific check.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'The scanner reads a wallet\'s live ERC-20 holdings and runs each contract through GoPlus for honeypot, tax, mint, blacklist, liquidity lock, and ownership risk, then rolls the results into one portfolio score.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Scanning now spans seven EVM networks, namely Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, and Avalanche, selectable from the chain picker before you run a scan.',
    },
  ],
};
