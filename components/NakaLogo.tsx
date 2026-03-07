'use client';

export default function NakaLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/naka-logo.svg"
      alt="NAKA"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
