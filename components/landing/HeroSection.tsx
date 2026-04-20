'use client';

import { HeroLeft } from './HeroLeft';
import { HeroRight } from './HeroRight';
import { FloatingCoins } from './FloatingCoins';
import { useScrollY } from '@/lib/landing/useScrollParallax';

const STARS = Array.from({ length: 55 }, (_, i) => ({
  w: (i * 1.618) % 2 + 1,
  top: (i * 37.7) % 100,
  left: (i * 61.8) % 100,
  opacity: (i * 0.13) % 0.5 + 0.1,
  dur: (i * 0.7) % 3 + 2,
  delay: (i * 0.4) % 3,
}));

export function HeroSection() {
  const scrollY = useScrollY();
  // Parallax layers — each moves at a different speed for depth.
  const gridShift = Math.min(scrollY * 0.35, 400);
  const orbShift = scrollY * 0.55;
  const contentShift = scrollY * 0.15;
  const opacityFade = Math.max(1 - scrollY / 700, 0);

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center px-5 pt-24 pb-16 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0A1EFF 0%,#050ea8 20%,#07090f 55%)' }}
    >
      {/* CSS grid overlay — drifts up on scroll */}
      <div className="absolute inset-0 pointer-events-none will-change-transform" style={{
        backgroundImage: 'linear-gradient(rgba(26,58,204,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(26,58,204,.04) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
        transform: `translate3d(0, ${-gridShift}px, 0)`,
      }} />

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: s.w,
              height: s.w,
              top: `${s.top}%`,
              left: `${s.left}%`,
              opacity: s.opacity,
              animation: `pulse ${s.dur}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Glow orb — parallax, fades out as user scrolls */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[600px] rounded-full pointer-events-none will-change-transform"
        style={{
          background: 'radial-gradient(ellipse,rgba(13,30,140,.15) 0%,transparent 70%)',
          filter: 'blur(60px)',
          transform: `translate3d(-50%, calc(-50% + ${orbShift}px), 0)`,
        }}
      />

      {/* Floating 3D coins (behind all content) */}
      <FloatingCoins section="hero" />

      {/* Content grid — gentle upward parallax + fade for depth */}
      <div
        className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-[55%_45%] gap-12 items-center will-change-transform"
        style={{
          transform: `translate3d(0, ${-contentShift}px, 0)`,
          opacity: opacityFade,
        }}
      >
        <HeroLeft />
        <HeroRight />
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom,transparent,#07090f)' }} />
    </section>
  );
}
