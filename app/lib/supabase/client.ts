// app/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase.types';

export function createClient() {
    return createClientComponentClient<Database>({
        cookieOptions: {
            name: 'sb-auth-token',
            domain: 'terminal.goatse.app',
            path: '/',
            secure: true,
            sameSite: 'strict'  // Changed from 'lax' to 'strict' for Safari
        }
    });
}