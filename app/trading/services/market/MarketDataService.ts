// services/market/MarketDataService.ts
import { ExtendedSolanaAgentKit } from '../extended';
import { WebSocketHandler } from '../websocket/WebSocketHandler';
import { MarketDataResponse, PriceSource, MarketDataConfig } from './types';

export class MarketDataService {
    private agentKit: ExtendedSolanaAgentKit;
    private wsHandler: WebSocketHandler;
    private config: MarketDataConfig;
    private priceCache: Map<string, { price: number; timestamp: number }>;

    constructor(
        agentKit: ExtendedSolanaAgentKit,
        wsHandler: WebSocketHandler,
        config: Partial<MarketDataConfig> = {}
    ) {
        this.agentKit = agentKit;
        this.wsHandler = wsHandler;
        this.priceCache = new Map();

        // Initialize with default sources
        this.config = {
            cacheDuration: 30 * 1000, // 30 seconds
            maxRetries: 3,
            retryDelay: 1000,
            sources: [
                {
                    name: 'Jupiter',
                    priority: 1,
                    fetchPrice: this.fetchJupiterPrice.bind(this)
                },
                {
                    name: 'Pyth',
                    priority: 2,
                    fetchPrice: this.fetchPythPrice.bind(this)
                },
                {
                    name: 'DexScreener',
                    priority: 3,
                    fetchPrice: this.fetchDexScreenerPrice.bind(this)
                }
            ],
            ...config
        };
    }

    public async getMarketData(tokenMint: string): Promise<MarketDataResponse> {
        try {
            // Check cache first
            const cached = this.priceCache.get(tokenMint);
            if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
                return {
                    success: true,
                    price: cached.price,
                    timestamp: new Date(cached.timestamp).toISOString()
                };
            }

            // Try each source in order of priority
            for (const source of this.config.sources) {
                try {
                    const price = await this.retryOperation(
                        () => source.fetchPrice(tokenMint)
                    );
                    
                    if (price !== null) {
                        // Update cache
                        this.priceCache.set(tokenMint, {
                            price,
                            timestamp: Date.now()
                        });

                        // Notify via WebSocket
                        this.wsHandler.send({
                            type: 'quote_update',
                            data: {
                                inputMint: tokenMint,
                                price,
                                source: source.name
                            }
                        });

                        return {
                            success: true,
                            price,
                            timestamp: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    console.warn(`${source.name} price fetch failed:`, error);
                    continue;
                }
            }

            throw new Error('All price sources failed');

        } catch (error) {
            console.error('Market data error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            };
        }
    }

    private async retryOperation<T>(
        operation: () => Promise<T>,
        retries: number = this.config.maxRetries
    ): Promise<T> {
        let lastError: Error | null = null;
        
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (i < retries - 1) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.config.retryDelay * Math.pow(2, i))
                    );
                }
            }
        }

        throw lastError || new Error('Operation failed');
    }

    private async fetchJupiterPrice(tokenMint: string): Promise<number | null> {
        try {
            const data = await this.agentKit.fetchTokenPrice(tokenMint);
            return data ? Number(data) : null;
        } catch (error) {
            console.error('Jupiter price fetch error:', error);
            return null;
        }
    }

    private async fetchPythPrice(tokenMint: string): Promise<number | null> {
        try {
            const pythId = await this.getPythPriceAccountId(tokenMint);
            if (!pythId) return null;

            const price = await this.agentKit.pythFetchPrice(pythId);
            return price ? Number(price) : null;
        } catch (error) {
            console.error('Pyth price fetch error:', error);
            return null;
        }
    }

    private async fetchDexScreenerPrice(tokenMint: string): Promise<number | null> {
        try {
            const response = await fetch(
                `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch from DexScreener');
            }

            const data = await response.json();
            return data.pairs?.[0]?.priceUsd || null;
        } catch (error) {
            console.error('DexScreener price fetch error:', error);
            return null;
        }
    }

    private async getPythPriceAccountId(tokenMint: string): Promise<string | null> {
        // Implement mapping logic from token mint to Pyth price account
        // This could be from a static mapping or an API
        return null;
    }

    public clearCache(): void {
        this.priceCache.clear();
    }
}