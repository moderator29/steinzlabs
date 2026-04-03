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
      className="fixed top-4 left-4 z-50 p-2 hover:bg-white/10 transition-colors rounded-lg"
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-white" />
    </button>
  );
}
