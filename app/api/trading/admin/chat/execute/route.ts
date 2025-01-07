// app/api/trading/admin/chat/execute/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { solanaService } from '../../../../../lib/solana';
import { PublicKey } from '@solana/web3.js';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore
    });

    const { trade, walletInfo } = await req.json();
    const { token, side, amount, userSlippage } = trade;
    
    // Validate basic info
    if (!walletInfo?.publicKey || !walletInfo?.credentials?.signature) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing wallet or session info',
        code: 'SESSION_REQUIRED'
      }, { status: 401 });
    }

    // Input validation (preserved from original)
    if (!token || !side || !amount) {
      return NextResponse.json({ 
        error: "Missing required parameters" 
      }, { status: 400 });
    }

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

    // Verify session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('wallet_address', walletInfo.publicKey)
      .eq('signature', walletInfo.credentials.signature)
      .eq('is_active', true)
      .lte('created_at', new Date().toISOString())
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({
        success: false,
        error: 'Invalid session',
        code: 'SESSION_INVALID',
        message: 'Please sign message to start trading session'
      }, { status: 401 });
    }

    // Fetch market data (preserved from original)
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

    // Set up trade parameters (preserved from original)
    const sourceMint = side === 'buy' 
      ? new PublicKey("So11111111111111111111111111111111111111112") 
      : new PublicKey(token);
      
    const targetMint = side === 'buy' 
      ? new PublicKey(token) 
      : new PublicKey("So11111111111111111111111111111111111111112");

    // Update session last used timestamp
    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionData.id);

    // Execute trade
    const signature = await solanaService.trade({
      targetMint,
      amount: amount * Math.pow(10, tokenData.decimals),
      inputMint: sourceMint,
      slippage: userSlippage || 100,
      walletInfo: {
        ...walletInfo,
        sessionId: sessionData.id,
        sessionSignature: sessionData.signature
      }
    });

    // Store trade in database (preserved from original)
    const { error: dbError } = await supabase
      .from('trades')
      .insert({
        token,
        side,
        amount,
        price: priceData,
        signature,
        executed_at: new Date().toISOString(),
        slippage: userSlippage || 100,
        token_price: priceData,
        session_id: sessionData.id,
        wallet_address: walletInfo.publicKey
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

    // Store error in database (preserved from original)
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