import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { withAuth } from '../../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../../lib/twitter-manager-instance';
import { SupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
    req: NextRequest,
    context: { params: { id: string } }
) {
    return withConfig(withAuth(async (supabase: SupabaseClient<Database>, session: any) => {
        try {
            await checkTwitterRateLimit('queue_update');
            
            const { id } = context.params;
            if (!id) {
                return NextResponse.json({ 
                    error: 'Missing tweet ID',
                    code: 'MISSING_TWEET_ID'
                }, { status: 400 });
            }

            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            await twitterManager.updateTweetStatus(id, body.status);
            const updatedTweets = await twitterManager.getQueuedTweets();
            
            return NextResponse.json({
                success: true,
                tweets: updatedTweets
            });
        } catch (error: any) {
            console.error('Error updating tweet status:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'QUEUE_UPDATE_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}