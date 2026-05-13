import Link from 'next/link';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export const metadata = {
  title: 'Not Found — Naka Labs',
  description: 'The page you were looking for is not part of the cult.',
};

export default function NotFound() {
  return (
    <AuroraBackground fullHeight>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: '#DC143C',
              marginBottom: 12,
            }}
          >
            404
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            This path is not part of the cult.
          </h1>
          <p style={{ color: '#B4C0E0', fontSize: 15, marginBottom: 28 }}>
            The page you were looking for has been moved, retired, or was never here. The noise
            ends; the signal continues elsewhere.
          </p>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            <Link href="/" className="nl-button" style={{ padding: '10px 20px' }}>
              Back to the home
            </Link>
            <Link
              href="/dashboard"
              className="nl-button nl-button--ghost"
              style={{ padding: '10px 20px' }}
            >
              Open the dashboard
            </Link>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
