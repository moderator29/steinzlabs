'use client';

export default function DexPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: '#0A0E1A' }}
    >
      <div className="text-center px-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(10,30,255,0.1)', border: '1px solid rgba(10,30,255,0.25)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A1EFF" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">DEX Discovery</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          DEX token discovery coming soon. Building something powerful.
        </p>
      </div>
    </div>
  );
}
