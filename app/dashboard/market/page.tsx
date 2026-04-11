'use client';

export default function MarketPage() {
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Markets</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Live market data coming soon. Building something powerful.
        </p>
      </div>
    </div>
  );
}
