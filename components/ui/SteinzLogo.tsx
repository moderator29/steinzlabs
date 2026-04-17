'use client';

// Naka Labs brand logo. Renders the PNG mark so every consumer gets the new brand
// without needing to change import paths.
import Image from 'next/image';

interface SteinzLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export default function SteinzLogo({ size = 36, animated = false, className }: SteinzLogoProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <Image
        src="/logo.png"
        alt="Naka Labs"
        width={size}
        height={size}
        priority
        style={{
          objectFit: 'contain',
          animation: animated ? 'naka-float 4s ease-in-out infinite' : undefined,
          borderRadius: size >= 48 ? 12 : 8,
        }}
      />
      <style jsx>{`
        @keyframes naka-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
