// app/api/admin/trading/chat/risk/route.ts

import { NextResponse } from 'next/server';
import { solanaService } from '../../../../../lib/solana';
import { PublicKey } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { token, amount, walletAddress } = await req.json();
    
    const portfolio = await solanaService.getPortfolio(new PublicKey(walletAddress));
    const portfolioValue = await calculatePortfolioValue(portfolio);
    
    const riskMetrics = {
      positionSize: (amount * parseFloat(await solanaService.pythFetchPrice(token))) / portfolioValue,
      maxPositionSize: 0.2, // 20% of portfolio
      riskLevel: calculateRiskLevel(token, amount, portfolioValue),
      exposureToToken: calculateExposure(portfolio, token)
    };

    // Store risk check in database
    await supabase.from('risk_checks').insert({
      token,
      amount,
      wallet_address: walletAddress,
      risk_metrics: riskMetrics,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ riskMetrics });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function calculatePortfolioValue(portfolio: any[]) {
  return Promise.all(portfolio.map(async token => {
    const price = await solanaService.pythFetchPrice(token.mint);
    return token.amount * parseFloat(price);
  })).then(values => values.reduce((a, b) => a + b, 0));
}

function calculateRiskLevel(token: string, amount: number, portfolioValue: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  const positionSize = amount / portfolioValue;
  if (positionSize > 0.2) return 'HIGH';
  if (positionSize > 0.1) return 'MEDIUM';
  return 'LOW';
}

function calculateExposure(portfolio: any[], token: string) {
  const tokenHolding = portfolio.find(t => t.mint === token);
  return tokenHolding ? tokenHolding.amount : 0;
}