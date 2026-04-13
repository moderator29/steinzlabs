'use client';

import SteinzLogo from '@/components/ui/SteinzLogo';

interface SteinzLogoSpinnerProps {
  size?: number;
  message?: string;
  className?: string;
}

export default function SteinzLogoSpinner({ size = 40, message, className = '' }: SteinzLogoSpinnerProps) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Spinning ring */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, #0A1EFF 50%, transparent 100%)',
            animationDuration: '1.2s',
          }}
        />
        {/* Dark background circle */}
        <div
          className="absolute rounded-full bg-[#060A12]"
          style={{ inset: 3 }}
        />
        {/* Centered SVG logo */}
        <div
          className="absolute"
          style={{
            width: size * 0.55,
            height: size * 0.55,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <SteinzLogo size={size * 0.55} animated={false} />
        </div>
      </div>
      {message && (
        <span className="text-[11px] text-gray-500 font-mono tracking-wide">{message}</span>
      )}
    </div>
  );
}
