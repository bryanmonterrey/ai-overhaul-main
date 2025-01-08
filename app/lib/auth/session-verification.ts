// app/lib/auth/session-verification.ts
import { TradingSessionManager } from '../../lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

export async function verifySession(wallet: WalletInfo): Promise<VerificationResult> {
  try {
    // Get current time in milliseconds
    const now = Date.now();
    const expires = now + (24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Store session in Supabase
    const { data, error } = await supabase
      .from('trading_sessions')
      .insert({
        public_key: wallet.publicKey,
        signature: wallet.credentials.signature,
        expires_at: expires,  // Unix timestamp in milliseconds
        timestamp: now,       // Unix timestamp in milliseconds
        created_at: now,      // Unix timestamp in milliseconds
        updated_at: now       // Unix timestamp in milliseconds
      })
      .select()
      .single();

    if (error) {
      console.error('Session verification error:', error);
      return {
        success: false,
        error: error.message,
        code: 'SESSION_VERIFICATION_ERROR'
      };
    }

    return {
      success: true,
      sessionId: data.id,
      expiresAt: expires
    };

  } catch (error) {
    console.error('Session verification error:', error);
    return {
      success: false,
      error: String(error),
      code: 'SESSION_VERIFICATION_ERROR'
    };
  }
}

// Add helper function for signature verification
export function verifySignatureMessage(
  publicKey: string,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  try {
    return nacl.sign.detached.verify(
      message,
      signature,
      new PublicKey(publicKey).toBytes()
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}