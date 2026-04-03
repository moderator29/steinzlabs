'use client';

import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface SafetyScoreIconProps {
  score: number;
  size?: number;
}

export function SafetyScoreIcon({ score, size = 20 }: SafetyScoreIconProps) {
  if (score >= 7) {
    return <ShieldCheck size={size} className="text-green-500" />;
  } else if (score >= 4) {
    return <Shield size={size} className="text-yellow-500" />;
  } else {
    return <ShieldAlert size={size} className="text-red-500" />;
  }
}
