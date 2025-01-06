// app/api/letta/memories/chain/[key]/route.ts

import { NextResponse } from 'next/server';
import { validate as validateUUID } from 'uuid';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface ChainConfig {
    depth?: number;
    min_similarity?: number;
}

export async function POST(
    request: Request,
    { params }: { params: { key: string } }
) {
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return NextResponse.json({ 
            success: false,
            error: 'Content-Type must be application/json' 
        }, { status: 400 });
    }
      
    try {
        const config: ChainConfig = await request.json();
        const { key } = params;

        if (!validateUUID(key)) {
            return NextResponse.json({ 
                success: false,
                error: 'Invalid memory key format' 
            }, { status: 400 });
        }

        // First verify the memory exists in Supabase
        const supabase = createRouteHandlerClient({ cookies });
        const { data: memoryExists, error: supabaseError } = await supabase
            .from('memories')
            .select('id')
            .eq('id', key)
            .eq('archive_status', 'active')
            .single();

        if (supabaseError || !memoryExists) {
            return NextResponse.json({ 
                success: false,
                error: 'Source memory not found' 
            }, { status: 404 });
        }

        // Validate chain configuration
        const validatedConfig = {
            depth: Math.min(Math.max(1, config.depth || 2), 5), // Limit depth between 1 and 5
            min_similarity: Math.min(Math.max(0.1, config.min_similarity || 0.5), 1.0) // Limit similarity between 0.1 and 1.0
        };

        // Forward the request to the Python service
        const response = await fetch(`https://ai-overhaul.onrender.com/memories/chain/${key}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validatedConfig)
        });

        const responseData = await response.text();
        let parsedData;

        try {
            parsedData = JSON.parse(responseData);
        } catch (e) {
            console.error('Failed to parse Letta service response:', responseData);
            throw new Error('Invalid response from memory service');
        }

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json({ 
                    success: false,
                    data: { chain: [] },
                    error: 'No related memories found'
                }, { status: 200 }); // Return 200 with empty chain instead of 404
            }
            throw new Error(parsedData?.error || 'Failed to create memory chain');
        }

        // If the chain is empty, return a successful response with empty chain
        if (!parsedData.data?.chain || parsedData.data.chain.length === 0) {
            return NextResponse.json({
                success: true,
                data: { chain: [] }
            });
        }

        // Return the chain data
        return NextResponse.json({
            success: true,
            data: parsedData.data
        });

    } catch (error) {
        console.error('Memory chain error:', error);
        
        // Return a more graceful error response
        return NextResponse.json({ 
            success: false,
            data: { chain: [] }, // Always provide a valid data structure
            error: error instanceof Error ? error.message : 'Failed to create memory chain'
        }, { status: 200 }); // Return 200 even for errors, with empty chain
    }
}