/**
 * Koinly-schema CSV export. Koinly accepts a universal CSV format
 * for imports; matching it lets users drop our export straight into
 * their tax software without column-remapping gymnastics.
 *
 * Schema (https://help.koinly.io/en/articles/3662999-how-to-create-a-custom-csv-file):
 *
 *   Date,Sent Amount,Sent Currency,Received Amount,Received Currency,
 *   Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,
 *   Label,Description,TxHash
 *
 * Audit §B.1 portfolio P1.
 */

export interface PortfolioTransaction {
  /** UNIX seconds. */
  timestamp: number;
  /** 'buy' | 'sell' | 'swap' | 'transfer_in' | 'transfer_out' | 'reward' | 'fee'. */
  kind: string;
  /** What the user paid (or sent). Empty for transfer_in / reward. */
  sentAmount: number | null;
  sentCurrency: string | null;
  /** What the user received. Empty for transfer_out / fee. */
  receivedAmount: number | null;
  receivedCurrency: string | null;
  /** Gas / platform fee in native units. */
  feeAmount: number | null;
  feeCurrency: string | null;
  /** USD value of the position at the time of the trade. */
  valueUsd: number | null;
  /** Optional Koinly label (Reward / Airdrop / Income). */
  label?: string | null;
  description?: string | null;
  txHash?: string | null;
}

const KIND_TO_LABEL: Record<string, string> = {
  reward: 'Reward',
  airdrop: 'Airdrop',
  transfer_in: 'Transfer',
  transfer_out: 'Transfer',
};

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fmtNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  // Avoid 1e-7 style; Koinly wants decimal.
  return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

const HEADER = [
  'Date',
  'Sent Amount',
  'Sent Currency',
  'Received Amount',
  'Received Currency',
  'Fee Amount',
  'Fee Currency',
  'Net Worth Amount',
  'Net Worth Currency',
  'Label',
  'Description',
  'TxHash',
];

export function toKoinlyCsv(rows: PortfolioTransaction[]): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) {
    const cells = [
      isoDate(r.timestamp),
      fmtNumber(r.sentAmount),
      r.sentCurrency ?? '',
      fmtNumber(r.receivedAmount),
      r.receivedCurrency ?? '',
      fmtNumber(r.feeAmount),
      r.feeCurrency ?? '',
      fmtNumber(r.valueUsd),
      r.valueUsd !== null ? 'USD' : '',
      r.label ?? KIND_TO_LABEL[r.kind] ?? '',
      r.description ?? '',
      r.txHash ?? '',
    ].map(escapeCsvField);
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}
