import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    const chain = request.nextUrl.searchParams.get('chain') || 'solana';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet parameter required' },
        { status: 400 }
      );
    }

    let holdings = [];

    if (chain === 'solana') {
      holdings = await getSolanaHoldings(wallet);
    } else {
      holdings = await getEVMHoldings(wallet, chain);
    }

    return NextResponse.json({ holdings });
  } catch (error: any) {
    console.error('Failed to get holdings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get holdings' },
      { status: 500 }
    );
  }
}

async function getSolanaHoldings(wallet: string) {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl);
  const publicKey = new PublicKey(wallet);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  });

  return tokenAccounts.value.map(account => ({
    address: account.account.data.parsed.info.mint,
    symbol: 'UNKNOWN',
    balance: account.account.data.parsed.info.tokenAmount.uiAmount,
    decimals: account.account.data.parsed.info.tokenAmount.decimals,
  }));
}

async function getEVMHoldings(_wallet: string, _chain: string) {
  return [];
}
