// app/lib/auth/session-verification.ts
import { TradingSessionManager } from '../../lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

export async function verifySession(
  publicKey: string,
  sessionSignature: string
): Promise<boolean> {
  try {
    // Get session from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: session, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('public_key', publicKey)
      .single();

    if (error || !session) {
      console.error('Session fetch error:', error);
      return false;
    }

    // Verify session is not expired
    if (Date.now() > session.expires_at) {
      // Clean up expired session
      await supabase
        .from('trading_sessions')
        .delete()
        .eq('public_key', publicKey);
      return false;
    }

    // Verify signature matches
    const storedSignature = session.signature;
    if (sessionSignature !== storedSignature) {
      return false;
    }

    // If session is close to expiry (within 1 hour), refresh it
    const oneHour = 60 * 60 * 1000;
    if (session.expires_at - Date.now() < oneHour) {
      await supabase
        .from('trading_sessions')
        .update({
          expires_at: Date.now() + (24 * 60 * 60 * 1000),
          updated_at: new Date().toISOString()
        })
        .eq('public_key', publicKey);
    }

    return true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
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