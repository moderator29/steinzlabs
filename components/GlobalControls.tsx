'use client';

import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { QuickTranslateToggle } from '@/components/i18n/QuickTranslateToggle';

// Compact Language cluster mounted in dashboard + docs chrome.
// The light/dark ThemeToggle was removed from the nav (the app is dark-first
// and the inline switch was non-functional in the nav); theme preference still
// lives in the profile Appearance panel for anyone who wants it.
export default function GlobalControls({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-no-translate>
      <QuickTranslateToggle />
      <LanguageSwitcher variant="nav" />
    </div>
  );
}
