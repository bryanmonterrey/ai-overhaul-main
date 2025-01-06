'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { HolderDashboard } from './components/HolderDashboard';
import { TokenChecker } from '../../lib/blockchain/token-checker';

export default function HolderTradingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Check if token gating is enabled
        const { data: settings } = await supabase
          .from('admin_settings')
          .select('*')
          .eq('key', 'token_gate_enabled')
          .single();

        if (settings?.value) {
          // Get user's wallet address from Supabase
          const { data: userData } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('id', session.user.id)
            .single();

          if (!userData?.wallet_address) {
            router.push('/insufficient-tokens');
            return;
          }

          // Create token checker instance
          const tokenChecker = new TokenChecker();
          
          // Check actual token holdings on-chain
          const { isEligible, value } = await tokenChecker.checkEligibility(userData.wallet_address);

          if (!isEligible) {
            // Update token holdings in database
            await supabase
              .from('token_holders')
              .upsert({
                user_id: session.user.id,
                wallet_address: userData.wallet_address,
                dollar_value: value,
                last_checked: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              });

            router.push('/insufficient-tokens');
            return;
          }

          // Update token holdings for eligible users
          await supabase
            .from('token_holders')
            .upsert({
              user_id: session.user.id,
              wallet_address: userData.wallet_address,
              dollar_value: value,
              last_checked: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });

          setWalletAddress(userData.wallet_address);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/login');
      }
    };

    checkAccess();
  }, [supabase, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!walletAddress) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Holder Trading Dashboard</h1>
      <HolderDashboard userAddress={walletAddress} />
    </div>
  );
}