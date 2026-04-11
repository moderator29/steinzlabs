'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {

    // Auto-retry once after 800ms — most reload errors are transient hydration
    // mismatches that resolve on the second render
    const t = setTimeout(() => reset(), 800);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0E1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          border: '3px solid #0A1EFF',
          borderTopColor: 'transparent',
          margin: '0 auto 20px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#9CA3AF', fontSize: '14px', marginBottom: '20px' }}>
          Loading...
        </p>
        <button
          onClick={reset}
          style={{
            background: '#0A1EFF',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
