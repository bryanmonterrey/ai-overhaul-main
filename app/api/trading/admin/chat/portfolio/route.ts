// app/api/admin/trading/chat/portfolio/route.ts
import { NextResponse } from 'next/server';
import { solanaService } from '../../../../../lib/solana';
import { PublicKey } from '@solana/web3.js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');
    
    const portfolio = await solanaService.getPortfolio(new PublicKey(walletAddress!));
    const portfolioWithPrices = await Promise.all(portfolio.map(async token => {
      const price = await solanaService.pythFetchPrice(token.mint);
      return {
        ...token,
        price,
        value: token.amount * parseFloat(price)
      };
    }));

    return NextResponse.json({ portfolio: portfolioWithPrices });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}