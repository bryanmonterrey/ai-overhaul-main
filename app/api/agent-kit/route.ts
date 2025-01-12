// app/api/agent-kit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from 'next/headers';
import { PublicKey, Keypair } from "@solana/web3.js";
import { WebWalletAgentKit } from "../../trading/WebWalletAgentKit";
import { createClient } from '@supabase/supabase-js';
import bs58 from "bs58";

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function initializeAgentKit(wallet: any) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const openaiKey = process.env.OPENAI_API_KEY;

    const walletAdapter = {
        publicKey: new PublicKey(wallet.publicKey),
        sessionId: wallet.sessionId,
        sessionSignature: wallet.sessionSignature || wallet.signature,
        originalSignature: wallet.signature,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs
    };

    return new WebWalletAgentKit(
        walletAdapter,
        rpcUrl,
        {
            OPENAI_API_KEY: openaiKey || '',
            supabase
        }
    );
}

export async function POST(req: NextRequest) {
   try {
       const headersList = await headers();
       const body = await req.json();
       const { action, params } = body;

       // Enhanced session handling
       const sessionId = headersList.get('x-trading-session');
       const originalSignature = headersList.get('x-original-signature');
       
       // Update wallet info with session data
       if (params.wallet) {
           params.wallet = {
               ...params.wallet,
               sessionId: sessionId,
               sessionSignature: originalSignature,
               signature: originalSignature,
               credentials: {
                   ...params.wallet.credentials,
                   sessionId: sessionId,
                   sessionSignature: originalSignature,
                   signature: originalSignature,
                   signTransaction: true,
                   signAllTransactions: true,
                   connected: true
               }
           };
       }

       // Initialize agent kit with wallet
       const agent = initializeAgentKit(params.wallet);

       switch (action) {
           case 'trade':
               if (!params.wallet) {
                   return NextResponse.json({
                       success: false,
                       error: 'Wallet information required',
                       code: 'MISSING_WALLET'
                   }, { status: 400 });
               }

               const tradeResult = await agent.trade(
                   new PublicKey(params.outputMint),
                   params.inputAmount,
                   params.inputMint ? new PublicKey(params.inputMint) : undefined,
                   params.slippageBps || 100
               );

               return NextResponse.json({
                   success: true,
                   signature: tradeResult
               });

           case 'getTokenData':
               const tokenData = await agent.getTokenDataByAddress(params.mint);
               return NextResponse.json({ success: true, data: tokenData });

           case 'getPrice':
               if (!params.mint) {
                   return NextResponse.json(
                       { success: false, error: 'Missing mint address' },
                       { status: 400 }
                   );
               }
               const price = await agent.fetchTokenPrice(params.mint);
               return NextResponse.json({ success: true, price });

           case 'getRoutes':
               const routes = await agent.getRoutes(
                   params.inputMint,
                   params.outputMint,
                   params.amount
               ); 
               return NextResponse.json(routes);

           case 'validateSession':
               if (!params.wallet?.publicKey) {
                   return NextResponse.json({
                       success: false,
                       error: 'Invalid session parameters',
                       code: 'INVALID_SESSION'
                   }, { status: 400 });
               }

               // Use the agent's session validation
               const sessionInfo = agent.getSessionInfo();
               return NextResponse.json({ 
                   success: true,
                   ...sessionInfo
               });

           default:
               return NextResponse.json(
                   { success: false, error: 'Unknown action' },
                   { status: 400 }
               );
       }
   } catch (e: any) {
       console.error('Agent kit error:', e);

       const errorResponse = {
           success: false,
           error: e.message || 'Internal server error',
           code: e.code || 'UNKNOWN_ERROR',
           timestamp: new Date().toISOString()
       };

       if (e.message?.includes('session')) {
           return NextResponse.json({
               ...errorResponse,
               code: 'SESSION_ERROR',
               session_message: 'Session initialization required'
           }, { status: 401 });
       }

       return NextResponse.json(errorResponse, { 
           status: e.status ?? 500 
       });
   }
}

export async function GET() {
   return NextResponse.json({
       status: 'healthy',
       version: '1.0.0',
       features: [
           'trading',
           'market analysis',
           'portfolio management'
       ]
   });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';