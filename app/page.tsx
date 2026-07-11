import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { LandingNav } from '@/components/landing/LandingNav';
import { FloatingCoins } from '@/components/landing/FloatingCoins';
import { HeroSection } from '@/components/landing/HeroSection';
import { LiveOverviewCard } from '@/components/landing/LiveOverviewCard';
import { FeatureCarousel } from '@/components/landing/FeatureCarousel';
import { VTXSection } from '@/components/landing/VTXSection';
import { StatsSection } from '@/components/landing/StatsSection';
import { SecurityShowcase } from '@/components/landing/SecurityShowcase';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { Disclaimer } from '@/components/landing/Disclaimer';
import { LandingFooter } from '@/components/landing/LandingFooter';
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nakalabs.xyz';
const OG_IMAGE = `${SITE_URL}/og-default.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Naka Labs: On-chain intelligence + non-custodial trading',
  description:
    'Track whales, snipe new launches, copy proven traders, and trade across EVM + Solana with built-in honeypot, tax, and liquidity-lock checks. Non-custodial. Your keys, your trades.',
  alternates: { canonical: '/' },
  keywords: [
    'on-chain intelligence',
    'whale tracker',
    'sniper bot',
    'non-custodial wallet',
    'memecoin trading',
    'Solana sniper',
    'EVM aggregator',
    'NakaCult',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Naka Labs',
    url: SITE_URL,
    title: 'Naka Labs: On-chain intelligence + non-custodial trading',
    description:
      'Whale tracking, sniper bot, copy trading, and AI-assisted research. Non-custodial across 8 chains.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Naka Labs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naka Labs',
    description: 'On-chain intelligence for every trade.',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

// Schema.org structured data. Search engines + AI agents pick this up
// and surface the brand correctly in rich results / answer panels.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Naka Labs',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      sameAs: [
        process.env.NEXT_PUBLIC_TWITTER_URL,
        process.env.NEXT_PUBLIC_DISCORD_URL,
      ].filter(Boolean),
    },
    {
      '@type': 'WebSite',
      url: SITE_URL,
      name: 'Naka Labs',
      description: 'On-chain intelligence + non-custodial trading.',
      publisher: { '@id': SITE_URL },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Naka Labs',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, iOS, Android',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Whale tracking, sniper bot, copy trading, and AI-assisted research.',
    },
  ],
};

export default function LandingPage() {
  return (
    <AuroraBackground fullHeight>
      <script
        type="application/ld+json"
        // Server-rendered structured data block; harmless if JS is off.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen text-white overflow-x-hidden">
        <LandingNav />
        <FloatingCoins section="hero" />
        <HeroSection />
        <LiveOverviewCard />
        <FeatureCarousel />
        <VTXSection />
        <StatsSection />
        <SecurityShowcase />
        <FAQSection />
        <CTASection />
        <Disclaimer />
        <LandingFooter />
      </div>
    </AuroraBackground>
  );
}
