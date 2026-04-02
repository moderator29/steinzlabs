'use client';

export default function NakaLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/steinz-logo-128.png"
      alt="NAKA"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
