// lib/trading/session-manager.ts

import { createClient } from '@supabase/supabase-js';
import { serverSupabase } from './supabase/server-client';

interface TradingSession {
    publicKey: string;
    signature: string;
    timestamp: number;
    expiresAt: number;
    wallet: {
        name: string;
        connected: boolean;
    };
}

export class TradingSessionManager {
    private static readonly SESSION_DURATION = 60 * 60 * 1000; // 1 hour
    private static readonly REFRESH_WINDOW = 5 * 60 * 1000; // 5 minutes

    static async createSession(sessionData: Omit<TradingSession, 'timestamp' | 'expiresAt'>): Promise<TradingSession> {
        const now = Date.now();
        const session: TradingSession = {
            ...sessionData,
            timestamp: now,
            expiresAt: now + this.SESSION_DURATION
        };

        const { error } = await serverSupabase
            .from('trading_sessions')
            .upsert({
                public_key: session.publicKey,
                signature: session.signature,
                created_at: new Date(session.timestamp).toISOString(),
                expires_at: new Date(session.expiresAt).toISOString(),
                wallet_data: session.wallet,
                is_active: true
            });

        if (error) throw error;
        return session;
    }

    static async getSession(publicKey: string): Promise<TradingSession | null> {
        const { data, error } = await serverSupabase
            .from('trading_sessions')
            .select('*')
            .eq('public_key', publicKey)
            .eq('is_active', true)
            .single();

        if (error || !data) return null;

        const now = Date.now();
        const expiresAt = new Date(data.expires_at).getTime();

        // Auto-refresh session if within refresh window
        if (now > expiresAt - this.REFRESH_WINDOW) {
            const refreshedSession = {
                public_key: data.public_key,
                signature: data.signature,
                expires_at: new Date(now + this.SESSION_DURATION).toISOString(),
                wallet_data: data.wallet_data,
                is_active: true
            };

            await serverSupabase
                .from('trading_sessions')
                .upsert(refreshedSession);

            return {
                publicKey: data.public_key,
                signature: data.signature,
                timestamp: new Date(data.created_at).getTime(),
                expiresAt: now + this.SESSION_DURATION,
                wallet: data.wallet_data
            };
        }

        return {
            publicKey: data.public_key,
            signature: data.signature,
            timestamp: new Date(data.created_at).getTime(),
            expiresAt: expiresAt,
            wallet: data.wallet_data
        };
    }
}