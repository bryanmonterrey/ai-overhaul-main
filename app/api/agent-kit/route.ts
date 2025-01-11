import { NextRequest, NextResponse } from "next/server";
import { TradingApi } from "../../trading/services/TradingApi";
import { headers } from 'next/headers';

// Initialize trading API with environment variable validation
function initializeTradingApi() {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Generate a random base58 key for readonly mode
    const readonlyKey = 'readonly';  // Use readonly mode instead of trying to decode a key

    return new TradingApi({
        wsUrl: wsUrl || 'ws://localhost:3000',
        baseUrl: baseUrl || 'http://localhost:3000',
        rpcUrl: rpcUrl || 'https://api.mainnet-beta.solana.com',
        openaiApiKey: openaiKey || '',
        privateKey: readonlyKey  // Pass readonly mode
    });
}

const tradingApi = initializeTradingApi();

export async function POST(req: NextRequest) {
    try {
        const headersList = await headers();
        const body = await req.json();
        const { action, params } = body;

        // Enhanced session handling
        const tradeSession = headersList.get('x-trading-session');
        const walletSignature = headersList.get('x-wallet-signature');
        const originalSignature = headersList.get('x-original-signature');
        
        // Separate user context from session info
        const { context, ...otherParams } = params;
        const { userId, userRole, ...sessionContext } = context || {};

        // Prepare wallet info with proper session structure
        if (params.wallet) {
            const originalSignature = params.wallet.credentials?.signature;

            params.wallet = {
                ...params.wallet,
                signature: originalSignature,  // Use original signature
                sessionId: tradeSession,      // UUID for session tracking
                credentials: {
                    ...params.wallet.credentials,
                    signature: originalSignature,     // Keep original signature
                    sessionId: tradeSession,          // Session ID for tracking
                    sessionSignature: originalSignature, // Use original signature, not session ID
                    signTransaction: true,
                    signAllTransactions: true,
                    connected: true
                }
            };
        }

        switch (action) {
            case 'initSession':
                if (!params.wallet?.credentials?.signature) {
                    return NextResponse.json({
                        success: false,
                        error: 'Wallet signature required',
                        code: 'MISSING_SIGNATURE'
                    }, { status: 400 });
                }

                const sessionResult = await tradingApi.initSession(params.wallet);
                return NextResponse.json(sessionResult);

            case 'trade':
                if (!params.wallet) {
                    return NextResponse.json({
                        success: false,
                        error: 'Wallet information required',
                        code: 'MISSING_WALLET'
                    }, { status: 400 });
                }

                const tradeStream = await tradingApi.executeTrade({
                    inputMint: params.inputMint,
                    outputMint: params.outputMint,
                    amount: params.amount,
                    slippage: params.slippage || 100, // Default 1% slippage
                    wallet: params.wallet
                });

                return new Response(
                    new ReadableStream({
                        start(controller) {
                            const subscription = tradeStream.subscribe({
                                next: (value) => {
                                    controller.enqueue(
                                        new TextEncoder().encode(
                                            `data: ${JSON.stringify(value)}\n\n`
                                        )
                                    );
                                },
                                error: (error) => {
                                    console.error('Trade stream error:', error);
                                    controller.enqueue(
                                        new TextEncoder().encode(
                                            `data: ${JSON.stringify({
                                                success: false,
                                                error: error.message || 'Trade execution failed',
                                                code: 'TRADE_STREAM_ERROR'
                                            })}\n\n`
                                        )
                                    );
                                    controller.close();
                                },
                                complete: () => {
                                    controller.close();
                                }
                            });

                            return () => subscription.unsubscribe();
                        }
                    }),
                    {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive'
                        }
                    }
                );

            case 'getTokenData':
                const tokenData = await tradingApi.getTokenInfo(params.mint);
                return NextResponse.json(tokenData);

            case 'getPrice':
                if (!params.mint) {
                    return NextResponse.json(
                        { success: false, error: 'Missing mint address' },
                        { status: 400 }
                    );
                }
                const price = await tradingApi.getTokenPrice(params.mint);
                return NextResponse.json({ success: true, price });

            case 'getRoutes':
                const routes = await tradingApi.getRoutes(
                    params.inputMint,
                    params.outputMint,
                    params.amount
                );
                return NextResponse.json(routes);

            case 'analyzeMarket':
                const analysis = await tradingApi.analyzeMarket(params.asset);
                return NextResponse.json(analysis);

            case 'streamChat':
                if (!params.messages || !Array.isArray(params.messages)) {
                    return NextResponse.json(
                        { success: false, error: 'Invalid messages format' },
                        { status: 400 }
                    );
                }

                const chatStream = await tradingApi.processTradingChat(
                    params.messages,
                    params.wallet
                );

                return new Response(chatStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                });

            case 'validateSession':
                if (!params.wallet?.publicKey) {
                    return NextResponse.json({
                        success: false,
                        error: 'Invalid session parameters',
                        code: 'INVALID_SESSION'
                    }, { status: 400 });
                }

                const validationResult = await tradingApi.validateSession(
                    params.wallet.publicKey,
                    tradeSession || ''
                );
                return NextResponse.json({ 
                    success: true, 
                    valid: validationResult,
                    sessionId: tradeSession 
                });

            default:
                return NextResponse.json(
                    { success: false, error: 'Unknown action' },
                    { status: 400 }
                );
        }
    } catch (e: any) {
        console.error('Agent kit error:', e);

        // Enhanced error handling
        const errorResponse = {
            success: false,
            error: e.message || 'Internal server error',
            code: e.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };

        // Special handling for session errors
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
            'portfolio management',
            'streaming chat'
        ]
    });
}

// Use nodejs runtime instead of edge to avoid env variable issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';