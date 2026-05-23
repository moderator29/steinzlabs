'use client';

import { useEffect } from 'react';

/**
 * Toggles `animation-play-state: paused` on every CSS @keyframes-driven
 * element when the tab becomes hidden, and resumes on visible.
 *
 * Background: Chrome throttles RAF when a tab is hidden but does NOT
 * pause CSS animations — naka-cult has 10 infinite @keyframes loops
 * (drift, sigil-breathe, orb-drift-a/b/c, aura-spin, halo-breathe...)
 * that keep burning GPU even when the user has switched tabs. Owner
 * reported "computer sounds like a jet" while sitting on /naka-cult.
 *
 * Drop into any layout that hosts heavy CSS animations; zero props.
 */
export function PauseAnimationsOnHidden() {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.naka = 'pause-anim';
    style.textContent = `
      html[data-naka-hidden="1"] *,
      html[data-naka-hidden="1"] *::before,
      html[data-naka-hidden="1"] *::after {
        animation-play-state: paused !important;
      }
    `;
    document.head.appendChild(style);

    const onVis = () => {
      if (document.hidden) {
        document.documentElement.dataset.nakaHidden = '1';
      } else {
        delete document.documentElement.dataset.nakaHidden;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    onVis(); // initial state

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      style.remove();
      delete document.documentElement.dataset.nakaHidden;
    };
  }, []);

  return null;
}
