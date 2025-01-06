// src/app/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';

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

// Helper functions for common operations
export async function getSystemState() {
  const { data, error } = await supabase
    .from('personality_states')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSystemState(state: any) {
  const { data, error } = await supabase
    .from('personality_states')
    .insert([{ state }])
    .select()
    .single();

  if (error) throw error;
  return data;
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

  if (error) throw error;
}

export async function getActiveConnections() {
  const { count, error } = await supabase
    .from('active_sessions')
    .select('*', { count: 'exact' });

  if (error) throw error;
  return count || 0;
}