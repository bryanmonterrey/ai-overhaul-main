// app/api/agent-kit/route.ts

import { NextResponse } from 'next/server';
import { verifySession } from '../../lib/auth/session-verification';
import { tradeExecution } from '../../trading/services/execution';
import { ExtendedSolanaAgentKit } from '../../trading/services/extended-agent-kit';
import { Keypair } from '@solana/web3.js';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

export const runtime = 'nodejs';

// Store active agent-kit instances
const activeKits = new Map<string, { kit: ExtendedSolanaAgentKit, expiresAt: number }>();

// Helper function to validate environment variables
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

// Helper function to create an agent kit instance
function createAgentKit(): ExtendedSolanaAgentKit {
  try {
    return new ExtendedSolanaAgentKit(
      'readonly',  // Use the 'readonly' flag instead of generating key here
      process.env.NEXT_PUBLIC_RPC_URL!,
      process.env.OPENAI_API_KEY!
    );
  } catch (error: any) {
    console.error('Failed to create agent kit:', error);
    throw new Error(`Agent kit initialization failed: ${error.message}`);
  }
}

export async function POST(req: Request) {
  console.log('Agent-kit API called with request:', {
    method: req.method,
    headers: Object.fromEntries(req.headers),
  });

  try {
    validateEnvironment();

    const body = await req.json();
    console.log('Request body:', body);

    const { action, params } = body;

    if (!action) {
      return NextResponse.json({
        error: 'Missing action parameter'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('Processing action:', action, 'with params:', params);

    // Initialize agent-kit for sessions if needed
    if (action === 'initSession') {
      if (!params?.wallet?.publicKey || !params?.wallet?.signature) {
        return NextResponse.json({
          error: 'Wallet and signature required for session initialization',
          code: 'INVALID_SESSION_PARAMS'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      try {
        const kit = createAgentKit();
        const sessionId = params.wallet.publicKey;
        const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        activeKits.set(sessionId, {
          kit,
          expiresAt: sessionExpiry
        });

        return NextResponse.json({
          success: true,
          sessionId,
          expiresAt: sessionExpiry
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error: any) {
        console.error('Failed to initialize agent-kit:', error);
        return NextResponse.json({
          error: 'Failed to initialize agent-kit',
          details: error.message,
          code: 'INIT_FAILED'
        }, { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    if (['trade', 'validateTransaction'].includes(action)) {
      const sessionSignature = req.headers.get('X-Trading-Session');

      if (!sessionSignature) {
        return NextResponse.json({
          error: 'No trading session found',
          code: 'SESSION_REQUIRED'
        }, {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      if (!params?.wallet?.publicKey) {
        return NextResponse.json({
          error: 'Wallet public key required',
          code: 'INVALID_WALLET'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Get the agent-kit instance for this session
      const kitSession = activeKits.get(params.wallet.publicKey);
      if (!kitSession || Date.now() > kitSession.expiresAt) {
        activeKits.delete(params.wallet.publicKey);
        return NextResponse.json({
          error: 'Session expired',
          code: 'SESSION_EXPIRED'
        }, {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Verify signature
      const isValidSession = await verifySession(
        params.wallet.publicKey,
        sessionSignature
      );

      if (!isValidSession) {
        return NextResponse.json({
          error: 'Invalid session signature',
          code: 'SESSION_INVALID'
        }, {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Add kit to params for trade execution
      params.kit = kitSession.kit;
    }

    switch (action) {
      case 'trade':
        if (!params?.wallet) {
          return NextResponse.json({
            error: 'Wallet required for trade'
          }, {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const tradeResult = await tradeExecution.executeTradeWithMEV(params, params.wallet);
        return NextResponse.json(tradeResult, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        case 'getTokenData':
    try {
      const kit = createAgentKit();
      let tokenData;
      // Use the correct method based on params
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

      case 'validateSession':
        if (!params?.sessionSignature || !params?.publicKey) {
          return NextResponse.json({
            error: 'Session signature and public key required'
          }, {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        const sessionValid = await verifySession(
          params.publicKey,
          params.sessionSignature
        );
        const kitSession = activeKits.get(params.publicKey);
        return NextResponse.json({
          valid: sessionValid && !!kitSession && Date.now() <= kitSession.expiresAt,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          action: action,
          supported: ['initSession', 'trade', 'getTokenData', 'getPrice', 'getRoutes', 'validateTransaction', 'validateSession']
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error: any) {
    console.error('Agent-kit API detailed error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });

    return NextResponse.json({
      error: error.message,
      type: error.name,
      code: error.code || 'UNKNOWN_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        cause: error.cause
      } : undefined
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}