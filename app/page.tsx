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

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#07090f' }}>
      <LandingNav />
      <HeroSection />
      <FeatureCardsSection />
      <VTXSection />
      <FeatureShowcase />
      <SecurityShowcase />
      <StatsSection />
      <FAQSection />
      <CTASection />
      <Disclaimer />
      <LandingFooter />
    </div>
  );
}
