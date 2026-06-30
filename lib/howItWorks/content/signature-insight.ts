import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const signatureInsightHowItWorks: HowItWorksContent = {
  title: 'Signature Insight',
  tagline: 'See exactly what a transaction will do before you approve or sign it.',
  howItWorks: [
    'Paste raw transaction calldata or a signature and Signature Insight decodes it into a plain English explanation of the function being called.',
    'It identifies the function, breaks out each parameter with its name, type, and value, and writes a short summary of what the transaction actually does.',
    'A risk verdict of Safe, Warning, or Dangerous is assigned, with specific flags for patterns like unlimited approvals or risky permissions.',
    'Decoding works across Ethereum, BSC, Polygon, Base, Arbitrum, and Avalanche.',
  ],
  howToUse: [
    'Open Signature Insight from the dashboard.',
    'Pick the chain the transaction belongs to.',
    'Paste the transaction calldata into the input box, or tap one of the example signatures to try it.',
    'Tap Decode Signature and read the verdict, summary, risk flags, and decoded parameters.',
    'Review the safety tips before you approve or sign anything in your wallet.',
  ],
  why: [
    'Wallet prompts hide what a transaction really does, and that gap is where approvals get drained and permissions get abused.',
    'Decoding the calldata first turns an opaque hex blob into a clear, readable picture so you can catch dangerous signatures before they cost you.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Decode any transaction calldata into plain English with a risk verdict and parameter breakdown across six chains.',
    },
  ],
};
