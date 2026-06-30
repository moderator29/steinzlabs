import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const approvalManagerHowItWorks: HowItWorksContent = {
  title: 'Approval Manager',
  tagline: 'See every contract that can spend your tokens, flag the risky ones, and revoke what you no longer trust.',
  howItWorks: [
    'You enter a wallet address on a supported EVM chain, and the scanner reads its real on-chain ERC-20 approval history to find which contracts still hold spending permission.',
    'Each approval is enriched with live token metadata and a spender security check, so a known router shows a friendly label while an unfamiliar or flagged address stands out.',
    'Every approval gets a clear rating: Safe, Unlimited, or Danger. Unlimited spending caps are flagged as a risk, and spenders reported as malicious or phishing are marked Danger.',
    'A summary shows your total approvals, how many are unlimited, and how many are dangerous, with an overall risk verdict for the wallet.',
  ],
  howToUse: [
    'Open the Approval Manager from the dashboard.',
    'Pick the chain you want to check, covering Ethereum, BSC, Polygon, Base, and Arbitrum.',
    'Paste your wallet address into the field and tap Scan.',
    'Review the active approvals list, focusing on anything marked Unlimited or Danger.',
    'Tap Revoke Approvals to open the wallet on revoke.cash and remove the permissions you no longer need.',
  ],
  why: [
    'A forgotten unlimited approval lets a contract drain a token long after you stopped using it, so finding and revoking it closes a real attack path.',
    'Seeing labeled spenders and security flags in one place turns a hidden risk into a clear decision about what to keep and what to cut.',
    'Regular approval hygiene is one of the simplest, highest-impact habits for protecting a wallet over time.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Scan any EVM wallet across five chains to surface active token approvals, flag unlimited and malicious spenders, and jump straight to revoking them.',
    },
  ],
};
