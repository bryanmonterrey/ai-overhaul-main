import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TokenChecker } from '../lib/blockchain/token-checker';

export async function middleware(req: NextRequest) {
  try {
    // Only apply middleware to chat routes
    if (!req.nextUrl.pathname.startsWith('/chat')) {
      return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    // Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
      // Check if token gating is enabled
      const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('key', 'token_gate_enabled')
        .single();

      if (settingsError) {
        console.error('Error fetching token gate settings:', settingsError);
        // If we can't verify settings, err on the side of caution
        return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
      }

      if (settings?.value) {
        // Get user's wallet address
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData?.wallet_address) {
          console.error('Error fetching user wallet:', userError);
          // Clear the invalid session
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
        }

        // Check token eligibility
        const tokenChecker = new TokenChecker();
        const { isEligible, value } = await tokenChecker.checkEligibility(userData.wallet_address);

        if (!isEligible) {
          console.log('User not eligible:', { 
            wallet: userData.wallet_address, 
            value,
            userId: session.user.id 
          });
          
          // Update token holdings in database
          await supabase
            .from('token_holders')
            .upsert({
              user_id: session.user.id,
              wallet_address: userData.wallet_address,
              dollar_value: value,
              last_checked: new Date().toISOString()
            });

          // Clear session for ineligible users
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL('/insufficient-tokens', req.url));
        }

        // Update token holdings for eligible users
        await supabase
          .from('token_holders')
          .upsert({
            user_id: session.user.id,
            wallet_address: userData.wallet_address,
            dollar_value: value,
            last_checked: new Date().toISOString()
          });
      }

      return res;
    } catch (error) {
      console.error('Token check error:', error);
      // On any error, redirect to login
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login', req.url));
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/chat/:path*']
};