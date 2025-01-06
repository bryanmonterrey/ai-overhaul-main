// app/api/letta/memories/[key]/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { MemoryType } from '@/app/types/memory';
import { validate as validateUUID } from 'uuid';

export async function GET(
    request: Request,
    { params }: { params: { key: string } }
) {
    try {
        const { key } = params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as MemoryType;

        if (!validateUUID(key)) {
            return NextResponse.json({ 
                success: false,
                error: 'Invalid memory key format' 
            }, { status: 400 });
        }

        // Get the memory from Supabase first
        const supabase = createRouteHandlerClient({ cookies });
        const { data: memoryData, error: supabaseError } = await supabase
            .from('memories')
            .select('*')
            .eq(type ? 'type' : 'id', type || key) // Search by type if provided, otherwise by id
            .eq('archive_status', 'active')
            .single();

        if (supabaseError || !memoryData) {
            console.warn('Memory not found in Supabase:', supabaseError || 'No data');
            // Try the Letta service as fallback
            const lettaResponse = await fetch(
                `https://ai-overhaul.onrender.com/memories/${key}${type ? `?type=${type}` : ''}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!lettaResponse.ok) {
                return NextResponse.json({ 
                    success: false,
                    error: 'Memory not found' 
                }, { status: 404 });
            }

            const lettaData = await lettaResponse.json();
            return NextResponse.json(lettaData);
        }

        // Parse any JSON content if it's stored as a string
        let parsedContent = memoryData.content;
        if (typeof memoryData.content === 'string' && memoryData.content.startsWith('{')) {
            try {
                parsedContent = JSON.parse(memoryData.content);
            } catch (e) {
                console.warn('Failed to parse memory content:', e);
            }
        }

        // Return formatted response
        return NextResponse.json({
            success: true,
            data: {
                ...memoryData,
                content: parsedContent
            }
        });

    } catch (error) {
        console.error('Memory retrieval error:', error);
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve memory' 
        }, { status: 500 });
    }
}