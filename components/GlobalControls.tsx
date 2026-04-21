'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

// Compact Theme + Language cluster mounted in dashboard + docs chrome.
// Landing has its own pair inside LandingNav.
export default function GlobalControls({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LanguageSwitcher variant="nav" />
      <ThemeToggle />
    </div>
  );
}
