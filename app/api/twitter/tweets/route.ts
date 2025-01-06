import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('tweets');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            try {
                const status = await twitterManager.getStatus();
                const recentTweets = await twitterManager.getRecentTweets();

                const tweets = Array.isArray(recentTweets) ? recentTweets : 
                             recentTweets instanceof Map ? Array.from(recentTweets.values()) : 
                             [];
                
                return NextResponse.json({ 
                    tweets: tweets.map(tweet => ({
                        id: tweet.id,
                        content: tweet.text || tweet.content || '',
                        timestamp: tweet.created_at || new Date().toISOString(),
                        metrics: {
                            likes: tweet.public_metrics?.like_count || 0,
                            retweets: tweet.public_metrics?.retweet_count || 0,
                            replies: tweet.public_metrics?.reply_count || 0
                        },
                        style: tweet.style || 'default'
                    })),
                    status: status || {}
                });
            } catch (innerError: any) {
                console.error('Error processing tweets:', innerError);
                return NextResponse.json({ 
                    tweets: [], 
                    status: {},
                    error: innerError.message,
                    code: 'TWEET_PROCESSING_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? innerError.stack : undefined
                }, { status: 500 });
            }
        } catch (error: any) {
            console.error('Error in tweets route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to fetch tweets',
                    code: error.code || 'TWEET_FETCH_ERROR',
                    tweets: [],
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}