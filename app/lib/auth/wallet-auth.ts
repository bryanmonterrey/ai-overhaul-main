import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '../supabase/client';

export class WalletAuthManager {
  private supabase;
  private retryDelay = 100000;
  private maxRetries = 3;

  constructor() {
    this.supabase = createClient();
  }

  async authenticateWallet(publicKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to sign in first
      const signInResult = await this.signIn(publicKey);
      if (signInResult.success) {
        return { success: true };
      }

      // If sign in fails, try to sign up with retries
      return await this.signUpWithRetries(publicKey);
    } catch (error: any) {
      console.error('Wallet authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  private async signIn(publicKey: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: `${publicKey}@solana.wallet`,
        password: publicKey
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async signUpWithRetries(publicKey: string, retries = this.maxRetries): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: `${publicKey}@solana.wallet`,
        password: publicKey
      });

      if (error) {
        if (error.message === 'User already registered') {
          return await this.signIn(publicKey);
        }

        if (error.message.includes('rate limit') && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.signUpWithRetries(publicKey, retries - 1);
        }

        throw error;
      }

      return { success: true };
    } catch (error: any) {
      if (retries > 0 && error.message.includes('rate limit')) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.signUpWithRetries(publicKey, retries - 1);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}