import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function POST() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
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
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    });
}

export async function GET() {
    return withAuth(async (supabase: any, session: any) => {
        try {
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                throw new Error('Twitter manager not initialized');
            }

            const status = await twitterManager.getMonitoringStatus();
            return NextResponse.json(status);
        } catch (error: any) {
            console.error('Failed to get monitoring status:', error);
            return NextResponse.json(
                { 
                    error: true, 
                    message: error.message || 'Failed to get monitoring status',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: 500 }
            );
        }
    });
}