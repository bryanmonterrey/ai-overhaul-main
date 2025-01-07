import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';

// Add environment checks
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function createClient() {
    return createClientComponentClient<Database>({
        cookieOptions: {
            name: 'sb-auth-token',
            domain: 'terminal.goatse.app',
            path: '/',
            secure: true,
            sameSite: 'strict'
        }
    });
}

// Initialize the supabase client
export const supabase = createClient();

// Helper function for handling Supabase responses
export async function executeSupabaseQuery<T>(
    query: Promise<{ data: T | null; error: any }> | { then: (onfulfilled: (value: { data: T | null; error: any }) => any) => any }
): Promise<T> {
    const { data, error } = await query;
    if (error) {
        console.error('Supabase operation failed:', error);
        throw error;
    }
    if (!data) {
        throw new Error('No data returned from query');
    }
    return data;
}

// Database operation helpers
export async function fetchData<T>(
    table: string,
    query?: {
        select?: string;
        filter?: Record<string, any>;
        order?: [string, { ascending: boolean }];
        limit?: number;
    }
) {
    let dbQuery = supabase.from(table).select(query?.select || '*');

    if (query?.filter) {
        Object.entries(query.filter).forEach(([key, value]) => {
            dbQuery = dbQuery.eq(key, value);
        });
    }

    if (query?.order) {
        dbQuery = dbQuery.order(query.order[0], { ascending: query.order[1].ascending });
    }

    if (query?.limit) {
        dbQuery = dbQuery.limit(query.limit);
    }

    return executeSupabaseQuery(dbQuery.then(response => response));
}

export async function upsertData<T>(
    table: string,
    data: T,
    options?: { onConflict?: string }
) {
    return executeSupabaseQuery(
        supabase
            .from(table)
            .upsert(data, { onConflict: options?.onConflict })
            .select()
            .then(response => response)
    );
}

// Batch operations helper
export async function batchOperation<T>(
    operations: (() => Promise<T>)[]
): Promise<T[]> {
    try {
        return await Promise.all(operations.map(op => op()));
    } catch (error) {
        console.error('Batch operation failed:', error);
        throw error;
    }
}

// Real-time subscription helper
export function subscribeToChanges<T extends keyof Database['public']['Tables']>(
    table: T,
    callback: (payload: RealtimePostgresChangesPayload<Database['public']['Tables'][T]>) => void,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'
): RealtimeChannel {
    return (supabase
        .channel(`table_db_changes_${table}`)
        .on(
            'postgres_changes' as any,
            {
                event: event,
                schema: 'public',
                table: table
            },
            callback
        ) as RealtimeChannel)
        .subscribe();
}

// Export types
export type { Database } from '@/types/supabase.types';