// src/app/lib/supabase.ts

import { createClient, SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChannelEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Generic helper function for handling Supabase responses
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

export async function getSystemState() {
  return executeSupabaseQuery(
    supabase
      .from('personality_states')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()
      .then(response => response)
  );
}

export async function updateSystemState(state: any) {
  return executeSupabaseQuery(
    supabase
      .from('personality_states')
      .insert([{ state }])
      .select()
      .single()
      .then(response => response)
  );
}

export async function logAdminAction(userId: string, action: string, details?: any) {
  const { error } = await supabase
    .from('admin_logs')
    .insert([{
      user_id: userId,
      action,
      details,
      timestamp: new Date().toISOString()
    }]);

  if (error) {
    console.error('Failed to log admin action:', error);
    throw error;
  }
}

export async function getActiveConnections() {
  const { count, error } = await supabase
    .from('active_sessions')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Failed to get active connections:', error);
    throw error;
  }
  
  return count ?? 0;
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

  return executeSupabaseQuery(
    dbQuery.then(response => response)
  );
}

// Add helper for transaction-like operations
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

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          wallet_address: string;
          signature: string;
          created_at: string;
          expires_at: string;
          user_agent: string;
          is_active: boolean;
        };
        Insert: {
          wallet_address: string;
          signature: string;
          expires_at: string;
          user_agent?: string;
          is_active?: boolean;
        };
      };
      personality_states: {
        Row: {
          id: number;
          state: any;
          timestamp: string;
        };
        Insert: {
          state: any;
          timestamp?: string;
        };
      };
      admin_logs: {
        Row: {
          id: number;
          user_id: string;
          action: string;
          details?: any;
          timestamp: string;
        };
        Insert: {
          user_id: string;
          action: string;
          details?: any;
          timestamp?: string;
        };
      };
      active_sessions: {
        Row: {
          id: number;
          user_id: string;
          started_at: string;
          last_activity: string;
        };
        Insert: {
          user_id: string;
          started_at?: string;
          last_activity?: string;
        };
      };
      trading_memory: {
        Row: {
          id: string;
          key: string;
          type: string;
          content: string;
          metadata: any;
          importance: number;
          emotional_context: string;
          created_at: string;
          complexity: number;
          platform: string;
          archive_status: string;
        };
        Insert: {
          key?: string;
          type: string;
          content: string;
          metadata?: any;
          importance?: number;
          emotional_context?: string;
          created_at?: string;
          complexity?: number;
          platform?: string;
          archive_status?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];

// Utility type helpers
export type TableNames = keyof Database['public']['Tables'];
export type TableRow<T extends TableNames> = Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends TableNames> = Database['public']['Tables'][T]['Insert'];