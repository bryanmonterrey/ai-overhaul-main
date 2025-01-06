import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { content, source, themes } = await request.json();
        
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        const { data, error } = await supabase
            .from('tweet_training_data')
            .insert([{
                content,
                source,
                themes: themes || [],
                engagement_score: 0
            }])
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Training data error:', error);
        return NextResponse.json(
            { error: 'Error saving training data' }, 
            { status: 500 }
        );
    }
}

// Handle CSV upload
export async function PUT(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            throw new Error('No file uploaded');
        }

        const csvText = await file.text();
        const rows = csvText.split('\n').map(row => row.split(','));
        
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // Skip header row and process data
        const tweets = rows.slice(1).map(row => ({
            content: row[0]?.trim(),
            source: row[1]?.trim() || 'csv_import',
            themes: row[2] ? row[2].split(';').map(t => t.trim()) : []
        })).filter(t => t.content); // Filter out empty rows

        const { data, error } = await supabase
            .from('tweet_training_data')
            .insert(tweets)
            .select();

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            inserted: data?.length 
        });
    } catch (error) {
        console.error('CSV upload error:', error);
        return NextResponse.json(
            { error: 'Error processing CSV' }, 
            { status: 500 }
        );
    }
}