'use client';

import { ArrowRight } from 'lucide-react';

interface LaunchAppButtonProps {
  className?: string;
  iconSize?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export default function LaunchAppButton({ className, iconSize = 'w-4 h-4', children, onClick }: LaunchAppButtonProps) {
  return (
    <button
      onClick={onClick}
      className={className}
    >
      {children ?? <>Launch App <ArrowRight className={iconSize} /></>}
    </button>
  );
}
