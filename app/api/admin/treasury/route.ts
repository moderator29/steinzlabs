import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

interface WalletConfig {
  chain: string;
  address: string;
  label: string;
  nativeSymbol: string;
}

interface EnrichedWallet extends WalletConfig {
  nativeBalance: number;
  nativePriceUsd: number;
  usdcBalance: number;
  totalUsd: number;
}

const EVM_CHAINS: Record<string, string> = {
  Ethereum: 'eth-mainnet',
  Base:     'base-mainnet',
  Arbitrum: 'arb-mainnet',
  BSC:      'bnb-mainnet',
};

async function fetchEvmNativeBalance(network: string, address: string, apiKey: string): Promise<number> {
  try {
    const url = `https://${network}.g.alchemy.com/v2/${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    const hex: string = json?.result ?? '0x0';
    // Convert from wei (18 decimals) to native token
    return parseInt(hex, 16) / 1e18;
  } catch {
    return 0;
  }
}

async function fetchSolNativeBalance(address: string): Promise<number> {
  try {
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    const lamports: number = json?.result?.value ?? 0;
    return lamports / 1e9;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();

    // Load wallet configs from platform_settings
    const { data: setting, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'treasury_wallets')
      .single();

    if (error || !setting) {
      return NextResponse.json({ wallets: [] });
    }

    let walletConfigs: WalletConfig[] = [];
    try {
      walletConfigs = typeof setting.value === 'string'
        ? JSON.parse(setting.value)
        : setting.value;
    } catch {
      return NextResponse.json({ wallets: [] });
    }

    if (!Array.isArray(walletConfigs) || walletConfigs.length === 0) {
      return NextResponse.json({ wallets: [] });
    }

    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';

    const enriched: EnrichedWallet[] = await Promise.all(
      walletConfigs.map(async (w): Promise<EnrichedWallet> => {
        let nativeBalance = 0;

        const evmNetwork = EVM_CHAINS[w.chain];
        if (evmNetwork && alchemyKey) {
          nativeBalance = await fetchEvmNativeBalance(evmNetwork, w.address, alchemyKey);
        } else if (w.chain === 'Solana') {
          nativeBalance = await fetchSolNativeBalance(w.address);
        }

        return {
          ...w,
          nativeBalance,
          nativePriceUsd: 0,   // price feeds can be added separately
          usdcBalance: 0,       // USDC balance requires ERC-20 call — placeholder
          totalUsd: 0,
        };
      })
    );

    return NextResponse.json({ wallets: enriched });
  } catch (err) {
    console.error('[admin/treasury GET] Failed:', err);
    return NextResponse.json({ wallets: [] });
  }
}
