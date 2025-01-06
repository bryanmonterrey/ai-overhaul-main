// app/lib/trading/session-storage.ts

import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';

interface StoredSession {
  publicKey: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
}

class SessionStorage {
  private supabase;
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async storeSession(publicKey: string, signature: string): Promise<StoredSession> {
    const session: StoredSession = {
      publicKey,
      signature,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION
    };

    const { error } = await this.supabase
      .from('trading_sessions')
      .upsert([session]);

    if (error) throw error;
    return session;
  }

  async getSession(publicKey: string): Promise<StoredSession | null> {
    const { data, error } = await this.supabase
      .from('trading_sessions')
      .select('*')
      .eq('publicKey', publicKey)
      .single();

    if (error) return null;
    if (!data || Date.now() > data.expiresAt) {
      await this.clearSession(publicKey);
      return null;
    }

    return data;
  }

  async clearSession(publicKey: string): Promise<void> {
    await this.supabase
      .from('trading_sessions')
      .delete()
      .eq('publicKey', publicKey);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.supabase
      .from('trading_sessions')
      .delete()
      .lt('expiresAt', Date.now());
  }
}

export const sessionStorage = new SessionStorage();