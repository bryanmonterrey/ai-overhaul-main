import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

interface TwitterStatus {
    account?: {
        total_likes?: number;
        total_retweets?: number;
        total_replies?: number;
        engagement_rate?: number;
    };
    activity?: {
        optimal_style?: string;
        peak_hours?: string[];
        top_themes?: string[];
    };
}

interface EnvironmentalFactors {
    platformActivity: number;
    socialContext: string[];
    marketConditions: {
        sentiment: number;
        volatility: number;
        momentum: number;
        trends?: string[];
    };
}

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('analytics');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const baseStats = {
                engagement: {
                    total_likes: 0,
                    total_retweets: 0,
                    total_replies: 0,
                    average_engagement_rate: 0,
                },
                performance: {
                    best_style: 'N/A',
                    peak_hours: [],
                    top_themes: [],
                },
                trends: {
                    sentiment: 0,
                    volatility: 0,
                    momentum: 0,
                }
            };

            try {
                const status = await twitterManager.getStatus();
                const environmentalFactors = await twitterManager.getEnvironmentalFactors();

                if (status?.account) {
                    baseStats.engagement = {
                        total_likes: status.account.total_likes ?? 0,
                        total_retweets: status.account.total_retweets ?? 0,
                        total_replies: status.account.total_replies ?? 0,
                        average_engagement_rate: status.account.engagement_rate ?? 0,
                    };
                }

                if (status?.activity) {
                    baseStats.performance = {
                        best_style: status.activity.optimal_style ?? 'N/A',
                        peak_hours: status.activity.peak_hours ?? [],
                        top_themes: status.activity.top_themes ?? [],
                    };
                }

                if (environmentalFactors && 'marketConditions' in environmentalFactors) {
                    baseStats.trends = {
                        sentiment: environmentalFactors.marketConditions.sentiment ?? 0,
                        volatility: environmentalFactors.marketConditions.volatility ?? 0,
                        momentum: environmentalFactors.marketConditions.momentum ?? 0,
                    };
                }

                return NextResponse.json(baseStats);
            } catch (innerError: any) {
                console.error('Error fetching analytics data:', innerError);
                return NextResponse.json({ 
                    ...baseStats,
                    error: innerError.message,
                    code: 'ANALYTICS_PROCESSING_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? innerError.stack : undefined
                }, { status: 500 });
            }
        } catch (error: any) {
            console.error('Error in analytics route:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to fetch analytics',
                    code: error.code || 'ANALYTICS_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}