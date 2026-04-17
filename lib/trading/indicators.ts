// Pure TS indicator math. No deps. Used by AdvancedChart for overlay series.

import type { Candle } from "@/lib/services/ohlcv";

export interface LinePoint {
  time: number;
  value: number;
}

export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

export function ema(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const v = i === 0 ? candles[0].close : candles[i].close * k + prev * (1 - k);
    prev = v;
    if (i >= period - 1) out.push({ time: candles[i].time, value: v });
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  gains /= period;
  losses /= period;
  let rs = losses === 0 ? 100 : gains / losses;
  out.push({ time: candles[period].time, value: 100 - 100 / (1 + rs) });
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    gains = (gains * (period - 1) + up) / period;
    losses = (losses * (period - 1) + down) / period;
    rs = losses === 0 ? 100 : gains / losses;
    out.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
  }
  return out;
}

export interface BollingerBands {
  upper: LinePoint[];
  middle: LinePoint[];
  lower: LinePoint[];
}

export function bollinger(candles: Candle[], period = 20, stdDev = 2): BollingerBands {
  const middle = sma(candles, period);
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map((c) => c.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const time = candles[i].time;
    upper.push({ time, value: mean + sd * stdDev });
    lower.push({ time, value: mean - sd * stdDev });
  }
  return { upper, middle, lower };
}

export function vwap(candles: Candle[]): LinePoint[] {
  const out: LinePoint[] = [];
  let cumPV = 0;
  let cumV = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const v = c.volume ?? 0;
    cumPV += typicalPrice * v;
    cumV += v;
    out.push({ time: c.time, value: cumV > 0 ? cumPV / cumV : c.close });
  }
  return out;
}

export interface MacdSeries {
  macd: LinePoint[];
  signal: LinePoint[];
  histogram: LinePoint[];
}

export function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdSeries {
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  const offset = emaSlow.length > 0 && emaFast.length > 0 ? emaFast.length - emaSlow.length : 0;
  const macdLine: LinePoint[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push({ time: emaSlow[i].time, value: emaFast[i + offset].value - emaSlow[i].value });
  }
  // signal = EMA of macd line
  const signal: LinePoint[] = [];
  if (macdLine.length > 0) {
    const k = 2 / (signalPeriod + 1);
    let prev = macdLine[0].value;
    for (let i = 0; i < macdLine.length; i++) {
      const v = i === 0 ? prev : macdLine[i].value * k + prev * (1 - k);
      prev = v;
      if (i >= signalPeriod - 1) signal.push({ time: macdLine[i].time, value: v });
    }
  }
  const histOffset = macdLine.length - signal.length;
  const histogram: LinePoint[] = signal.map((s, i) => ({
    time: s.time,
    value: macdLine[i + histOffset].value - s.value,
  }));
  return { macd: macdLine, signal, histogram };
}
