// app/api/admin/trading/chat/history/route.ts
import { createClient } from '@supabase/supabase-js';
import { solanaService } from '../../../../../lib/solana';
import { NextResponse } from 'next/server';

const supabase = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
 try {
   const { searchParams } = new URL(req.url);
   const walletAddress = searchParams.get('wallet');
   const limit = parseInt(searchParams.get('limit') || '50');

   const { data: trades } = await supabase
     .from('trades')
     .select('*')
     .eq('wallet_address', walletAddress)
     .order('executed_at', { ascending: false })
     .limit(limit);

   const tradesWithPrices = await Promise.all(trades!.map(async trade => ({
     ...trade,
     currentPrice: await solanaService.pythFetchPrice(trade.token)
   })));

   return NextResponse.json({ trades: tradesWithPrices });
 } catch (error) {
   return NextResponse.json({ error: error.message }, { status: 500 });
 }
}