// app/api/agent-kit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { TradingApi } from "../../trading/services/TradingApi";
import { headers } from 'next/headers';

// Initialize trading API
const tradingApi = new TradingApi({
    wsUrl: process.env.NEXT_PUBLIC_WS_URL!,
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
    openaiApiKey: process.env.OPENAI_API_KEY!
});

export async function POST(req: NextRequest) {
    try {
        const headersList = await headers();
        const body = await req.json();
        const { action, params } = body;

        // Get session info from headers
        const sessionId = headersList.get('x-trading-session');
        const originalSignature = headersList.get('x-original-signature');

        // Add session info to params if available
        if (sessionId && originalSignature && params.wallet) {
            params.wallet = {
                ...params.wallet,
                sessionId,
                originalSignature,
                credentials: {
                    ...params.wallet.credentials,
                    sessionId,
                    sessionSignature: sessionId,
                    signature: originalSignature
                }
            };
        }

        switch (action) {
            case 'initSession':
                const messages = [
                    {
                        role: 'system' as const,
                        content: 'Initialize trading session.'
                    },
                    {
                        role: 'user' as const,
                        content: 'Please initialize my trading session.'
                    }
                ];
                
                return new Response(
                    await tradingApi.processTradingChat(messages, params.wallet),
                    {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive'
                        }
                    }
                );

            case 'trade':
                const tradeStream = await tradingApi.executeTrade({
                    inputMint: params.inputMint,
                    outputMint: params.outputMint,
                    amount: params.amount,
                    slippage: params.slippage,
                    wallet: params.wallet
                });

                // Convert Observable to ReadableStream
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
                                    controller.error(error);
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

                return new Response(
                    await tradingApi.processTradingChat(params.messages, params.wallet),
                    {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive'
                        }
                    }
                );

            default:
                return NextResponse.json(
                    { success: false, error: 'Unknown action' },
                    { status: 400 }
                );
        }
    } catch (e: any) {
        console.error('Agent kit error:', e);

        // Special error handling for session-related errors
        if (e.message?.includes('session')) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: e.message,
                    code: 'SESSION_ERROR',
                    session_message: 'Session initialization required'
                },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { success: false, error: e.message },
            { status: e.status ?? 500 }
        );
    }
}

// GET method for health check and version info
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

// Add required server runtime configuration
export const runtime = 'edge';  // Use edge runtime for better performance
export const dynamic = 'force-dynamic';  // Ensure dynamic data fetching