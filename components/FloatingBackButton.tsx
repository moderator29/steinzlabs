'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function FloatingBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/dashboard') return null;

  return (
    <button
      onClick={() => router.back()}
      className="fixed bottom-24 left-4 z-40 w-10 h-10 rounded-full bg-[#161822] border border-[#232637] flex items-center justify-center hover:bg-[#1E2030] transition-colors md:bottom-6"
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4 text-[#9CA3AF]" />
    </button>
  );
}
