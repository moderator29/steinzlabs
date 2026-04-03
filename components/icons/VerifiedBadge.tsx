'use client';

import { CheckCircle } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

export function VerifiedBadge({ size = 16, className = '' }: VerifiedBadgeProps) {
  return (
    <CheckCircle 
      size={size} 
      className={`text-green-500 ${className}`}
      fill="currentColor"
    />
  );
}
