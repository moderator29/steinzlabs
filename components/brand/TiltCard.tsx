'use client';

import { useRef, type ReactNode, type CSSProperties } from 'react';

/**
 * TiltCard — pointer-driven 3D tilt with a moving specular glare, for the
 * Research Labs cards and brief hero. Pure transforms (GPU-friendly), no deps.
 *
 * The card rotates toward the cursor on the X/Y axes and lifts on Z; a radial
 * "glare" highlight tracks the pointer for a glassy, three-dimensional feel.
 * Disabled for coarse pointers (touch) and when prefers-reduced-motion is set,
 * so mobile and accessibility users get a flat, calm card. All motion is driven
 * by CSS custom properties set here; the look lives in globals-brand.css.
 */
export function TiltCard({
  children,
  className = '',
  max = 7,
  glare = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees on each axis. */
  max?: number;
  glare?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const reduced = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(hover: none)').matches);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height; // 0..1
    el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 2 * max}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.style.setProperty('--tz', '1');
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--tz', '0');
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`nl-tilt ${glare ? 'nl-tilt--glare' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
