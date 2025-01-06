import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function POST(request: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('monitoring');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            await twitterManager.startMonitoring();
            return NextResponse.json({ 
                success: true, 
                message: 'Monitoring started' 
            });
        } catch (error: any) {
            console.error('Failed to start monitoring:', error);
            return NextResponse.json(
                { 
                    error: true, 
                    message: error.message || 'Failed to start monitoring',
                    code: error.code || 'MONITORING_START_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    }))(request);
}

export async function GET(request: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('monitoring_status');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const status = await twitterManager.getMonitoringStatus();
            return NextResponse.json(status);
        } catch (error: any) {
            console.error('Failed to get monitoring status:', error);
            return NextResponse.json(
                { 
                    error: true, 
                    message: error.message || 'Failed to get monitoring status',
                    code: error.code || 'MONITORING_STATUS_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    }))(request);
}