'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

interface LaunchAppButtonProps {
  className?: string;
  iconSize?: string;
  children?: React.ReactNode;
}

export default function LaunchAppButton({ className, iconSize = 'w-4 h-4', children }: LaunchAppButtonProps) {
  const router = useRouter();
  const [href, setHref] = useState('/signup');

  useEffect(() => {
    const hasSession = localStorage.getItem('naka_has_session');
    if (hasSession === 'true') setHref('/login');
  }, []);

  return (
    <button
      onClick={() => router.push(href)}
      className={className}
    >
      {children ?? <>Launch App <ArrowRight className={iconSize} /></>}
    </button>
  );
}
