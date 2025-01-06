import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../lib/middleware/auth-middleware';
import { withConfig } from '../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../lib/middleware/twitter-rate-limiter';
import { TwitterManager } from '../../core/twitter/twitter-manager';
import { IntegrationManager } from '../../core/personality/IntegrationManager';
import { configManager } from '../../lib/config/manager';
import { EnvironmentalFactors, Platform } from '../../core/types';
import { validateAIInput, withRetry } from '../../lib/utils/ai-error-utils';
import { AIError, handleAIError } from '../../core/errors/AIError';
import { z } from 'zod';
import { PersonalitySystem } from '../../core/personality/PersonalitySystem';
import { EmotionalSystem } from '../../core/personality/EmotionalSystem';
import { MemorySystem } from '../../core/personality/MemorySystem';
import { LLMManager } from '../../core/llm/model_manager';
import { TwitterApiClient } from '../../lib/twitter-client';
import { createClient } from '@supabase/supabase-js';
import { TwitterTrainingService } from '../../lib/services/twitter-training';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '../../types/supabase';
import { cookies } from 'next/headers';

const twitterInputSchema = z.object({
    type: z.string(),
    content: z.string().min(1).max(280),
    context: z.object({
        environmentalFactors: z.object({
            timeOfDay: z.string().optional(),
            platformActivity: z.number().optional(),
            socialContext: z.array(z.string()).optional(),
            platform: z.string().optional(),
            marketConditions: z.object({
                sentiment: z.number(),
                volatility: z.number(),
                momentum: z.number(),
                trends: z.array(z.string())
            }).optional()
        }).optional()
    }).optional()
});

const client = new TwitterApiClient({
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
});

// Move personalitySystem initialization here
const personalityConfig = {
    baseTemperature: 0.7,
    creativityBias: 0.5,
    emotionalVolatility: 0.3,
    memoryRetention: 0.8,
    responsePatterns: {
        neutral: [],
        excited: [],
        contemplative: [],
        chaotic: [],
        creative: [],
        analytical: []
    },
    platform: 'twitter'
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const trainingService = new TwitterTrainingService(supabase);
const personalitySystem = new PersonalitySystem(personalityConfig, trainingService);

// Now twitterManager can use personalitySystem
const twitterManager = new TwitterManager(
  client,
  personalitySystem,
  supabase,  // Pass the same supabase instance
  new TwitterTrainingService(supabase)  // Pass supabase to TwitterTrainingService
);

const emotionalSystem = new EmotionalSystem();
const memorySystem = new MemorySystem();
const llmManager = new LLMManager();

const integrationManager = new IntegrationManager(
    personalitySystem,
    emotionalSystem,
    memorySystem,
    llmManager
);

export async function POST(request: NextRequest) {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('post_tweet');
            
            const body = await request.json();
            const validatedInput = validateAIInput(twitterInputSchema, body);

            // Get Twitter environment data with retry
            const twitterEnvironment = await withRetry(async () => {
                return await twitterManager.getEnvironmentalFactors();
            });

            const environmentalFactors: EnvironmentalFactors = {
                platform: 'twitter',
                timeOfDay: new Date().getHours() >= 17 ? 'evening' : 
                          new Date().getHours() >= 12 ? 'afternoon' : 
                          new Date().getHours() >= 5 ? 'morning' : 'night',
                platformActivity: twitterEnvironment.platformActivity || 0,
                socialContext: twitterEnvironment.socialContext || [],
                marketConditions: {
                    sentiment: 0.5,
                    volatility: 0.5,
                    momentum: 0.5,
                    trends: []
                }
            };

            // Process through integration manager with retry
            const result = await withRetry(async () => {
                return await integrationManager.processInput(
                    validatedInput.content,
                    'twitter' as Platform
                );
            });

            // Post to Twitter with retry
            const tweet = await withRetry(async () => {
                return await twitterManager.postTweet(result.response);
            });

            return NextResponse.json({ 
                success: true, 
                tweet,
                state: result.state,
                emotion: result.emotion
            });
        } catch (error: any) {
            console.error('Twitter API Error:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Twitter API Error',
                    code: error.code || 'TWITTER_POST_ERROR',
                    retryable: error.retryable || false,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                { status: error.statusCode || 500 }
            );
        }
    }))(request);
}

export async function GET(request: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('get_status');
            
            const status = await withRetry(async () => {
                const environmentalFactors = await twitterManager.getEnvironmentalFactors();
                return {
                    status: 'ok',
                    environmentalFactors
                };
            });
            
            return NextResponse.json(status);
        } catch (error: any) {
            console.error('Twitter Status Error:', error);
            return NextResponse.json(
                { 
                    error: true,
                    message: error.message || 'Failed to get Twitter status',
                    code: error.code || 'TWITTER_STATUS_ERROR',
                    retryable: error.retryable || false,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                { status: error.statusCode || 500 }
            );
        }
    }))(request);
}