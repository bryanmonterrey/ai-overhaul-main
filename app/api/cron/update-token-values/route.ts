import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Interface for token holder data
interface TokenHolder {
  id: string;
  user_id: string;
  wallet_address: string;
  token_balance: number;
  dollar_value: number;
  last_checked_at: string;
}

// Function to get token balance
async function getTokenBalance(
  connection: Connection,
  walletAddress: string,
  tokenAddress: string
): Promise<number> {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenAddress);
    
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    
    return balance.value.uiAmount || 0;
  } catch (error) {
    console.error('Error getting token balance:', error);
    return 0;
  }
}

// Function to get token price (replace with your actual price source)
async function getTokenPrice(): Promise<number> {
    try {
      const response = await fetch('https://price.jup.ag/v4/price?ids=9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump');
      const data = await response.json();
      
      // The price data will be in data.data['9kG8CWxd...'].price
      return data.data['9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump'].price || 0;
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

export async function GET(req: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Invalid or missing authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Solana connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    );

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Get token contract address from admin settings
    const { data: tokenAddressData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'token_contract_address')
      .single();

    const tokenAddress = tokenAddressData?.value || '9kG8CWxdNeZzg8PLHTaFYmH6ihD1JMegRE1y6G8Dpump';

    // Get all token holders
    const { data: holders, error: holdersError } = await supabase
      .from('token_holders')
      .select('*');

    if (holdersError) {
      console.error('Error fetching token holders:', holdersError);
      return NextResponse.json(
        { error: 'Error fetching token holders' },
        { status: 500 }
      );
    }

    if (!holders || holders.length === 0) {
      return NextResponse.json({ message: 'No token holders found' });
    }

    // Get current token price
    const tokenPrice = await getTokenPrice();

    // Update each holder's token value
    const updates = await Promise.all(
      holders.map(async (holder: TokenHolder) => {
        try {
          // Get current token balance
          const balance = await getTokenBalance(
            connection,
            holder.wallet_address,
            tokenAddress
          );

          // Calculate current value
          const value = balance * tokenPrice;

          // Update database
          const { error: updateError } = await supabase
            .from('token_holders')
            .update({
              token_balance: balance,
              dollar_value: value,
              last_checked_at: new Date().toISOString()
            })
            .eq('id', holder.id);

          if (updateError) {
            console.error(
              `Error updating holder ${holder.wallet_address}:`,
              updateError
            );
            return false;
          }

          return true;
        } catch (error) {
          console.error(
            `Error processing holder ${holder.wallet_address}:`,
            error
          );
          return false;
        }
      })
    );

    // Count successful updates
    const successfulUpdates = updates.filter(Boolean).length;

    // Log the update to admin_logs
    await supabase.from('admin_logs').insert({
      action: 'update_token_values',
      details: {
        total_holders: holders.length,
        successful_updates: successfulUpdates,
        token_price: tokenPrice,
        timestamp: new Date().toISOString()
      },
      success: successfulUpdates > 0
    });

    return NextResponse.json({
      success: true,
      totalHolders: holders.length,
      updatedHolders: successfulUpdates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    
    // Log the error to admin_logs
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.from('admin_logs').insert({
      action: 'update_token_values',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      success: false,
      error_details: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}