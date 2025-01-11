// services/session/types.ts
import { PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '../../types/wallet';

export interface TradingSession {
    publicKey: string;
    signature: string;
    timestamp: number;
    expiresAt: number;
    wallet: {
        name: string;
        connected: boolean;
        publicKey: string;
        credentials?: {
            signature?: string;
            sessionSignature?: string;
            publicKey: string;
            signTransaction?: boolean;
            signAllTransactions?: boolean;
            connected?: boolean;
        };
    };
}

export interface SessionResponse {
    success: boolean;
    sessionId?: string;
    sessionSignature?: string;
    timestamp?: string;
    publicKey?: string;
    expiresAt?: string;
    error?: string;
    code?: string;
    session_message?: string;
}

export interface SessionConfig {
    duration: number;        // Session duration in milliseconds
    refreshWindow: number;   // When to refresh before expiry
    maxSessions: number;     // Max concurrent sessions per wallet
    cleanupInterval: number; // How often to run cleanup
}
