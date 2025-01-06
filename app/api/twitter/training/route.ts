import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { getTwitterManager } from '../../../lib/twitter-manager-instance';

export async function GET(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('training');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const { searchParams } = new URL(req.url);
            const username = searchParams.get('username');
            const limit = parseInt(searchParams.get('limit') || '100', 10);

            if (!username) {
                return NextResponse.json({ 
                    error: 'Username is required',
                    code: 'MISSING_USERNAME'
                }, { status: 400 });
            }

            const trainingData = await twitterManager.getTrainingData(username, limit);
            return NextResponse.json({ data: trainingData });
            
        } catch (error: any) {
            console.error('Error fetching training data:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TRAINING_FETCH_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}

export async function POST(req: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('training_add');
            
            const twitterManager = getTwitterManager();
            if (!twitterManager) {
                return NextResponse.json({ 
                    error: 'Twitter manager not initialized',
                    code: 'TWITTER_INIT_ERROR'
                }, { status: 500 });
            }

            const body = await req.json();
            const { username, tweets } = body;

            if (!username || !tweets) {
                return NextResponse.json({ 
                    error: 'Username and tweets are required',
                    code: 'MISSING_PARAMETERS'
                }, { status: 400 });
            }

            await twitterManager.addTrainingData(username, tweets);
            return NextResponse.json({
                success: true,
                message: 'Training data added successfully'
            });
            
        } catch (error: any) {
            console.error('Error adding training data:', error);
            return NextResponse.json(
                { 
                    error: 'Internal server error',
                    message: error.message,
                    code: error.code || 'TRAINING_ADD_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }, 
                { status: error.statusCode || 500 }
            );
        }
    }))(req);
}