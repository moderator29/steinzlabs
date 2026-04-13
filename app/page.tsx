import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureCardsSection } from '@/components/landing/FeatureCardsSection';
import { VTXSection } from '@/components/landing/VTXSection';
import { StatsSection } from '@/components/landing/StatsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#07090f' }}>
      <LandingNav />
      <HeroSection />
      <FeatureCardsSection />
      <VTXSection />
      <StatsSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
