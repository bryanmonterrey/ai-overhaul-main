// app/api/solana/token-data/route.ts
import { NextResponse } from 'next/server';
import { solanaService } from '../../../lib/solana';

export async function POST(request: Request) {
  try {
    const { token_address, wallet_address } = await request.json();

    if (!wallet_address) {
      return NextResponse.json(
        { error: "Wallet connection required" }, 
        { status: 401 }
      );
    }

    const data = await solanaService.getTokenData(token_address);
    
    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Token data fetch error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch token data"
      }, 
      { status: 500 }
    );
  }
}