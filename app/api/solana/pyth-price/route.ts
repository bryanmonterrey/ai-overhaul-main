// app/api/solana/pyth-price/route.ts
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

    // Use the correct method name from the toolkit
    const price = await solanaService.pythFetchPrice(token_address);

    return NextResponse.json({
      success: true,
      data: price
    });
  } catch (error) {
    console.error('Pyth price fetch error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch price"
      }, 
      { status: 500 }
    );
  }
}
