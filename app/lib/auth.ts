// app/lib/auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Connection, PublicKey } from '@solana/web3.js';
import { cookies } from 'next/headers';

// Add getUser function for admin authentication
export async function getUser() {
    const cookieStore = cookies();
    const supabase = createClientComponentClient();
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return null;
      }
  
      // Get additional user data from your users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
  
      if (userError) {
        console.error('Error fetching user data:', userError);
        return null;
      }

      // Get role data from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Error fetching role data:', roleError);
        return null;
      }
  
      return {
        ...user,
        isAdmin: roleData?.role === 'admin', // Updated to use role from user_roles
        ...userData
      };
  
    } catch (error) {
      console.error('Auth error:', error);
      return null;
    }
}

export async function verifyTokenHolder(walletAddress: string) {
  const supabase = createClientComponentClient();
  
  try {
    // Check if user exists in Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError) throw userError;

    // Verify token balance
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
    const tokenAccount = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(process.env.NEXT_PUBLIC_TOKEN_ADDRESS!) }
    );

    const balance = tokenAccount.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;
    const minRequired = process.env.NEXT_PUBLIC_MIN_TOKEN_REQUIRED || 0;

    return {
      isHolder: balance >= minRequired,
      balance: balance,
      userData: userData
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      isHolder: false,
      balance: 0,
      userData: null
    };
  }
}

// Add trading specific auth check
export async function verifyTradingAccess(walletAddress: string) {
  const { isHolder, balance, userData } = await verifyTokenHolder(walletAddress);
  
  // Add additional trading-specific checks
  const tradingEnabled = balance >= (process.env.NEXT_PUBLIC_MIN_TRADING_TOKENS || 0);
  
  return {
    canTrade: isHolder && tradingEnabled,
    balance,
    userData,
    tradingTier: getTradingTier(balance)
  };
}

function getTradingTier(balance: number): 'basic' | 'premium' | 'vip' {
  if (balance >= 1000) return 'vip';
  if (balance >= 100) return 'premium';
  return 'basic';
}