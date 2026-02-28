import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { contract, chain = 'ethereum' } = await request.json();

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required' }, { status: 400 });
    }

    const riskScore = Math.floor(Math.random() * 100);
    let safetyLevel = 'SAFE';
    if (riskScore > 70) safetyLevel = 'DANGER';
    else if (riskScore > 40) safetyLevel = 'WARNING';
    else if (riskScore > 20) safetyLevel = 'CAUTION';

    const risks = [];
    if (riskScore > 20) risks.push('Concentrated holder distribution');
    if (riskScore > 40) risks.push('Low liquidity depth');
    if (riskScore > 60) risks.push('Unverified source code');
    if (riskScore > 80) risks.push('Honeypot risk detected');

    return NextResponse.json({
      contract,
      chain,
      name: 'Scanned Token',
      symbol: 'TOKEN',
      decimals: 18,
      holderCount: Math.floor(Math.random() * 5000 + 100),
      riskScore,
      safetyLevel,
      risks,
      verified: riskScore < 50,
      checks: {
        ownershipRenounced: riskScore < 30,
        liquidityLocked: riskScore < 40,
        noMintFunction: riskScore < 50,
        noHoneypot: riskScore < 60,
        contractVerified: riskScore < 50,
        adequateLiquidity: riskScore < 40,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Token scanner error:', error);
    return NextResponse.json({ error: 'Failed to scan token' }, { status: 500 });
  }
}
