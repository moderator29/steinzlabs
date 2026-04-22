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
  theme?: 'dark' | 'light';
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

function TradingViewChartInner({ symbol, height = 400, interval = '15', showTools = false, theme = 'dark' }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await loadTradingViewScript();
      if (!mounted || !containerRef.current || !window.TradingView) return;

      containerRef.current.innerHTML = '';

      const isLight = theme === 'light';
      const bg = isLight ? '#FFFFFF' : '#0A0E1A';
      const grid = isLight ? '#E2E8F0' : '#1A2235';
      const textCol = isLight ? '#475569' : '#6B7280';
      const upCol = '#10B981';
      const downCol = '#EF4444';

      widgetRef.current = new window.TradingView.widget({
        symbol: symbol,
        interval: interval,
        timezone: 'Etc/UTC',
        theme: theme,
        style: '1',
        locale: 'en',
        toolbar_bg: bg,
        enable_publishing: false,
        hide_top_toolbar: !showTools,
        hide_side_toolbar: !showTools,
        allow_symbol_change: false,
        save_image: false,
        container_id: containerRef.current.id,
        autosize: true,
        backgroundColor: bg,
        gridColor: grid,
        studies: ['Volume@tv-basicstudies'],
        loading_screen: { backgroundColor: bg, foregroundColor: '#0A1EFF' },
        overrides: {
          'paneProperties.background': bg,
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': grid,
          'paneProperties.horzGridProperties.color': grid,
          'scalesProperties.backgroundColor': bg,
          'scalesProperties.textColor': textCol,
          'mainSeriesProperties.candleStyle.upColor': upCol,
          'mainSeriesProperties.candleStyle.downColor': downCol,
          'mainSeriesProperties.candleStyle.wickUpColor': upCol,
          'mainSeriesProperties.candleStyle.wickDownColor': downCol,
          'mainSeriesProperties.candleStyle.borderUpColor': upCol,
          'mainSeriesProperties.candleStyle.borderDownColor': downCol,
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
  }, [symbol, interval, showTools, theme]);

  const idCounter = useRef(0);
  const stableId = useRef(`tv-chart-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}-${++idCounter.current}`);

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height: `${height}px`, width: '100%' }}>
      <div
        ref={containerRef}
        id={stableId.current}
        style={{ height: `${height}px`, width: '100%' }}
      />
      {/* Cover TradingView's logo ribbons (bottom-right attribution and
          top-left symbol badge). The free widget doesn't expose an option to
          hide the branding, so we overlay with a theme-matched patch. Size is
          generous to catch the "tracking view" text on narrow widths too. */}
      <div
        aria-hidden
        className="absolute pointer-events-none bg-[var(--tv-cover,#0A0E1A)]"
        style={{ right: 0, bottom: 0, width: 180, height: 36 }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none bg-[var(--tv-cover,#0A0E1A)]"
        style={{ left: 0, bottom: 0, width: 140, height: 28 }}
      />
    </div>
  );
}

const TradingViewChart = memo(TradingViewChartInner);
export default TradingViewChart;
