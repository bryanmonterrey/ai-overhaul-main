// src/ExtendedSolanaAgentKit.ts
import { SolanaAgentKit } from 'solana-agent-kit';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SessionResponse {
    success: boolean;
    sessionId?: string;
    sessionSignature?: string;
    timestamp?: string;
    expiresAt?: string;
    publicKey?: string;
    error?: string;
    code?: string;
    session_message?: string;
    message?: string;
}

export interface WalletCredentials {
    publicKey: string;
    signature?: string;
    sessionProof?: string;
    sessionSignature?: string;
    credentials?: {
        publicKey: string;
        signature?: string;
        sessionSignature?: string;
        signTransaction?: boolean;
        signAllTransactions?: boolean;
        connected?: boolean;
    };
}

export interface ActiveSession {
    publicKey: string;
    signature: string;
    sessionId: string;
    expiresAt: number;
    keypair?: Keypair;
}

export class ExtendedSolanaAgentKit extends SolanaAgentKit {
    private supabase: SupabaseClient;
    private activeSessions: Map<string, ActiveSession>;
    private readonly sessionDuration = 24 * 60 * 60 * 1000; // 24 hours

    constructor(
        key: string | 'readonly',
        rpcUrl: string,
        openaiApiKey: string | null
    ) {
        super(key, rpcUrl, openaiApiKey);
        
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            throw new Error('Missing Supabase configuration');
        }

        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        this.activeSessions = new Map();

        // Start session cleanup interval
        setInterval(() => this.cleanupSessions(), 5 * 60 * 1000); // Every 5 minutes
    }

    async initSession(wallet: WalletCredentials): Promise<SessionResponse> {
        try {
            const publicKey = wallet.publicKey || wallet.credentials?.publicKey;
            const signature = wallet.signature || 
                            wallet.sessionProof || 
                            wallet.credentials?.signature ||
                            wallet.credentials?.sessionSignature;

            if (!publicKey) {
                return {
                    success: false,
                    error: 'missing_public_key',
                    code: 'MISSING_CREDENTIALS',
                    message: 'Public key is required'
                };
            }

            if (!signature) {
                const session_message = `Trading session initialization for ${publicKey} at ${new Date().toISOString()}`;
                return {
                    success: false,
                    error: 'session_signature_required',
                    session_message,
                    code: 'SIGNATURE_REQUIRED'
                };
            }

            // Check existing session
            const existingSession = await this.getActiveSession(publicKey);
            if (existingSession) {
                return {
                    success: true,
                    sessionId: existingSession.sessionId,
                    sessionSignature: existingSession.signature,
                    publicKey,
                    expiresAt: new Date(existingSession.expiresAt).toISOString()
                };
            }

            // Create new session
            const sessionId = bs58.encode(Buffer.from(`${publicKey}-${Date.now()}`));
            const expiresAt = Date.now() + this.sessionDuration;

            const session: ActiveSession = {
                publicKey,
                signature,
                sessionId,
                expiresAt
            };

            await this.supabase
                .from('trading_sessions')
                .insert({
                    id: sessionId,
                    public_key: publicKey,
                    signature: signature,
                    expires_at: new Date(expiresAt).toISOString(),
                    is_active: true,
                    wallet_data: wallet
                });

            this.activeSessions.set(publicKey, session);

            return {
                success: true,
                sessionId,
                sessionSignature: signature,
                publicKey,
                timestamp: new Date().toISOString(),
                expiresAt: new Date(expiresAt).toISOString()
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

    async validateSession(publicKey: string, sessionId?: string): Promise<boolean> {
        try {
            const cachedSession = this.activeSessions.get(publicKey);
            if (cachedSession) {
                if (sessionId && cachedSession.sessionId !== sessionId) {
                    return false;
                }
                if (Date.now() < cachedSession.expiresAt) {
                    return true;
                }
                this.activeSessions.delete(publicKey);
            }

            const { data } = await this.supabase
                .from('trading_sessions')
                .select('*')
                .eq('public_key', publicKey)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (data) {
                this.activeSessions.set(publicKey, {
                    publicKey: data.public_key,
                    signature: data.signature,
                    sessionId: data.id,
                    expiresAt: new Date(data.expires_at).getTime()
                });
                return true;
            }

            return false;

        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    // Keep original trade method
    async trade(
        outputMint: PublicKey,
        inputAmount: number,
        inputMint?: PublicKey,
        slippageBps?: number
    ): Promise<string> {
        return super.trade(outputMint, inputAmount, inputMint, slippageBps);
    }

    // Add new session-aware trade method
    async executeTrade(
        params: {
            outputMint: PublicKey;
            amount: number;
            inputMint: PublicKey;
            slippageBps: number;
            publicKey: string;
            sessionId?: string;
        }
    ): Promise<string> {
        const { outputMint, amount, inputMint, slippageBps, publicKey, sessionId } = params;

        if (!(await this.validateSession(publicKey, sessionId))) {
            throw new Error('Invalid or expired session');
        }

        return this.trade(outputMint, amount, inputMint, slippageBps);
    }

    private async getActiveSession(publicKey: string): Promise<ActiveSession | null> {
        const cachedSession = this.activeSessions.get(publicKey);
        if (cachedSession && Date.now() < cachedSession.expiresAt) {
            return cachedSession;
        }

        const { data } = await this.supabase
            .from('trading_sessions')
            .select('*')
            .eq('public_key', publicKey)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!data) return null;

        const session: ActiveSession = {
            publicKey: data.public_key,
            signature: data.signature,
            sessionId: data.id,
            expiresAt: new Date(data.expires_at).getTime()
        };

        this.activeSessions.set(publicKey, session);
        return session;
    }

    private cleanupSessions(): void {
        const now = Date.now();
        for (const [publicKey, session] of this.activeSessions) {
            if (now >= session.expiresAt) {
                this.activeSessions.delete(publicKey);
            }
        }
    }

    public async endSession(publicKey: string): Promise<boolean> {
        try {
            const { error } = await this.supabase
                .from('trading_sessions')
                .update({
                    is_active: false,
                    ended_at: new Date().toISOString()
                })
                .eq('public_key', publicKey);

            if (error) throw error;
            this.activeSessions.delete(publicKey);
            return true;
        } catch (error) {
            console.error('Error ending session:', error);
            return false;
        }
    }

    public cleanup(): void {
        this.activeSessions.clear();
    }
}