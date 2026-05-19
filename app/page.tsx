import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureCardsSection } from '@/components/landing/FeatureCardsSection';
import { VTXSection } from '@/components/landing/VTXSection';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { StatsSection } from '@/components/landing/StatsSection';
import { SecurityShowcase } from '@/components/landing/SecurityShowcase';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { Disclaimer } from '@/components/landing/Disclaimer';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { SocialSection } from '@/components/landing/SocialSection';
import { OnboardingMention } from '@/components/landing/OnboardingMention';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Naka Labs — On-chain intelligence + non-custodial trading',
  description:
    'Track whales, snipe new launches, copy proven traders, and trade across EVM + Solana with built-in honeypot, tax, and liquidity-lock checks. Non-custodial — your keys, your trades.',
  openGraph: {
    title: 'Naka Labs — On-chain intelligence + non-custodial trading',
    description:
      'Whale tracking, sniper bot, copy trading, and AI-assisted research. Non-custodial across 8 chains.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Naka Labs',
    description: 'On-chain intelligence for every trade.',
  },
};

export default function LandingPage() {
  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen text-white overflow-x-hidden">
        <LandingNav />
        <HeroSection />
        <FeatureCardsSection />
        <VTXSection />
        <FeatureShowcase />
        <SecurityShowcase />
        <SocialSection />
        <OnboardingMention />
        <StatsSection />
        <FAQSection />
        <CTASection />
        <Disclaimer />
        <LandingFooter />
      </div>
    </AuroraBackground>
  );
}
