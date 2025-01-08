// lib/trading/session-manager.ts

import { createClient } from '@supabase/supabase-js';

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
    private static readonly SESSION_KEY = 'trading_session';
    private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private static supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    static async createSession(sessionData: Omit<TradingSession, 'timestamp' | 'expiresAt'>): Promise<TradingSession> {
        const session: TradingSession = {
            ...sessionData,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.SESSION_DURATION
        };

        // Store in localStorage
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

        // Store in Supabase - match the table structure
        const { data, error } = await this.supabase
            .from('sessions')
            .insert({
                wallet_address: session.publicKey,
                signature: session.signature,
                expires_at: new Date(session.expiresAt),
                is_active: true,
                user_agent: navigator.userAgent,
                tag: 'trading_session'
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error storing session in Supabase:', error);
            throw error;
        }

        return session;
    }

    static async getSession(): Promise<TradingSession | null> {
        try {
            // Check localStorage first
            const localSession = localStorage.getItem(this.SESSION_KEY);
            if (!localSession) return null;

            const session: TradingSession = JSON.parse(localSession);
            
            // Verify with Supabase - match the table structure
            const { data, error } = await this.supabase
                .from('sessions')
                .select()
                .eq('wallet_address', session.publicKey)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString())
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No session found
                    await this.clearSession();
                    return null;
                }
                console.error('Error fetching session from Supabase:', error);
                return null;
            }

            return {
                ...session,
                timestamp: new Date(data.created_at).getTime(),
                expiresAt: new Date(data.expires_at).getTime()
            };
        } catch (error) {
            console.error('Error reading trading session:', error);
            return null;
        }
    }

    static async clearSession(): Promise<void> {
        const session = this.getLocalSession();
        if (session) {
            // Update Supabase
            await this.supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('wallet_address', session.publicKey);
        }
        
        // Clear localStorage
        localStorage.removeItem(this.SESSION_KEY);
    }

    private static getLocalSession(): TradingSession | null {
        try {
            const sessionData = localStorage.getItem(this.SESSION_KEY);
            if (!sessionData) return null;
            return JSON.parse(sessionData);
        } catch {
            return null;
        }
    }
}