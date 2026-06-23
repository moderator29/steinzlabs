import Link from 'next/link';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export const metadata = {
  title: 'Page not found — Naka Labs',
  description: 'The page you were looking for could not be found.',
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
              color: '#0A1EFF',
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
            Page not found
          </h1>
          <p style={{ color: '#B4C0E0', fontSize: 15, marginBottom: 28 }}>
            The page you were looking for has been moved, retired, or never existed. Let&apos;s get
            you back on track.
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
