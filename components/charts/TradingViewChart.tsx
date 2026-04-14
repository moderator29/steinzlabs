'use client';

import { useEffect, useRef, useState } from 'react';

function getSymbol(symbol: string): string {
  const map: Record<string, string> = {
    ETH: 'BINANCE:ETHUSDT', BTC: 'BINANCE:BTCUSDT', SOL: 'BINANCE:SOLUSDT',
    BNB: 'BINANCE:BNBUSDT', MATIC: 'BINANCE:MATICUSDT', AVAX: 'BINANCE:AVAXUSDT',
    ARB: 'BINANCE:ARBUSDT', OP: 'BINANCE:OPUSDT', LINK: 'BINANCE:LINKUSDT',
    UNI: 'BINANCE:UNIUSDT', AAVE: 'BINANCE:AAVEUSDT', USDC: 'BINANCE:USDCUSDT',
    DOGE: 'BINANCE:DOGEUSDT', XRP: 'BINANCE:XRPUSDT', ADA: 'BINANCE:ADAUSDT',
    DOT: 'BINANCE:DOTUSDT', PEPE: 'BINANCE:PEPEUSDT', SHIB: 'BINANCE:SHIBUSDT',
  };
  return map[symbol.toUpperCase()] || `BINANCE:${symbol.toUpperCase()}USDT`;
}

export function TradingViewChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<'1' | '3'>('1');

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getSymbol(symbol),
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style,
      locale: 'en',
      backgroundColor: 'rgba(13, 13, 13, 1)',
      gridColor: 'rgba(26, 26, 46, 1)',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });
    containerRef.current.appendChild(script);
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, style]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 4 }}>
        <button
          onClick={() => setStyle('1')}
          style={{
            background: style === '1' ? '#6366f1' : '#1a1a2e',
            color: 'white', border: 'none', padding: '4px 12px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12,
          }}
        >
          Candles
        </button>
        <button
          onClick={() => setStyle('3')}
          style={{
            background: style === '3' ? '#6366f1' : '#1a1a2e',
            color: 'white', border: 'none', padding: '4px 12px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12,
          }}
        >
          Line
        </button>
      </div>
      <div ref={containerRef} style={{ height: '500px', width: '100%' }} />
    </div>
  );
}
