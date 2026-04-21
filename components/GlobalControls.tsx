'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { QuickTranslateToggle } from '@/components/i18n/QuickTranslateToggle';

// Compact Theme + Language cluster mounted in dashboard + docs chrome.
// Landing has its own pair inside LandingNav.
export default function GlobalControls({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-no-translate>
      <QuickTranslateToggle />
      <LanguageSwitcher variant="nav" />
      <ThemeToggle />
    </div>
  );
}
