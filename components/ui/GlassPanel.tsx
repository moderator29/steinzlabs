import { forwardRef, type HTMLAttributes } from 'react';

/**
 * §2 — the canonical frosted surface. ONE glass container to replace the six
 * competing ad-hoc card definitions the audit found. Uses the existing
 * `.glass` / `.glass-strong` utility classes so it automatically respects the
 * per-user Appearance glass-intensity control (off / subtle / full).
 *
 * Variants:
 *   intensity: 'subtle' | 'default' | 'strong'  — blur/opacity tier
 *   radius:    'md' | 'lg' | 'xl'                — soft-RECTANGLE corners (never circular)
 *   padded:    convenience padding
 */

type Intensity = 'subtle' | 'default' | 'strong';
type Radius = 'md' | 'lg' | 'xl';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: Intensity;
  radius?: Radius;
  padded?: boolean;
  /** Render as a different element (e.g. 'section', 'article'). */
  as?: keyof JSX.IntrinsicElements;
}

const RADIUS: Record<Radius, string> = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { intensity = 'default', radius = 'lg', padded = false, as = 'div', className = '', children, ...rest },
  ref,
) {
  const Comp = as as 'div';
  const glass = intensity === 'strong' ? 'glass-strong' : 'glass';
  const sublte = intensity === 'subtle' ? 'bg-white/[0.02]' : '';
  return (
    <Comp
      ref={ref}
      className={`${glass} ${sublte} ${RADIUS[radius]} border border-white/10 ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
});
