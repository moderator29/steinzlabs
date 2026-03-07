'use client';

export default function SteinzLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/steinz-logo-128.png"
      alt="STEINZ"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
