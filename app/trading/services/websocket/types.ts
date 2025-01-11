// services/websocket/types.ts
export interface WebSocketMessage {
    type: 'trade_status' | 'quote_update' | 'execution_update' | 'session_status';
    data: any;
}

export interface WebSocketTradeStatus {
    tradeId: string;
    status: 'initiated' | 'pending' | 'executed' | 'failed';
    signature?: string;
    error?: string;
}

export interface WebSocketQuoteUpdate {
    inputMint: string;
    outputMint: string;
    price: number;
    priceImpact: number;
}

export interface WebSocketExecutionUpdate {
    tradeId: string;
    signature: string;
    status: 'confirmed' | 'finalized';
    slot: number;
}

export interface WebSocketSessionStatus {
    status: 'active' | 'expired' | 'invalid';
    publicKey: string;
    expiresAt?: number;
}

export interface WebSocketConfig {
    url: string;
    reconnectAttempts: number;
    reconnectDelay: number;
    pingInterval: number;
}
