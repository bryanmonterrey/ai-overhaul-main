// services/TradingApi.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";
import { Observable } from 'rxjs';
import { PublicKey } from '@solana/web3.js';

// Types
export interface TradingConfig {
    wsUrl: string;
    baseUrl: string;
    rpcUrl: string;
    openaiApiKey: string;
    privateKey?: string;
}

export interface WebSocketConfig {
    url: string;
    onMessage: (data: any) => void;
    onError: (error: any) => void;
    reconnectAttempts?: number;
    reconnectDelay?: number;
}

export interface TradingSession {
    sessionId: string;
    publicKey: string;
    signature: string;
    expiresAt: number;
}

export interface TradeParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippage: number;
    wallet?: any;
}

export interface StreamResponse {
    event: string;
    data: any;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    role: MessageRole;
    content: string;
}

// WebSocket Handler
class WebSocketHandler {
    private ws: WebSocket | null = null;
    private readonly config: WebSocketConfig;
    private reconnectAttempts = 0;
    private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();

    constructor(config: WebSocketConfig) {
        this.config = {
            reconnectAttempts: 5,
            reconnectDelay: 1000,
            ...config
        };
    }

    connect(url?: string): void {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        this.ws = new WebSocket(url || this.config.url);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.emit('connection', { status: 'connected' });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.config.onMessage(data);
                this.emit(data.type, data.data);
            } catch (error) {
                console.error('WebSocket message error:', error);
                this.config.onError(error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.config.onError(error);
        };
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < (this.config.reconnectAttempts || 5)) {
            this.reconnectAttempts++;
            const delay = (this.config.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempts - 1);
            setTimeout(() => this.connect(), delay);
        }
    }

    on(event: string, callback: (data: any) => void): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(callback);
        return () => this.eventHandlers.get(event)?.delete(callback);
    }

    emit(event: string, data: any): void {
        this.eventHandlers.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.eventHandlers.clear();
    }

    send(data: any): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

// Main Trading API Class
export class TradingApi {
    private ws: WebSocketHandler;
    private agentKit: SolanaAgentKit;
    private session: TradingSession | null = null;
    private agent: any; // LangChain agent
    private memory: MemorySaver;
    private tools: any[];
    private llm: ChatOpenAI;
    
    private readonly baseUrl: string;
    private readonly wsUrl: string;

    constructor(config: TradingConfig) {
        this.baseUrl = config.baseUrl;
        this.wsUrl = config.wsUrl;

        // Initialize LangChain components
        this.llm = new ChatOpenAI({
            temperature: 0.7,
            model: "gpt-4",
            openAIApiKey: config.openaiApiKey
        });

        // Initialize Solana Agent Kit
        this.agentKit = new SolanaAgentKit(
            config.privateKey || 'readonly',
            config.rpcUrl,
            config.openaiApiKey
        );

        // Create tools and memory
        this.tools = createSolanaTools(this.agentKit);
        this.memory = new MemorySaver();

        // Create React agent
        this.agent = createReactAgent({
            llm: this.llm,
            tools: this.tools,
            checkpointSaver: this.memory,
            messageModifier: `
                You are a helpful agent that can interact onchain using the Solana Agent Kit.
                You are empowered to interact onchain using your tools. If you ever need funds,
                you can request them from the faucet. If not, you can provide your wallet details
                and request funds from the user.
            `
        });

        // Initialize WebSocket handler
        this.ws = new WebSocketHandler({
            url: this.wsUrl,
            onMessage: this.handleWebSocketMessage.bind(this),
            onError: this.handleWebSocketError.bind(this)
        });
    }

    /**
     * Process trading messages through LangChain agent
     */
    async processTradingChat(messages: Message[], wallet?: any): Promise<ReadableStream> {
        try {
            // Initialize session if wallet provided
            if (wallet) {
                await this.initializeSession(wallet);
            }

            // Create event stream
            const eventStream = this.agent.streamEvents(
                { messages },
                {
                    version: "v2",
                    configurable: {
                        thread_id: `Trading-${Date.now()}`,
                    },
                }
            );

            // Transform stream
            const textEncoder = new TextEncoder();
            return new ReadableStream({
                async start(controller) {
                    try {
                        for await (const { event, data } of eventStream) {
                            if (event === "on_chat_model_stream") {
                                if (data.chunk?.content) {
                                    controller.enqueue(textEncoder.encode(data.chunk.content));
                                }
                            }
                        }
                        controller.close();
                    } catch (error) {
                        controller.error(error);
                    }
                }
            });

        } catch (error) {
            console.error('Trading chat error:', error);
            throw error;
        }
    }

    /**
     * Execute trade with streaming updates
     */
    async executeTrade(params: TradeParams): Promise<Observable<StreamResponse>> {
        if (!this.session) {
            throw new Error('Trading session not initialized');
        }

        return new Observable(subscriber => {
            const execute = async () => {
                try {
                    // Verify token
                    const tokenInfo = await this.agentKit.getTokenDataByAddress(params.outputMint);
                    if (!tokenInfo) {
                        throw new Error('Invalid token');
                    }

                    // Execute trade
                    const tradeResult = await this.agentKit.trade(
                        new PublicKey(params.outputMint),
                        params.amount,
                        new PublicKey(params.inputMint),
                        params.slippage * 100
                    );

                    // Emit trade result
                    subscriber.next({
                        event: 'trade_executed',
                        data: {
                            signature: tradeResult,
                            params,
                            timestamp: new Date().toISOString()
                        }
                    });

                    subscriber.complete();

                } catch (error) {
                    subscriber.error(error);
                }
            };

            execute();

            // Cleanup function
            return () => {
                // Cancel any pending operations if needed
            };
        });
    }

    /**
     * Initialize trading session
     */
    private async initializeSession(wallet: any): Promise<void> {
        try {
            const sessionResult = await this.agentKit.initSession({
                wallet: {
                    publicKey: wallet.publicKey.toString(),
                    credentials: wallet.credentials
                }
            });

            if (!sessionResult.success || !sessionResult.sessionId) {
                throw new Error(sessionResult.error || 'Session initialization failed');
            }

            this.session = {
                sessionId: sessionResult.sessionId,
                publicKey: wallet.publicKey.toString(),
                signature: sessionResult.sessionSignature!,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
            };

            // Initialize WebSocket with session
            this.ws.connect(`${this.wsUrl}?sessionId=${this.session.sessionId}`);

        } catch (error) {
            console.error('Session initialization error:', error);
            throw error;
        }
    }

    /**
     * Handle WebSocket messages
     */
    private handleWebSocketMessage(data: any): void {
        switch (data.type) {
            case 'trade_status':
                this.handleTradeStatus(data.data);
                break;
            case 'quote_update':
                this.handleQuoteUpdate(data.data);
                break;
            case 'portfolio_update':
                this.handlePortfolioUpdate(data.data);
                break;
        }
    }

    private handleTradeStatus(data: any): void {
        this.ws.emit('trade_status', data);
    }

    private handleQuoteUpdate(data: any): void {
        this.ws.emit('quote_update', data);
    }

    private handlePortfolioUpdate(data: any): void {
        this.ws.emit('portfolio_update', data);
    }

    /**
     * Handle WebSocket errors
     */
    private handleWebSocketError(error: any): void {
        console.error('WebSocket error:', error);
        // Implement retry logic if needed
    }

    /**
     * Subscribe to trading events
     */
    public on(event: string, callback: (data: any) => void): () => void {
        return this.ws.on(event, callback);
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        this.ws.disconnect();
    }

    /**
     * Get token information
     */
    async getTokenInfo(mint: string): Promise<any> {
        try {
            const tokenData = await this.agentKit.getTokenDataByAddress(mint);
            return {
                success: true,
                data: tokenData
            };
        } catch (error) {
            console.error('Token info error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get token info'
            };
        }
    }

    /**
     * Get token price
     */
    async getTokenPrice(mint: string): Promise<number | null> {
        try {
            const price = await this.agentKit.fetchTokenPrice(mint);
            return price ? Number(price) : null;
        } catch (error) {
            console.error('Price fetch error:', error);
            throw error;
        }
    }

    /**
     * Get trading routes
     */
    async getRoutes(inputMint: string, outputMint: string, amount: number): Promise<any> {
        try {
            // Validate inputs
            if (!inputMint || !outputMint || !amount) {
                throw new Error('Missing required parameters');
            }

            // Get token info for validation
            const inputToken = await this.getTokenInfo(inputMint);
            const outputToken = await this.getTokenInfo(outputMint);

            if (!inputToken.success || !outputToken.success) {
                throw new Error('Invalid tokens');
            }

            // Calculate routes using Jupiter through agent-kit
            const routes = await this.agentKit.trade(
                new PublicKey(outputMint),
                amount,
                new PublicKey(inputMint),
                100 // Default slippage bps
            );

            return {
                success: true,
                routes,
                tokens: {
                    input: inputToken.data,
                    output: outputToken.data
                }
            };

        } catch (error) {
            console.error('Route calculation error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to calculate routes'
            };
        }
    }

    /**
     * Analyze market data
     */
    async analyzeMarket(asset: string): Promise<any> {
        try {
            // Get token info
            const tokenInfo = await this.getTokenInfo(asset);
            if (!tokenInfo.success) {
                throw new Error('Invalid token');
            }

            // Get price and recent trades
            const price = await this.getTokenPrice(asset);
            
            // TODO: Add more market analysis from your backend
            // This should connect with your Python backend's analysis endpoints

            return {
                success: true,
                data: {
                    token: tokenInfo.data,
                    price,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Market analysis error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to analyze market'
            };
        }
    }

    /**
     * Get portfolio data
     */
    async getPortfolio(wallet: string): Promise<any> {
        try {
            // Get wallet balances
            const balances = await this.agentKit.getBalance(new PublicKey(wallet));

            // TODO: Add more portfolio analysis from your backend
            // This should connect with your Python backend's portfolio endpoints

            return {
                success: true,
                data: {
                    balances,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Portfolio fetch error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get portfolio'
            };
        }
    }

    /**
     * Register WebSocket event handlers
     */
    private registerEventHandlers(): void {
        this.ws.on('portfolio_update', (data) => {
            // Handle portfolio updates
            this.emit('portfolio', data);
        });

        this.ws.on('trade_update', (data) => {
            // Handle trade updates
            this.emit('trade', data);
        });

        this.ws.on('quote_update', (data) => {
            // Handle quote updates
            this.emit('quote', data);
        });
    }

    /**
     * Emit events to subscribers
     */
    private emit(event: string, data: any): void {
        this.ws.emit(event, data);
    }

    async initSession(wallet: any): Promise<any> {
        return this.callAgentKit('initSession', { wallet });
    }

    async validateSession(publicKey: string, sessionId: string): Promise<any> {
        return this.callAgentKit('validateSession', { publicKey, sessionId });
    }
}