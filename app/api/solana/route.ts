// app/api/solana/route.ts
import { NextResponse } from 'next/server';
import { SolanaAgentKit } from 'solana-agent-kit';

export async function POST(request: Request) {
  try {
    const { action, params, walletKey } = await request.json();
    
    // Create agent instance with the provided wallet key
    const solanaAgent = new SolanaAgentKit(
      walletKey,  // Wallet key from request
      process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      process.env.OPENAI_API_KEY || ""
    );

    switch(action) {
      case 'trade':
        const result = await solanaAgent.trade(
          params.outputMint,
          params.inputAmount,
          params.inputMint,
          params.slippage
        );
        return NextResponse.json({ success: true, data: result });
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}