import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('targets');
            
            const twitterManager = getTwitterManager();
            const targets = await twitterManager.getEngagementTargets();
            
            return NextResponse.json({ 
                success: true,
                targets 
            });
        } catch (error: any) {
            console.error('Error fetching targets:', error);
            return NextResponse.json({ 
                error: true,
                message: error.message || 'Failed to fetch targets'
            }, { 
                status: error.statusCode || 500 
            });
        }
    }))(req);
}

export async function POST(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('targets_add');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            const { username } = body;

            if (!username) {
                return NextResponse.json({ 
                    error: 'Username is required',
                    code: 'MISSING_USERNAME'
                }, { status: 400 });
            }

            await twitterManager.addEngagementTarget(username);
            const targets = await twitterManager.getEngagementTargets();

            return NextResponse.json({
                success: true,
                targets
            });
        } catch (error: any) {
            console.error('Error adding engagement target:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TARGET_ADD_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}