'use client';
import type { ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Multi-layered aurora background. Pure CSS — no JS animation cost.
 * Wrap any section root to give it the cinematic Vault feel.
 *
 *   <AuroraBackground className="min-h-screen">
 *     <YourContent />
 *   </AuroraBackground>
 */
export function AuroraBackground({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('aurora-bg-vault', className)}>
      {children}
    </div>
  );
}
