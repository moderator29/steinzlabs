import type { ReactNode } from 'react';

/**
 * AuroraBackground — drop-in cinematic backdrop matching the W reference image.
 *
 * Pure CSS, no JS cost. Wraps children with the .cult-aurora-bg layer that
 * paints a deep-navy canvas + radial blue/crimson hotspots + a slowly drifting
 * conic ribbon. Honors prefers-reduced-motion (no drift).
 *
 * Use as the outermost container of any page or hero that should feel cult-
 * branded. Children render above the aurora in normal flow.
 */
export function AuroraBackground({
  className = '',
  fullHeight = false,
  children,
}: {
  className?: string;
  fullHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`cult-aurora-bg ${fullHeight ? 'min-h-screen' : ''} ${className}`}>
      {children}
    </div>
  );
}
