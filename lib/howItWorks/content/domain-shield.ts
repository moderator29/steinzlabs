import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const domainShieldHowItWorks: HowItWorksContent = {
  title: 'Domain Shield',
  tagline: 'Check any website or domain for phishing and malicious risk before you connect your wallet.',
  howItWorks: [
    'You enter a URL or domain, and Domain Shield checks it against live phishing and malicious site intelligence so the verdict reflects the current threat landscape.',
    'Each scan returns a clear verdict of Safe, Suspicious, or Phishing, along with a confidence score and the specific risk signals that drove the result.',
    'An AI analysis layer turns those signals into a plain-language assessment, a threat breakdown, and concrete recommended actions tailored to the verdict.',
    'Results are cached briefly so repeat checks on the same domain return quickly without rescanning every time.',
  ],
  howToUse: [
    'Open Domain Shield from the dashboard.',
    'Type or paste the URL or domain you want to verify, or tap one of the example domains to try it.',
    'Press Check and wait a moment while the domain is analyzed.',
    'Read the verdict, confidence score, and risk signals, then follow the recommended actions before you connect a wallet or sign anything.',
    'Tap Scan another domain to verify the next site.',
  ],
  why: [
    'Phishing sites and lookalike domains are one of the most common ways wallets get drained, and a quick check before connecting closes that gap.',
    'A single verdict with confidence and clear signals gives you a confident yes or no instead of guessing whether a site is real.',
    'It works on any URL, so you can vet links from social posts, messages, and search results before they ever touch your wallet.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Domain Shield scans any URL or domain and returns a Safe, Suspicious, or Phishing verdict with confidence, risk signals, and AI guidance.',
    },
  ],
};
