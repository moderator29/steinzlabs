'use client';

import { useEffect } from 'react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-retry once after 800ms — most reload errors are transient hydration
    // mismatches that resolve on the second render.
    const t = setTimeout(() => reset(), 800);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <AuroraBackground fullHeight>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <span className="nl-loader" aria-hidden="true" style={{ margin: '0 auto 20px' }} />
          <p style={{ color: '#B4C0E0', fontSize: '14px', marginBottom: '20px' }}>Loading…</p>
          <button onClick={reset} className="nl-button" style={{ padding: '10px 20px' }}>
            Try again
          </button>
        </div>
      </div>
    </AuroraBackground>
  );
}
