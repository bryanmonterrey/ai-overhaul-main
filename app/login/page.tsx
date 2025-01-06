'use client';

import { WalletConnection } from '../components/WalletConnection';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenChecker } from '../lib/blockchain/token-checker';

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { connected, publicKey } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Verify tokens even for existing sessions
          const tokenChecker = new TokenChecker();
          const { isEligible } = await tokenChecker.checkEligibility(session.user.user_metadata.wallet_address);
          
          if (isEligible) {
            console.log('Session valid and tokens verified, redirecting to chat');
            router.push('/chat');
          } else {
            console.log('Insufficient tokens, logging out');
            await supabase.auth.signOut();
            setError('Insufficient GOATSE tokens');
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };
    checkSession();
  }, [supabase, router]);

  // Handle wallet authentication
  useEffect(() => {
    const handleWalletLogin = async () => {
      if (!connected || !publicKey || isAuthenticating) return;

      try {
        setIsAuthenticating(true);
        setError(null);
        console.log('Starting wallet authentication for:', publicKey.toString());

        // Check token eligibility first
        const tokenChecker = new TokenChecker();
        const { isEligible, value } = await tokenChecker.checkEligibility(publicKey.toString());

        if (!isEligible) {
          setError('Insufficient GOATSE tokens');
          return;
        }

        // Proceed with auth only if tokens are sufficient
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: `${publicKey.toString()}@wallet.local`,
          password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret',
          options: {
            data: {
              wallet_address: publicKey.toString(),
              token_value: value
            }
          }
        });

        if (signUpError) {
          console.log('Sign up attempt result:', signUpError.message);
          
          if (signUpError.message.includes('User already registered')) {
            console.log('User exists, attempting sign in');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: `${publicKey.toString()}@wallet.local`,
              password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret'
            });

            if (signInError) {
              console.error('Sign in error:', signInError);
              setError('Authentication failed');
              return;
            }

            if (signInData.session) {
              console.log('Successfully signed in');
              router.push('/chat');
            }
          } else {
            console.error('Unexpected error during signup:', signUpError);
            setError('Authentication failed');
          }
        } else if (signUpData.session) {
          console.log('Successfully signed up and authenticated');
          router.push('/chat');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setError('Authentication failed');
      } finally {
        setIsAuthenticating(false);
      }
    };

    handleWalletLogin();
  }, [connected, publicKey, supabase, router, isAuthenticating]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center font-ia justify-center bg-[#11111A]">
      <div className="max-w-md w-full space-y-8 p-8 bg-[#0D0E15] border border-zinc-900 rounded-3xl shadow-none">
        <div>
          <h2 className="text-center text-xl font-ia text-[#DDDDDD]">
            connect your wallet
          </h2>
          <p className="mt-2 text-center font-ia text-sm text-[#DDDDDD]">
            to access the chat, you need to verify your $goatse singularity tokens
          </p>
          {error && (
            <p className="mt-2 text-center font-ia text-sm text-red-500">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8">
          <WalletConnection />
        </div>

        {isAuthenticating && (
          <p className="text-center text-sm text-[#DDDDDD]">
            authenticating...
          </p>
        )}
      </div>
    </div>
  );
}