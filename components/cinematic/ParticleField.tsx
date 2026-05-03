'use client';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type ParticleVariant = 'stars' | 'mist' | 'embers';

interface Props {
  /** Visual style. `stars` drift, `mist` blooms slowly, `embers` rise. */
  variant?: ParticleVariant;
  /** Override automatic device-tier count. */
  count?: number;
  className?: string;
}

/**
 * Pure-canvas particle field. ~200 LOC, no @tsparticles dep.
 *
 * Performance:
 * - Auto-tunes particle count by viewport (mobile < 768px halves count).
 * - Pauses entirely when `prefers-reduced-motion: reduce` is set.
 * - Pauses when document.hidden (background tabs cost nothing).
 * - Uses requestAnimationFrame; no setInterval.
 */
export function ParticleField({ variant = 'stars', count, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const baseCount = count ?? (isMobile ? 30 : 70);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; tw: number };
    const particles: P[] = Array.from({ length: baseCount }, () => spawn());

    function spawn(): P {
      const r = variant === 'mist' ? 60 + Math.random() * 80 : Math.random() * 1.6 + 0.4;
      return {
        x: Math.random() * w,
        y: variant === 'embers' ? h + Math.random() * 50 : Math.random() * h,
        r,
        vx: variant === 'stars' ? (Math.random() - 0.5) * 0.06 : (Math.random() - 0.5) * 0.15,
        vy: variant === 'embers' ? -(0.2 + Math.random() * 0.4) : (Math.random() - 0.5) * 0.04,
        a: variant === 'mist' ? 0.04 + Math.random() * 0.06 : 0.2 + Math.random() * 0.5,
        tw: Math.random() * Math.PI * 2,
      };
    }

    let raf = 0;
    let running = true;

    const onVis = () => { running = !document.hidden; if (running) raf = requestAnimationFrame(loop); };
    document.addEventListener('visibilitychange', onVis);

    const colorFor = (a: number) => {
      if (variant === 'mist') return `rgba(0, 102, 255, ${a})`;
      if (variant === 'embers') return `rgba(220, 20, 60, ${a})`;
      // stars: drift between blue and white
      return `rgba(180, 200, 255, ${a})`;
    };

    function loop() {
      if (!ctx || !running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        p.tw += 0.02;

        // Wrap / respawn
        if (p.x < -p.r) p.x = w + p.r;
        else if (p.x > w + p.r) p.x = -p.r;
        if (variant === 'embers') {
          if (p.y < -p.r) Object.assign(p, spawn(), { y: h + p.r });
        } else {
          if (p.y < -p.r) p.y = h + p.r;
          else if (p.y > h + p.r) p.y = -p.r;
        }

        const a = variant === 'stars'
          ? p.a * (0.6 + 0.4 * Math.sin(p.tw)) // twinkle
          : p.a;

        if (variant === 'mist') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, colorFor(a));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = colorFor(a);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [variant, count, reduced]);

  return (
    <canvas
      ref={ref}
      className={clsx('pointer-events-none absolute inset-0 h-full w-full', className)}
      aria-hidden="true"
    />
  );
}
