// app/api/letta/memories/query/route.ts

import { NextResponse } from 'next/server';
import { MemoryType } from '@/app/types/memory';

interface QueryRequest {
    type: MemoryType;
    query: string | Record<string, any>;
    context?: Record<string, any>;
}

export async function POST(request: Request) {
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
        return NextResponse.json({ 
          error: 'Content-Type must be application/json' 
        }, { status: 400 });
      }
      
    try {
        const { type, query, context } = await request.json();

        if (!type) {
            return NextResponse.json({ 
                error: 'Memory type is required' 
            }, { status: 400 });
        }

        // Forward to Python service
        const response = await fetch('https://ai-overhaul.onrender.com/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type,
                query,
                context
            })
        });

        try {
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Query failed');
            }
            return NextResponse.json(data);
        } catch (error) {
            console.error('Memory query error:', error);
            return NextResponse.json({ 
                success: false,
                error: error instanceof Error ? error.message : 'Failed to query memories' 
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Request error:', error);
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Invalid request' 
        }, { status: 400 });
    }
}