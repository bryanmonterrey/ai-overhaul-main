// app/api/admin/trading/chat/monitor/route.ts
import { NextResponse } from 'next/server';
import { solanaService } from '../../../../../lib/solana';
import { PublicKey } from '@solana/web3.js';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('wallet');

  try {
    const [portfolio, priceAlerts, positions] = await Promise.all([
      solanaService.getPortfolio(new PublicKey(walletAddress!)),
      getPriceAlerts(walletAddress!),
      getOpenPositions(walletAddress!)
    ]);

    const alerts = await checkAlerts(positions, priceAlerts);
    const stats = calculatePositionStats(positions);

    return NextResponse.json({ portfolio, alerts, stats });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
