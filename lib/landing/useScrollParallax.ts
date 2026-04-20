'use client';

import { useEffect, useRef, useState } from 'react';

// Smooth scroll parallax — returns scroll Y value (rAF-throttled) plus an
// element-bound progress hook. Used to add depth to the landing page
// without pulling in framer-motion for the whole tree.

export function useScrollY(): number {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    let latest = 0;
    const onScroll = () => {
      latest = window.scrollY;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          setY(latest);
          raf = 0;
        });
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return y;
}

export function useElementParallax(speed = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;
      // element center position relative to viewport center, normalised [-1, 1]
      const centre = rect.top + rect.height / 2;
      const delta = (centre - viewportH / 2) / viewportH;
      setOffset(delta * 80 * speed);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { update(); raf = 0; });
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);
  return { ref, offset };
}
