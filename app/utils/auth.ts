// app/utils/auth.ts
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/supabase/functions/supabase.types';

export type AuthCookies = {
  'auth-token': string | undefined;
  'refresh-token': string | undefined;
};

export type SessionValidation = {
  isValid: boolean;
  error?: string;
  token?: string;
};

export async function getAuthCookie(): Promise<AuthCookies> {
  const cookieStore = await cookies();
  return {
    'auth-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value,
    'refresh-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token.0')?.value
  };
}

export async function validateSession(): Promise<SessionValidation> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value;
  
  if (!authToken) {
    return {
      isValid: false,
      error: 'No auth token found'
    };
  }

  return {
    isValid: true,
    token: authToken
  };
}

export async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createRouteHandlerClient<Database>({
    cookies: () => Promise.resolve(cookieStore)
  });
}

export async function getSupabaseCookies() {
  const cookieStore = await cookies();
  const supabaseCookies = {
    'sb-access-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value,
    'sb-refresh-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token.0')?.value,
  };

  return supabaseCookies;
}