// app/api/agent-kit/route.ts

import { NextResponse } from 'next/server';
import { verifySession } from '../../lib/auth/session-verification';
import { tradeExecution } from '../../trading/services/execution';
import { ExtendedSolanaAgentKit } from '../../trading/services/extended-agent-kit';
import { Keypair } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { serverSupabase } from '../../lib/supabase/server-client';

export const runtime = 'nodejs';

// Updated interface for session storage
interface KitSession {
  kit: ExtendedSolanaAgentKit;
  expiresAt: number;
  signature: string;
}

// Store active agent-kit instances with signatures
const activeKits = new Map<string, KitSession>();

function validateEnvironment() {
  if (!process.env.NEXT_PUBLIC_RPC_URL) {
    console.error('Missing RPC URL environment variable');
    throw new Error('Server configuration error: Missing RPC URL');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OpenAI API key environment variable');
    throw new Error('Server configuration error: Missing OpenAI API key');
  }
}

function createAgentKit(): ExtendedSolanaAgentKit {
  try {
    return new ExtendedSolanaAgentKit(
      'readonly',
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!
    );
  } catch (error: any) {
    console.error('Failed to create agent kit:', error);
    throw new Error(`Agent kit initialization failed: ${error.message}`);
  }
}

export async function POST(req: Request) {
  try {
    validateEnvironment();

    const body = await req.json();
    console.log('Request body:', body);

    const { action, params } = body;

    if (action === 'trade') {
      const sessionId = req.headers.get('X-Trading-Session');
      const publicKey = params.wallet?.publicKey;

      if (!sessionId || !publicKey) {
        return NextResponse.json({
          error: 'Session ID and public key required',
          code: 'SESSION_REQUIRED'
        }, { status: 401 });
      }

      // Get session from database
      const { data: session } = await serverSupabase
        .from('trading_sessions')
        .select()
        .eq('public_key', publicKey)
        .eq('signature', sessionId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return NextResponse.json({
          error: 'No active trading session. Please initialize a session first.',
          code: 'SESSION_INVALID'
        }, { status: 401 });
      }

      // Add session info to params
      params.sessionInfo = session;

      // Execute trade with session info
      const tradeResult = await tradeExecution.executeTradeWithMEV(params, params.wallet);
      return NextResponse.json(tradeResult);
    }

    if (action === 'initSession') {
      if (!params?.wallet?.publicKey || !params?.wallet?.signature) {
        return NextResponse.json({
          error: 'Wallet and signature required for session initialization',
          code: 'INVALID_SESSION_PARAMS'
        }, { status: 400 });
      }

      // Verify initial signature
      const sessionResult = await verifySession({
        publicKey: params.wallet.publicKey,
        signature: params.wallet.signature
      });

      if (!sessionResult.success) {
        return NextResponse.json({
          error: sessionResult.error || 'Session verification failed',
          code: 'SESSION_VERIFICATION_FAILED'
        }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        sessionId: sessionResult.sessionId,
        expiresAt: sessionResult.expiresAt
      });
    }

    // Handle other actions...
    switch (action) {
      case 'getTokenData':
        try {
          const kit = createAgentKit();
          let tokenData;
          if (params.symbol) {
            tokenData = await kit.getTokenDataByTicker(params.symbol);
          } else if (params.mint) {
            tokenData = await kit.getTokenDataByAddress(params.mint);
          } else {
            return NextResponse.json({
              error: 'Either symbol or mint address required'
            }, { status: 400 });
          }
          return NextResponse.json({ success: true, data: tokenData });
        } catch (error: any) {
          console.error('Token data error:', error);
          return NextResponse.json({
            error: 'Failed to fetch token data',
            details: error.message
          }, { status: 500 });
        }

      case 'getPrice':
        try {
          const kit = createAgentKit();
          const price = await kit.fetchTokenPrice(params.mint);
          return NextResponse.json({ success: true, price });
        } catch (error: any) {
          return NextResponse.json({
            error: 'Failed to fetch price',
            details: error.message
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          action: action,
          supported: ['initSession', 'trade', 'getTokenData', 'getPrice']
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Agent-kit API error:', error);
    return NextResponse.json({
      error: error.message,
      type: error.name,
      code: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}