// services/trading/types.ts
import { PublicKey } from '@solana/web3.js';
import { RouteInfo } from '@jup-ag/core';
import { TokenInfo } from '../../types/agent-kit';

export interface TradeParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippage: number;
    wallet?: any;
    sessionId?: string;
}

export interface TradeExecutionResponse {
    success: boolean;
    signature?: string;
    error?: string;
    inputAmount?: number;
    outputAmount?: number;
    price?: number;
    timestamp: string;
}

export interface RouteQuoteResponse {
    success: boolean;
    price: number;
    priceImpact: number;
    route?: RouteInfo;
    minOutputAmount: number;
    tokenData: {
        input: TokenInfo;
        output: TokenInfo;
    };
    timestamp: string;
}

export interface TradeConfig {
    blockEngineUrl: string;
    maxRetries: number;
    retryDelay: number;
    maxSlippage: number;
}
