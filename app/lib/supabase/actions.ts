// app/lib/supabase/actions.ts
import { supabase, executeSupabaseQuery } from './client';

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