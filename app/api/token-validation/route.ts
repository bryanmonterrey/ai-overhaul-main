// app/api/token-validation/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { tokenChecker } from '../../lib/blockchain/token-checker';
import { Database } from '@/supabase/functions/supabase.types';
import { tokenValidationRateLimiter } from '../../lib/middleware/rate-limiter';

// Add interface for eligibility check result
interface EligibilityCheckResult {
  isEligible: boolean;
  balance: number;
  price: number;
  value: number;
}

export async function POST(req: Request) {
  try {
    // Rate limiting check
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1"
    const { success, limit, reset, remaining } = await tokenValidationRateLimiter.limit(ip)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString()
          }
        }
      );
    }

    // Parse request body
    const { walletAddress } = await req.json();
    console.log('1. Request received for wallet:', walletAddress);
    
    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length !== 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with proper cookie handling
    const supabase = createRouteHandlerClient<Database>({ cookies });
    console.log('2. Supabase client created');

    // Verify session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('3. Session check result:', { 
      hasSession: !!sessionData?.session, 
      sessionError: sessionError?.message,
      userId: sessionData?.session?.user?.id
    });
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json({ 
        error: 'Session error', 
        details: sessionError.message 
      }, { status: 401 });
    }

    const session = sessionData?.session;
    if (!session) {
      console.log('No active session found');
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    try {
      console.log('4. Starting eligibility check');
      const eligibilityCheck = await Promise.race([
        tokenChecker.checkEligibility(walletAddress),
        new Promise<EligibilityCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Eligibility check timeout')), 10000)
        )
      ]) as EligibilityCheckResult;

      console.log('5. Eligibility check results:', eligibilityCheck);

      // Update token holdings with error handling
      const { error: upsertError } = await supabase
        .from('token_holders')
        .upsert({
          user_id: session.user.id,
          wallet_address: walletAddress,
          token_balance: eligibilityCheck.balance,
          dollar_value: eligibilityCheck.value,
          last_checked_at: new Date().toISOString()
        });

      if (upsertError) {
        console.error('6. Error updating token_holders:', upsertError);
      } else {
        console.log('6. Token holdings updated successfully');
      }

      // Get admin settings for eligibility
      const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('*');

      console.log('7. Admin settings fetched:', { settings, error: settingsError });

      if (settingsError) {
        console.error('Error fetching admin settings:', settingsError);
      }

      const requiredValue = settings?.find(s => s.key === 'required_token_value')?.value || 0;
      const isEligible = eligibilityCheck.value >= requiredValue;

      console.log('8. Final eligibility check:', {
        value: eligibilityCheck.value,
        requiredValue,
        isEligible
      });

      // Return success response with all relevant data
      return NextResponse.json({
        success: true,
        isEligible,
        balance: eligibilityCheck.balance,
        value: eligibilityCheck.value,
        price: eligibilityCheck.price,
        requiredValue,
        walletAddress,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message === 'Eligibility check timeout') {
        console.error('Token eligibility check timed out');
        return NextResponse.json(
          { error: 'Eligibility check timed out' },
          { status: 408 }
        );
      }
      
      // Log and rethrow other errors
      console.error('Token check error:', error);
      throw error;
    }
  } catch (error: any) {
    console.error('Error in token validation:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}