// services/market/types.ts
import { TokenInfo } from '../../types/agent-kit';

export interface MarketDataResponse {
    success: boolean;
    price?: number;
    volume24h?: number;
    priceChange24h?: number;
    marketCap?: number;
    timestamp: string;
    error?: string;
}

export interface PriceSource {
    name: string;
    priority: number;
    fetchPrice: (tokenMint: string) => Promise<number | null>;
}

export interface MarketDataConfig {
    cacheDuration: number;
    maxRetries: number;
    retryDelay: number;
    sources: PriceSource[];
}
