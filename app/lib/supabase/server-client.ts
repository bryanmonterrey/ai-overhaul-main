// app/lib/supabase/server-client.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

// For RSC usage
export function createServerClient() {
    return createServerComponentClient<Database>({
        cookies
    });
}

// For API routes and direct server usage (no cookie dependency)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

export const serverSupabase = createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);