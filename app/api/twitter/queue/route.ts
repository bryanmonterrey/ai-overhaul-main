import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('queue');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const tweets = await twitterManager.getQueuedTweets();
            
            return NextResponse.json({ tweets });
        } catch (error: any) {
            console.error('Error fetching queued tweets:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'QUEUE_FETCH_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    }))(req);
}

export async function POST(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('post_tweet');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            const count = body.count || 10;

            await twitterManager.generateTweetBatch(count);
            const tweets = await twitterManager.getQueuedTweets();

            return NextResponse.json({
                success: true,
                tweets
            });
        } catch (error: any) {
            console.error('Error generating tweets:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TWEET_GENERATION_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    }))(req);
}