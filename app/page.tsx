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
