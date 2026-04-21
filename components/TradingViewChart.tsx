'use client';

import { useEffect, useRef, memo } from 'react';

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'BINANCE:BTCUSDT',
  BITCOIN: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  ETHEREUM: 'BINANCE:ETHUSDT',
  SOL: 'BINANCE:SOLUSDT',
  SOLANA: 'BINANCE:SOLUSDT',
  BNB: 'BINANCE:BNBUSDT',
  DOGE: 'BINANCE:DOGEUSDT',
  PEPE: 'BINANCE:PEPEUSDT',
  SHIB: 'BINANCE:SHIBUSDT',
  LINK: 'BINANCE:LINKUSDT',
  UNI: 'BINANCE:UNIUSDT',
  AVAX: 'BINANCE:AVAXUSDT',
  MATIC: 'BINANCE:MATICUSDT',
  POL: 'BINANCE:MATICUSDT',
  ARB: 'BINANCE:ARBUSDT',
  ADA: 'BINANCE:ADAUSDT',
  DOT: 'BINANCE:DOTUSDT',
  XRP: 'BINANCE:XRPUSDT',
  BONK: 'BYBIT:BONKUSDT',
  WIF: 'BYBIT:WIFUSDT',
  AAVE: 'BINANCE:AAVEUSDT',
  OP: 'BINANCE:OPUSDT',
  SUI: 'BINANCE:SUIUSDT',
  APT: 'BINANCE:APTUSDT',
  FIL: 'BINANCE:FILUSDT',
  NEAR: 'BINANCE:NEARUSDT',
  ATOM: 'BINANCE:ATOMUSDT',
  FTM: 'BINANCE:FTMUSDT',
  RENDER: 'BINANCE:RENDERUSDT',
  INJ: 'BINANCE:INJUSDT',
  TIA: 'BINANCE:TIAUSDT',
  SEI: 'BINANCE:SEIUSDT',
  JUP: 'BINANCE:JUPUSDT',
  PYTH: 'BINANCE:PYTHUSDT',
  W: 'BINANCE:WUSDT',
  PENDLE: 'BINANCE:PENDLEUSDT',
  STX: 'BINANCE:STXUSDT',
  IMX: 'BINANCE:IMXUSDT',
  CAKE: 'BINANCE:CAKEUSDT',
  CRV: 'BINANCE:CRVUSDT',
  MKR: 'BINANCE:MKRUSDT',
  LDO: 'BINANCE:LDOUSDT',
  SAND: 'BINANCE:SANDUSDT',
  MANA: 'BINANCE:MANAUSDT',
  GRT: 'BINANCE:GRTUSDT',
  ALGO: 'BINANCE:ALGOUSDT',
  HBAR: 'BINANCE:HBARUSDT',
  VET: 'BINANCE:VETUSDT',
  EGLD: 'BINANCE:EGLDUSDT',
  FLOW: 'BINANCE:FLOWUSDT',
  THETA: 'BINANCE:THETAUSDT',
  AXS: 'BINANCE:AXSUSDT',
  APE: 'BINANCE:APEUSDT',
  GALA: 'BINANCE:GALAUSDT',
  ENS: 'BINANCE:ENSUSDT',
  COMP: 'BINANCE:COMPUSDT',
  SNX: 'BINANCE:SNXUSDT',
  RUNE: 'BINANCE:RUNEUSDT',
  ONE: 'BINANCE:ONEUSDT',
  KAVA: 'BINANCE:KAVAUSDT',
  ZIL: 'BINANCE:ZILUSDT',
};

export function getTradingViewSymbol(tokenSymbol: string, chain?: string): string | null {
  if (!tokenSymbol) return null;
  const upper = tokenSymbol.toUpperCase().replace('$', '');
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
  return `BINANCE:${upper}USDT`;
}

export function isKnownTradingViewSymbol(tokenSymbol: string): boolean {
  if (!tokenSymbol) return false;
  const upper = tokenSymbol.toUpperCase().replace('$', '');
  return !!SYMBOL_MAP[upper];
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  interval?: string;
  showTools?: boolean;
}

function loadTradingViewScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.TradingView) {
      resolve();
      return;
    }
    const existing = document.getElementById('tradingview-widget-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      if (window.TradingView) resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'tradingview-widget-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

function TradingViewChartInner({ symbol, height = 400, interval = '60', showTools = false }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await loadTradingViewScript();
      if (!mounted || !containerRef.current || !window.TradingView) return;

      containerRef.current.innerHTML = '';

      widgetRef.current = new window.TradingView.widget({
        symbol: symbol,
        interval: interval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0A0E1A',
        enable_publishing: false,
        hide_top_toolbar: !showTools,
        hide_side_toolbar: !showTools,
        allow_symbol_change: false,
        save_image: false,
        container_id: containerRef.current.id,
        autosize: true,
        backgroundColor: '#0A0E1A',
        gridColor: '#1A2235',
        studies: ['Volume@tv-basicstudies'],
        loading_screen: { backgroundColor: '#0A0E1A', foregroundColor: '#0A1EFF' },
        overrides: {
          'paneProperties.background': '#0A0E1A',
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': '#1A2235',
          'paneProperties.horzGridProperties.color': '#1A2235',
          'scalesProperties.backgroundColor': '#0A0E1A',
          'scalesProperties.textColor': '#6B7280',
          'mainSeriesProperties.candleStyle.upColor': '#0A1EFF',
          'mainSeriesProperties.candleStyle.downColor': '#EF4444',
          'mainSeriesProperties.candleStyle.wickUpColor': '#0A1EFF',
          'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
          'mainSeriesProperties.candleStyle.borderUpColor': '#0A1EFF',
          'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
        },
      });
    };

    init();

    return () => {
      mounted = false;
      if (widgetRef.current) {
        try { widgetRef.current.remove?.(); } catch { /* Widget already destroyed — ignore */ }
        widgetRef.current = null;
      }
    };
  }, [symbol, interval, showTools]);

  const idCounter = useRef(0);
  const stableId = useRef(`tv-chart-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}-${++idCounter.current}`);

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height: `${height}px`, width: '100%' }}>
      <div
        ref={containerRef}
        id={stableId.current}
        style={{ height: `${height}px`, width: '100%' }}
      />
      {/* Cover TradingView's bottom-right logo ribbon with a matching-color
          overlay. The free widget doesn't expose an option to hide the
          branding — this is the standard workaround used across Naka's
          chart views to keep the surface clean. */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{ right: 0, bottom: 0, width: 120, height: 28, background: '#0A0E1A' }}
      />
    </div>
  );
}

const TradingViewChart = memo(TradingViewChartInner);
export default TradingViewChart;
