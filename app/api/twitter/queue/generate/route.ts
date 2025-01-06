// app/api/twitter/queue/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase.types';
import { getTwitterManager } from '../../../../lib/twitter-manager-instance';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { checkTwitterRateLimit } from '../../../../lib/middleware/twitter-rate-limiter';
import { withConfig } from '../../../../lib/middleware/configMiddleware';
import { withAuth } from '../../../../lib/middleware/auth-middleware';

export async function POST(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('generate_tweets');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            await twitterManager.generateTweetBatch();
            const tweets = await twitterManager.getQueuedTweets();
            
            return NextResponse.json({
                success: true,
                tweets
            });
        } catch (error: any) {
            // ... error handling ...
            return NextResponse.json({
                error: error.message || 'An unexpected error occurred',
                code: 'INTERNAL_SERVER_ERROR'
            }, { status: 500 });
            // ... error handling ...
        }
    }))(req);
}