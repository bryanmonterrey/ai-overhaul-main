// app/api/admin/trading/chat/execute/route.ts
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
   const { token, side, amount, price, userSlippage } = await req.json();
   
   // Validate inputs
   if (!token || !side || !amount) {
     return NextResponse.json({ 
       error: "Missing required parameters" 
     }, { status: 400 });
   }

   // Input validation
   if (side !== 'buy' && side !== 'sell') {
     return NextResponse.json({ 
       error: "Invalid side parameter. Must be 'buy' or 'sell'" 
     }, { status: 400 });
   }

   if (amount <= 0) {
     return NextResponse.json({ 
       error: "Amount must be greater than 0" 
     }, { status: 400 });
   }

   // Fetch market data
   const [tokenData, priceData] = await Promise.all([
     solanaService.getTokenData(token),
     solanaService.pythFetchPrice(token)
   ]);

   // Validate token data
   if (!tokenData) {
     return NextResponse.json({ 
       error: "Invalid token address" 
     }, { status: 400 });
   }

   // Set up trade parameters
   const sourceMint = side === 'buy' 
     ? new PublicKey("So11111111111111111111111111111111111111112") 
     : new PublicKey(token);
     
   const targetMint = side === 'buy' 
     ? new PublicKey(token) 
     : new PublicKey("So11111111111111111111111111111111111111112");

   // Execute trade
   const signature = await solanaService.trade({
     targetMint,
     amount: amount * Math.pow(10, tokenData.decimals),
     inputMint: sourceMint,
     slippage: userSlippage || 100 // Default 1% if not specified
   });

   // Store trade in database
   const { error: dbError } = await supabase
     .from('trades')
     .insert({
       token,
       side,
       amount,
       price,
       signature,
       executed_at: new Date().toISOString(),
       slippage: userSlippage || 100,
       token_price: priceData
     });

   if (dbError) {
     console.error('Database error:', dbError);
   }

   return NextResponse.json({
     success: true,
     signature,
     tokenData,
     priceData,
     execution: {
       timestamp: new Date().toISOString(),
       side,
       amount,
       price: priceData,
       slippage: userSlippage || 100
     }
   });

 } catch (error: any) {
   console.error('Trade execution error:', error);

   // Store error in database
   await supabase
     .from('trade_errors')
     .insert({
       error: error.message,
       stack: error.stack,
       timestamp: new Date().toISOString()
     });

   return NextResponse.json({ 
     error: error.message,
     details: process.env.NODE_ENV === 'development' ? error.stack : undefined
   }, { status: 500 });
 }
}