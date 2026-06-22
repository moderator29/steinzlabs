'use client';

import { useEffect, useRef } from 'react';

/**
 * The Living Sigil — the kinetic mark at the heart of the NakaCult rebrand.
 *
 * Pure inline SVG + CSS animation (no WebGL, no deps) so it's light and
 * reliable. Concentric rune-rings counter-rotate, the octagon breathes, and a
 * gradient sweep crawls the outer ring — the mark reads as *alive* rather than
 * a static logo. A subtle pointer-parallax tilts the whole sigil toward the
 * cursor on fine-pointer devices; everything freezes under
 * prefers-reduced-motion (handled in landing.css).
 */
export function LivingSigil({ size = 360 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Pointer parallax only on devices with a precise pointer + motion allowed.
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        // Clamp the tilt so it stays a whisper, never a wobble.
        const rx = Math.max(-1, Math.min(1, -dy)) * 7;
        const ry = Math.max(-1, Math.min(1, dx)) * 7;
        node.style.setProperty('--sigil-rx', `${rx}deg`);
        node.style.setProperty('--sigil-ry', `${ry}deg`);
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="living-sigil" style={{ width: size, height: size }} aria-hidden>
      <span className="living-sigil__halo" />
      <svg className="living-sigil__svg" viewBox="0 0 200 200" width={size} height={size}>
        <defs>
          <radialGradient id="ls-core" cx="42%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#FFE9A6" />
            <stop offset="40%" stopColor="#F5C544" />
            <stop offset="78%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#2A0612" />
          </radialGradient>
          <linearGradient id="ls-edge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7DA2FF" />
            <stop offset="100%" stopColor="#3D5AFE" />
          </linearGradient>
          <linearGradient id="ls-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFEFB8" />
            <stop offset="100%" stopColor="#F5C544" />
          </linearGradient>
          <linearGradient id="ls-sweep" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3D5AFE" stopOpacity="0" />
            <stop offset="50%" stopColor="#9FB8FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#3D5AFE" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer rune ring — slow spin + gradient sweep */}
        <g className="living-sigil__ring living-sigil__ring--outer">
          <circle cx="100" cy="100" r="94" fill="none" stroke="url(#ls-edge)" strokeWidth="1" opacity="0.5" />
          <circle
            cx="100" cy="100" r="88" fill="none" stroke="url(#ls-sweep)" strokeWidth="2.5"
            strokeDasharray="6 10" strokeLinecap="round"
          />
        </g>

        {/* Mid ring — counter-rotates */}
        <g className="living-sigil__ring living-sigil__ring--mid">
          <circle cx="100" cy="100" r="78" fill="none" stroke="url(#ls-gold)" strokeWidth="0.8" strokeDasharray="2 7" opacity="0.7" />
        </g>

        {/* Breathing octagon frame */}
        <polygon
          className="living-sigil__octagon"
          points="100,30 150,50 170,100 150,150 100,170 50,150 30,100 50,50"
          fill="none" stroke="url(#ls-gold)" strokeWidth="1.6"
        />

        {/* Core */}
        <circle className="living-sigil__core" cx="100" cy="100" r="46" fill="url(#ls-core)" />
        <polygon
          className="living-sigil__diamond"
          points="100,66 134,100 100,134 66,100"
          fill="none" stroke="url(#ls-gold)" strokeWidth="1.4"
        />
        <circle cx="100" cy="100" r="5.5" fill="url(#ls-gold)" />
        <circle cx="100" cy="100" r="2" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
