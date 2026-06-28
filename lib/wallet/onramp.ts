/**
 * Fiat on-ramp (#30) — real, env-gated hosted-widget deep links.
 *
 * No secret keys and no fabricated data: this builds a URL to a real
 * hosted on-ramp (Transak or MoonPay) that handles KYC + card/bank
 * payment on the provider's side and delivers crypto straight to the
 * user's wallet address on the correct network. When the provider isn't
 * configured (no env key), getOnrampUrl returns null and the UI shows an
 * honest "not yet available" state — never a fake flow.
 *
 * Owner setup (one of):
 *   NEXT_PUBLIC_ONRAMP_PROVIDER = "transak" | "moonpay"
 *   NEXT_PUBLIC_TRANSAK_API_KEY = <Transak partner api key>
 *   NEXT_PUBLIC_MOONPAY_API_KEY = <MoonPay publishable key>
 *   NEXT_PUBLIC_ONRAMP_ENV      = "staging" | "production" (default production)
 *
 * Funds-safety: we always pass BOTH the wallet address AND the explicit
 * network/asset so the provider can't deliver to the wrong chain. If a
 * chain isn't supported by the configured provider, we return null rather
 * than guess.
 */

export type OnrampProvider = 'transak' | 'moonpay';

export interface OnrampConfig {
  provider: OnrampProvider | null;
  configured: boolean;
}

/** Transak network identifiers per our internal chain ids. */
const TRANSAK_NETWORK: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'polygon',
  bsc: 'bsc',
  avalanche: 'avaxcchain',
  solana: 'solana',
};

/** Native asset code per chain (what the user buys by default). */
const NATIVE_CODE: Record<string, string> = {
  ethereum: 'ETH',
  base: 'ETH',
  arbitrum: 'ETH',
  optimism: 'ETH',
  polygon: 'POL',
  bsc: 'BNB',
  avalanche: 'AVAX',
  solana: 'SOL',
};

/** MoonPay currencyCode per chain native (its codes fold network in). */
const MOONPAY_CODE: Record<string, string> = {
  ethereum: 'eth',
  base: 'eth_base',
  arbitrum: 'eth_arbitrum',
  optimism: 'eth_optimism',
  polygon: 'pol_polygon',
  bsc: 'bnb_bsc',
  avalanche: 'avax_cchain',
  solana: 'sol',
};

function resolveProvider(): OnrampProvider | null {
  const p = (process.env.NEXT_PUBLIC_ONRAMP_PROVIDER ?? '').toLowerCase();
  if (p === 'transak' && process.env.NEXT_PUBLIC_TRANSAK_API_KEY) return 'transak';
  if (p === 'moonpay' && process.env.NEXT_PUBLIC_MOONPAY_API_KEY) return 'moonpay';
  // Auto-detect when provider unset but exactly one key is present.
  if (!p) {
    if (process.env.NEXT_PUBLIC_TRANSAK_API_KEY) return 'transak';
    if (process.env.NEXT_PUBLIC_MOONPAY_API_KEY) return 'moonpay';
  }
  return null;
}

/** Whether a fiat on-ramp is configured at all (drives the UI copy). */
export function getOnrampConfig(): OnrampConfig {
  const provider = resolveProvider();
  return { provider, configured: provider !== null };
}

/**
 * Build a hosted on-ramp URL for an address on a chain, or null when the
 * provider is unconfigured or doesn't support the chain. The widget is
 * meant to open in a new tab / external browser.
 */
export function getOnrampUrl(params: { address: string; chain: string; fiat?: string }): string | null {
  const provider = resolveProvider();
  if (!provider) return null;
  const { address, chain } = params;
  if (!address) return null;
  const staging = (process.env.NEXT_PUBLIC_ONRAMP_ENV ?? 'production').toLowerCase() === 'staging';
  const fiat = (params.fiat ?? 'USD').toUpperCase();

  if (provider === 'transak') {
    const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY!;
    const network = TRANSAK_NETWORK[chain];
    const code = NATIVE_CODE[chain];
    if (!network || !code) return null;
    const host = staging ? 'https://global-stg.transak.com' : 'https://global.transak.com';
    const qs = new URLSearchParams({
      apiKey,
      walletAddress: address,
      network,
      cryptoCurrencyCode: code,
      defaultCryptoCurrency: code,
      fiatCurrency: fiat,
      disableWalletAddressForm: 'true',
    });
    return `${host}/?${qs.toString()}`;
  }

  // moonpay
  const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY!;
  const code = MOONPAY_CODE[chain];
  if (!code) return null;
  const host = staging ? 'https://buy-sandbox.moonpay.com' : 'https://buy.moonpay.com';
  const qs = new URLSearchParams({
    apiKey,
    walletAddress: address,
    currencyCode: code,
    baseCurrencyCode: fiat.toLowerCase(),
  });
  return `${host}?${qs.toString()}`;
}
