// app/api/letta/store/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MemoryType } from '@/app/types/memory';

export async function POST(request: Request) {
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return NextResponse.json({ 
            error: 'Content-Type must be application/json' 
        }, { status: 400 });
    }
  
    try {
        const { key, memory_type, data, metadata } = await request.json();
        const supabase = createRouteHandlerClient({ cookies });
    
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('User not authenticated');

        // Prepare the content
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        const timestamp = new Date().toISOString();

        // Store in Supabase first
        const { data: memoryData, error } = await supabase
            .from('memories')
            .upsert({
                id: key, // Use the provided key as the ID
                type: memory_type,
                content,
                metadata: {
                    ...metadata,
                    user_id: user.id,
                },
                user_id: user.id,
                platform: metadata?.platform || 'default',
                archive_status: 'active',
                created_at: timestamp,
                updated_at: timestamp
            })
            .select()
            .single();

        if (error) throw error;

        // Then store in Letta service
        const lettaResponse = await fetch('https://ai-overhaul.onrender.com/store', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key,
                memory_type,
                data,
                metadata: {
                    ...metadata,
                    user_id: user.id,
                }
            })
        });

        if (!lettaResponse.ok) {
            throw new Error(`Letta service error: ${await lettaResponse.text()}`);
        }

        const lettaData = await lettaResponse.json();

        return NextResponse.json({
            success: true,
            data: {
                ...memoryData,
                letta: lettaData.data
            }
        });

    } catch (error) {
        console.error('Error storing memory:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}