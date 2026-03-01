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
      className="fixed bottom-24 left-4 z-40 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg md:bottom-6"
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-white" />
    </button>
  );
}
