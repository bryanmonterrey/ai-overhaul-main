// app/lib/auth/session-verification.ts
import { TradingSessionManager } from '../../lib/session-manager';
import { serverSupabase } from '../supabase/server-client';  // Add this import
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';  // Add this import


// Add these interface definitions
interface WalletInfo {
  publicKey: string;
  credentials: {
    publicKey: string;
    signature: string;
    signTransaction?: boolean;
    signAllTransactions?: boolean;
    connected?: boolean;
  };
}

interface VerificationResult {
  success: boolean;
  sessionId?: string;
  expiresAt?: number;
  error?: string;
  code?: string;
}

export async function verifySession(wallet: WalletInfo): Promise<VerificationResult> {
  try {
    const now = Date.now();
    const expires = now + (24 * 60 * 60 * 1000); // 24 hours

    // First check for existing session
    const { data: existingSession } = await serverSupabase
      .from('trading_sessions')
      .select('*')
      .eq('public_key', wallet.publicKey)
      .eq('is_active', true)
      .gt('expires_at', new Date(now).toISOString())
      .single();

    if (existingSession) {
      return {
        success: true,
        sessionId: existingSession.id,
        expiresAt: new Date(existingSession.expires_at).getTime()
      };
    }

    // Generate a new UUID for the session
    const sessionId = uuidv4();

    // Store new session in Supabase
    const { data, error } = await serverSupabase
      .from('trading_sessions')
      .insert({
        id: sessionId,  // Use the UUID we generated
        public_key: wallet.publicKey,
        signature: wallet.credentials.signature,  // Store original signature separately
        expires_at: new Date(expires).toISOString(),
        is_active: true,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
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
      sessionId: sessionId,  // Return our generated UUID
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

// Your existing verifySignatureMessage function can stay the same
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