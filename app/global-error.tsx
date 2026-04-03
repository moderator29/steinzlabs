'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: '#0A0E1A', color: 'white', fontFamily: 'system-ui', padding: '40px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ color: '#9CA3AF', marginBottom: '24px', fontSize: '14px' }}>
            {error.message || 'An unexpected error occurred'}
          </p>
          {error.digest && (
            <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '12px' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#0A1EFF',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
