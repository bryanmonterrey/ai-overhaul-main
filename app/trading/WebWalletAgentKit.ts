// app/lib/WebWalletAgentKit.ts
import { Transaction, PublicKey, Keypair } from "@solana/web3.js";
import { SolanaAgentKit, Config } from "solana-agent-kit";
import bs58 from "bs58";
import { SupabaseClient } from '@supabase/supabase-js';

interface ExtendedConfig extends Config {
  supabase?: SupabaseClient;
  dummyKey?: string;
}

interface WalletAdapter {
  publicKey: PublicKey;
  sessionId?: string;
  sessionSignature?: string;
  originalSignature?: string;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
}

interface SessionValidationResult {
  valid: boolean;
  error?: string;
}

export class WebWalletAgentKit extends SolanaAgentKit {
  private webWallet: WalletAdapter;
  private readonly extendedConfig: ExtendedConfig;

  constructor(
    wallet: WalletAdapter,
    rpcUrl: string,
    config: ExtendedConfig
  ) {
    // Create a fixed-size readonly key
    const readonlyKey = 'readonly'.repeat(4); // 32 characters
    const dummyKey = Buffer.from(readonlyKey);
    const dummyPrivateKeyBase58 = bs58.encode(dummyKey);
    
    // Initialize with proper length dummy key
    super(dummyPrivateKeyBase58, rpcUrl, config);
    
    this.webWallet = wallet;
    this.extendedConfig = config;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    const session = await this.validateSession();
    if (!session.valid) {
      throw new Error(session.error || 'Invalid session');
    }
    return this.webWallet.signTransaction(tx);
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    const session = await this.validateSession();
    if (!session.valid) {
      throw new Error(session.error || 'Invalid session');
    }
    return this.webWallet.signAllTransactions(txs);
  }

  getPayer(): PublicKey {
    return this.webWallet.publicKey;
  }

  private async validateSession(): Promise<SessionValidationResult> {
    try {
      if (!this.webWallet.sessionId || !this.webWallet.sessionSignature) {
        return { 
          valid: false, 
          error: 'No session credentials found' 
        };
      }

      if (this.extendedConfig.supabase) {
        const { data, error } = await this.extendedConfig.supabase
          .from('trading_sessions')
          .select()
          .eq('session_id', this.webWallet.sessionId)
          .eq('signature', this.webWallet.sessionSignature)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (error || !data) {
          return {
            valid: false,
            error: 'Session not found or expired'
          };
        }

        return { valid: true };
      }

      return { valid: true };
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : 'Session validation failed'
      };
    }
  }

  async refreshSession(): Promise<boolean> {
    try {
      if (!this.extendedConfig.supabase) return true;

      const { error } = await this.extendedConfig.supabase
        .from('trading_sessions')
        .update({
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('session_id', this.webWallet.sessionId)
        .eq('signature', this.webWallet.sessionSignature);

      return !error;
    } catch {
      return false;
    }
  }

  async endSession(): Promise<boolean> {
    try {
      if (!this.extendedConfig.supabase) return true;

      const { error } = await this.extendedConfig.supabase
        .from('trading_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('session_id', this.webWallet.sessionId);

      return !error;
    } catch {
      return false;
    }
  }

  async getRoutes(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<any> {
    const session = await this.validateSession();
    if (!session.valid) {
      throw new Error(session.error || 'Invalid session');
    }

    try {
      return await this.trade(
        new PublicKey(outputMint),
        amount,
        new PublicKey(inputMint),
        100 // Default slippage bps
      );
    } catch (e) {
      console.error('Route calculation error:', e);
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to calculate routes'
      };
    }
  }

  getSessionInfo() {
    return {
      sessionId: this.webWallet.sessionId,
      sessionSignature: this.webWallet.sessionSignature,
      publicKey: this.webWallet.publicKey.toString()
    };
  }

  // Override the base class trade method
  async trade(
    outputMint: PublicKey,
    inputAmount: number,
    inputMint?: PublicKey,
    slippageBps: number = 100
  ): Promise<string> {
    const session = await this.validateSession();
    if (!session.valid) {
      throw new Error(session.error || 'Invalid session');
    }

    // Call the base class trade method with our web wallet
    return super.trade(outputMint, inputAmount, inputMint, slippageBps);
  }
}