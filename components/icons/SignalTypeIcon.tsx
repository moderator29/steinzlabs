'use client';

import { 
  TrendingUp, 
  AlertTriangle, 
  BadgeCheck, 
  Users, 
  ArrowDownCircle,
  Network 
} from 'lucide-react';

interface SignalTypeIconProps {
  type: 'SMART_MONEY' | 'SCAMMER_ALERT' | 'VC_ENTRY' | 'WHALE_FLOW' | 'EXIT_SIGNAL' | 'NETWORK_ALERT';
  className?: string;
  size?: number;
}

export function SignalTypeIcon({ type, className = '', size = 16 }: SignalTypeIconProps) {
  switch (type) {
    case 'SMART_MONEY':
      return <TrendingUp className={className} size={size} />;
    case 'SCAMMER_ALERT':
      return <AlertTriangle className={className} size={size} />;
    case 'VC_ENTRY':
      return <BadgeCheck className={className} size={size} />;
    case 'WHALE_FLOW':
      return <Users className={className} size={size} />;
    case 'EXIT_SIGNAL':
      return <ArrowDownCircle className={className} size={size} />;
    case 'NETWORK_ALERT':
      return <Network className={className} size={size} />;
    default:
      return <TrendingUp className={className} size={size} />;
  }
}
