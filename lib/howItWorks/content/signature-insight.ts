import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const signatureInsightHowItWorks: HowItWorksContent = {
  title: 'Signature Insight',
  tagline: 'See exactly what a transaction will do before you approve or sign it.',
  howItWorks: [
    'Paste raw transaction calldata or an EIP-712 typed-data signature and Signature Insight decodes it into a plain English explanation of what you are about to authorize.',
    'Typed-data mode parses gas-less off-chain signatures locally with viem and recognizes the common drain shapes (ERC-2612 Permit, Permit2 single and batch, Seaport orders), surfacing the exact spender, amount, and expiry.',
    'Calldata mode decodes the function and every parameter. When the built-in scanner has no match it resolves the 4-byte selector against the free 4byte.directory and OpenChain registries, then decodes the arguments with viem.',
    'When you add your wallet and the target contract, it simulates the call to show which assets leave, arrive, and which approvals get granted before you sign.',
    'A risk verdict of Safe, Warning, or Dangerous is assigned, with specific flags for unlimited approvals, setApprovalForAll, batch Permit2, and zero-consideration Seaport orders.',
    'Works across Ethereum, BSC, Polygon, Base, Arbitrum, and Avalanche.',
  ],
  howToUse: [
    'Open Signature Insight from the dashboard.',
    'Choose Auto detect, Raw calldata, or Typed data, then pick the chain.',
    'Paste the calldata or the EIP-712 JSON, or tap an example to try it.',
    'Optionally add your wallet and the target contract to simulate asset changes.',
    'Tap Decode and read the verdict, summary, simulated asset changes, risk flags, and decoded fields.',
    'Review the safety tips before you approve or sign anything in your wallet.',
  ],
  why: [
    'Gas-less off-chain signatures are the dominant wallet-drain vector. A Permit or Permit2 signature looks harmless in a wallet prompt and is never simulated, yet it lets an attacker move your tokens later.',
    'Decoding the calldata or typed data first turns an opaque blob into a clear picture so you can catch dangerous approvals and spoofed spenders before they cost you.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Added EIP-712 typed-data decoding for Permit, Permit2, and Seaport, a 4byte.directory and OpenChain selector fallback for unknown calldata, and a pre-sign asset-change simulation.',
    },
  ],
};
