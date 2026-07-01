import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const domainShieldHowItWorks: HowItWorksContent = {
  title: 'Domain Shield',
  tagline: 'Check any website or domain against live phishing intelligence before you connect your wallet or sign a transaction.',
  howItWorks: [
    'You enter a URL or domain and Domain Shield runs it through several independent safety sources at once, then combines what they return into a single clear verdict of Safe, Suspicious, Phishing, or Unknown.',
    'The sources are real and run in parallel: GoPlus phishing intelligence checks for known phishing and malicious flags, the MetaMask eth-phishing-detect community list checks whether the domain is blocklisted or sits on the allowlist of vetted legitimate sites, RDAP registration data establishes how old the domain is, and Google Safe Browsing is queried as an extra layer when it is available.',
    'A transparent safety score from 0 to 100 is computed in code from those signals, starting at a neutral 100 and dropping for concrete findings, so a known threat flag forces a Phishing verdict while a very new registration applies a softer penalty that an allowlist hit can suppress.',
    'The Source breakdown panel shows each source on its own line with a Clean, Flagged, Allowlisted, Info, or No data label, so you can see exactly which checks contributed and which had nothing to report.',
    'When RDAP returns a registration date you also get a Domain age card, and domains under a month old are called out as carrying elevated risk since fresh registrations are a common phishing pattern.',
    'A grounded AI summary turns the same signals into two or three plain sentences of qualitative guidance with no invented numbers, and if no source returns data the result is an honest Unknown rather than a false all-clear.',
  ],
  howToUse: [
    'Open Domain Shield from the dashboard.',
    'Type or paste the URL or domain you want to verify into the input, or tap one of the example domains to see a full scan.',
    'Press Check and wait while the sources are queried in parallel.',
    'Read the headline verdict and the safety score bar at the top to get the overall picture at a glance.',
    'Open the Source breakdown to see how each individual source rated the domain, and review the Risk signals list for the specific findings that lowered the score.',
    'Check the Domain age card for how recently the site was registered, since a brand new domain claiming to be an established brand is a strong warning sign.',
    'Read the AI summary and the safety reminders, then tap Scan another domain to verify the next site.',
  ],
  why: [
    'Phishing sites and lookalike domains are one of the most common ways wallets get drained, and a quick check before you connect or sign closes that gap in seconds.',
    'Because the verdict is built from multiple independent sources and a score traced to real signals, you get a confident yes or no instead of guessing whether a site is genuine.',
    'It works on any URL, so you can vet links from social posts, direct messages, and search results before they ever touch your wallet, which makes it a natural first step in any due diligence workflow.',
    'The honest Unknown state matters too, because it tells you when no source has data on a domain so you know to verify independently rather than assuming a site is safe.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Every scan now shows a per-source breakdown and a transparent safety score traced to real signals, with an honest Unknown verdict when no source has data instead of a fabricated result.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Domain age from registration records was added as a risk signal, flagging very new domains that frequently impersonate established platforms.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Domain Shield scans any URL or domain across multiple phishing and threat sources and returns a Safe, Suspicious, Phishing, or Unknown verdict with risk signals and a grounded summary.',
    },
  ],
};
