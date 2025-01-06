// New file: app/lib/supabase/singleton.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

let supabaseClient: ReturnType<typeof createRouteHandlerClient<Database>> | null = null;

export function getSupabaseClient() {
    if (!supabaseClient) {
        const cookieStore = cookies();
        supabaseClient = createRouteHandlerClient<Database>({ 
            cookies: () => cookieStore 
        });
    }
    return supabaseClient;
}