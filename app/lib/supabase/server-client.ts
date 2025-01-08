import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

export function createServerClient() {
    return createServerComponentClient<Database>({
        cookies
    });
}

// Initialize the server-side supabase client
export const serverSupabase = createServerClient(); 