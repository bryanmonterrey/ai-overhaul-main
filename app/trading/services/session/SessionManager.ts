// services/session/SessionManager.ts
import { SupabaseClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { TradingSession, SessionResponse, SessionConfig } from './types';
import { WalletAdapter } from '../../types/wallet';

const DEFAULT_CONFIG: SessionConfig = {
    duration: 30 * 60 * 1000,      // 30 minutes
    refreshWindow: 5 * 60 * 1000,  // 5 minutes
    maxSessions: 5,                // 5 concurrent sessions
    cleanupInterval: 60 * 1000     // 1 minute
};

export class SessionManager {
    private sessions: Map<string, TradingSession>;
    private supabase: SupabaseClient;
    private config: SessionConfig;
    private cleanupInterval: NodeJS.Timer | null = null;

    constructor(supabase: SupabaseClient, config: Partial<SessionConfig> = {}) {
        this.sessions = new Map();
        this.supabase = supabase;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCleanup();
    }

    /**
     * Initialize a new trading session
     */
    async initSession(wallet: WalletAdapter): Promise<SessionResponse> {
        try {
            const publicKey = wallet.publicKey.toString();

            // Check existing sessions
            await this.deactivateExistingSessions(publicKey);

            // Generate session message for signing
            const message = new TextEncoder().encode(
                `Trading session initialization for ${publicKey} at ${new Date().toISOString()}`
            );

            // Get signature
            const signatureBytes = await wallet.signMessage(message);
            const signature = bs58.encode(Buffer.from(signatureBytes));

            // Create session
            const session = await this.createSession(publicKey, signature);
            
            if (!session) {
                throw new Error('Failed to create session');
            }

            return {
                success: true,
                sessionId: session.signature,
                sessionSignature: session.signature,
                timestamp: new Date(session.timestamp).toISOString(),
                publicKey: session.publicKey,
                expiresAt: new Date(session.expiresAt).toISOString()
            };

        } catch (error) {
            console.error('Session initialization error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                code: 'SESSION_INIT_ERROR'
            };
        }
    }

    /**
     * Validate an existing session
     */
    async validateSession(publicKey: string, signature?: string): Promise<boolean> {
        try {
            // Check memory cache first
            const cachedSession = this.sessions.get(publicKey);
            if (cachedSession) {
                if (signature && cachedSession.signature !== signature) {
                    return false;
                }
                if (Date.now() < cachedSession.expiresAt) {
                    return true;
                }
            }

            // Check database
            const { data, error } = await this.supabase
                .from('trading_sessions')
                .select('*')
                .eq('public_key', publicKey)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) return false;

            if (signature && data.signature !== signature) {
                return false;
            }

            // Cache the valid session
            const session: TradingSession = {
                publicKey: data.public_key,
                signature: data.signature,
                timestamp: new Date(data.created_at).getTime(),
                expiresAt: new Date(data.expires_at).getTime(),
                wallet: data.wallet_data
            };

            this.sessions.set(publicKey, session);
            return true;

        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    /**
     * Refresh a session before it expires
     */
    async refreshSession(publicKey: string): Promise<TradingSession | null> {
        try {
            const session = this.sessions.get(publicKey);
            if (!session) {
                const dbSession = await this.getSessionFromDB(publicKey);
                if (!dbSession) return null;
                this.sessions.set(publicKey, dbSession);
                return dbSession;
            }

            if (Date.now() > session.expiresAt) {
                this.sessions.delete(publicKey);
                return null;
            }

            // Only refresh if within refresh window
            if (session.expiresAt - Date.now() > this.config.refreshWindow) {
                return session;
            }

            const refreshedSession = {
                ...session,
                expiresAt: Date.now() + this.config.duration
            };

            await this.supabase
                .from('trading_sessions')
                .update({
                    expires_at: new Date(refreshedSession.expiresAt).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('public_key', publicKey)
                .eq('signature', session.signature);

            this.sessions.set(publicKey, refreshedSession);
            return refreshedSession;

        } catch (error) {
            console.error('Session refresh error:', error);
            return null;
        }
    }

    /**
     * End a specific session
     */
    async endSession(publicKey: string, signature?: string): Promise<boolean> {
        try {
            const query = this.supabase
                .from('trading_sessions')
                .update({
                    is_active: false,
                    ended_at: new Date().toISOString()
                })
                .eq('public_key', publicKey);

            if (signature) {
                query.eq('signature', signature);
            }

            const { error } = await query;

            if (error) throw error;

            this.sessions.delete(publicKey);
            return true;

        } catch (error) {
            console.error('Session end error:', error);
            return false;
        }
    }

    /**
     * Get all active sessions for a wallet
     */
    async getActiveSessions(publicKey: string): Promise<TradingSession[]> {
        try {
            const { data, error } = await this.supabase
                .from('trading_sessions')
                .select('*')
                .eq('public_key', publicKey)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data.map(session => ({
                publicKey: session.public_key,
                signature: session.signature,
                timestamp: new Date(session.created_at).getTime(),
                expiresAt: new Date(session.expires_at).getTime(),
                wallet: session.wallet_data
            }));

        } catch (error) {
            console.error('Get active sessions error:', error);
            return [];
        }
    }

    // Private helper methods
    private async createSession(
        publicKey: string, 
        signature: string
    ): Promise<TradingSession | null> {
        try {
            const now = Date.now();
            const session: TradingSession = {
                publicKey,
                signature,
                timestamp: now,
                expiresAt: now + this.config.duration,
                wallet: {
                    name: 'unknown',
                    connected: true,
                    publicKey,
                    credentials: {
                        publicKey,
                        signature,
                        sessionSignature: signature,
                        signTransaction: true,
                        signAllTransactions: true,
                        connected: true
                    }
                }
            };

            const { error } = await this.supabase
                .from('trading_sessions')
                .insert({
                    public_key: publicKey,
                    signature: signature,
                    created_at: new Date(now).toISOString(),
                    expires_at: new Date(session.expiresAt).toISOString(),
                    wallet_data: session.wallet,
                    is_active: true
                });

            if (error) throw error;

            this.sessions.set(publicKey, session);
            return session;

        } catch (error) {
            console.error('Create session error:', error);
            return null;
        }
    }

    private async deactivateExistingSessions(publicKey: string): Promise<void> {
        try {
            await this.supabase
                .from('trading_sessions')
                .update({
                    is_active: false,
                    ended_at: new Date().toISOString()
                })
                .eq('public_key', publicKey)
                .eq('is_active', true);

            this.sessions.delete(publicKey);
        } catch (error) {
            console.error('Deactivate sessions error:', error);
        }
    }

    private async getSessionFromDB(publicKey: string): Promise<TradingSession | null> {
        try {
            const { data, error } = await this.supabase
                .from('trading_sessions')
                .select('*')
                .eq('public_key', publicKey)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) return null;

            return {
                publicKey: data.public_key,
                signature: data.signature,
                timestamp: new Date(data.created_at).getTime(),
                expiresAt: new Date(data.expires_at).getTime(),
                wallet: data.wallet_data
            };

        } catch (error) {
            console.error('Get session from DB error:', error);
            return null;
        }
    }

    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [publicKey, session] of this.sessions.entries()) {
                if (now > session.expiresAt) {
                    this.sessions.delete(publicKey);
                }
            }
        }, this.config.cleanupInterval);
    }

    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}