import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/middleware/auth-middleware';
import { withConfig } from '../../../lib/middleware/configMiddleware';
import { checkTwitterRateLimit } from '../../../lib/middleware/twitter-rate-limiter';
import { aiService } from '../../../lib/services/ai';
import { TwitterTrainingService } from '../../../lib/services/twitter-training';
import { LettaClient } from '../../../lib/memory/letta-client';
import { PersonalitySystem } from '../../../core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '../../../core/personality/config';
import { Platform } from '../../../core/personality/types';
import { TweetStyle } from '../../../core/prompts/styles/tweet-styles';
import { v4 as uuidv4 } from 'uuid';
import { PromptBuilder } from '../../../core/prompts/prompt-builder';
import { ResponseValidator } from '../../../core/prompts/validation/response-validator';
import { STYLE_TRAITS } from '../../../core/prompts/styles/tweet-styles';
import { createClient } from '@supabase/supabase-js'; // Add this import

// Helper function to build enhanced context
function buildEnhancedContext(
    memoryChain: any[],
    contentPatterns: string[],
    contextAnalysis: any
): string {
    let enhancedContext = '';
    
    if (memoryChain.length > 0) {
        enhancedContext += `\nRelevant conversation history:\n${
            memoryChain.map((m: any) => m.content).join('\n')
        }`;
    }

    if (contentPatterns.length > 0) {
        enhancedContext += `\nIdentified patterns in conversation:\n${
            contentPatterns.join('\n')
        }`;
    }

    if (contextAnalysis) {
        enhancedContext += `\nContext Analysis:
- Sentiment: ${contextAnalysis.sentiment > 0 ? 'Positive' : contextAnalysis.sentiment < 0 ? 'Negative' : 'Neutral'}
- Emotional State: ${contextAnalysis.emotional_context}
- Key Concepts: ${contextAnalysis.key_concepts?.join(', ') || 'None'}
- Importance: ${contextAnalysis.importance_score || 0}
`;
    }

    return enhancedContext;
}

// Helper function to store memory
async function storeReplyMemory(
    lettaClient: LettaClient,
    reply: string,
    tweet: any,
    style: string,
    contextAnalysis: any,
    contentPatterns: string[]
) {
    try {
        return await lettaClient.storeMemory({
            key: uuidv4(),
            memory_type: 'tweet_history',
            data: {
                content: reply,
                original_tweet: tweet,
                generated_at: new Date().toISOString(),
                type: 'generated_reply'
            },
            metadata: {
                style,
                analysis: contextAnalysis || {},
                patterns: contentPatterns,
                reply_to: tweet.id
            }
        });
    } catch (error) {
        console.error('Memory storage error:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    return withConfig(withAuth(async (supabase: any, session: any) => {
        try {
            await checkTwitterRateLimit('replies');
            
            let { tweet, style, count = 5 } = await request.json();

            if (!tweet || (!tweet.content && typeof tweet !== 'string')) {
                return NextResponse.json({
                    error: 'Invalid tweet data',
                    code: 'INVALID_TWEET_DATA'
                }, { status: 400 });
            }
        
            if (typeof tweet === 'string') {
                tweet = { 
                    id: uuidv4(),
                    content: tweet 
                };
            }
        
            const lettaClient = new LettaClient();
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const trainingService = new TwitterTrainingService(supabase);

            const personalitySystem = new PersonalitySystem(
                {
                    ...DEFAULT_PERSONALITY,
                    platform: 'twitter' as Platform
                },
                trainingService
            );

            // Initial memory storage
            try {
                console.log('Storing initial memory:', tweet.id);
                const storeResult = await lettaClient.storeMemory({
                    key: tweet.id,
                    memory_type: 'tweet_history',
                    data: {
                        content: tweet.content,
                        timestamp: new Date().toISOString(),
                        type: 'original_tweet'
                    },
                    metadata: {
                        tweet_id: tweet.id,
                        is_original: true
                    }
                });
                
                if (!storeResult || storeResult.error) {
                    throw new Error(storeResult?.error || 'Failed to store initial memory');
                }

                // Memory verification with delay
                await new Promise(resolve => setTimeout(resolve, 500));
                const verifyMemory = await lettaClient.getMemory(tweet.id, 'tweet_history');
                
                if (!verifyMemory) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Parallel context gathering
                const [patterns, analysis, trainingExamplesArrays] = await Promise.allSettled([
                    lettaClient.analyzeContent(tweet.content).catch(error => {
                        console.error('Content analysis error:', error);
                        return { success: false, data: { patterns: [] } };
                    }),
                    personalitySystem.analyzeContext(tweet.content).catch(error => {
                        console.error('Context analysis error:', error);
                        return null;
                    }),
                    Promise.all([
                        trainingService.getTrainingExamples(75, 'truth_terminal'),
                        trainingService.getTrainingExamples(75, 'RNR_0'),
                        trainingService.getTrainingExamples(75, '0xzerebro'),
                        trainingService.getTrainingExamples(75, 'a1lon9')
                    ]).catch(error => {
                        console.error('Training examples error:', error);
                        return [];
                    })
                ]);

                const memoryChainResult = await lettaClient.chainMemories(tweet.id, {
                    depth: 3,
                    min_similarity: 0.6
                }).catch(error => {
                    console.error('Memory chain error:', error);
                    return { success: true, data: { chain: [] } };
                });

                // Process results
                const memoryChain = memoryChainResult?.data?.chain || [];
                const contentPatterns = patterns.status === 'fulfilled' ? patterns.value?.data?.patterns || [] : [];
                const contextAnalysis = analysis.status === 'fulfilled' ? analysis.value : null;
                const allExamples = trainingExamplesArrays.status === 'fulfilled' ? 
                    trainingExamplesArrays.value.flat() : [];

                // Build context and prompt
                const enhancedContext = buildEnhancedContext(memoryChain, contentPatterns, contextAnalysis);
                
                // Use our new PromptBuilder
                const prompt = PromptBuilder.buildTwitterPrompt(style as TweetStyle, {
                    content: tweet.content,
                    emotionalState: contextAnalysis?.emotional_context || 'creative',
                    chaosLevel: contentPatterns?.length > 0 ? 0.7 : 0.8,
                    memeEnergy: 0.9,
                    trainingExamples: allExamples,
                    enhancedContext
                });

                const replies: any[] = [];
                const replyPromises: Promise<any>[] = [];

                // Generate replies
                for (let i = 0; i < count; i++) {
                    let validReply: string | null = null;
                    let attempts = 0;
                    const maxRetries = 3;
              
                    while (attempts < maxRetries && !validReply) {
                        attempts++;
                        console.log(`Generation attempt ${attempts}/${maxRetries} for reply ${i + 1}`);
              
                        try {
                            const generatedReply = await aiService.generateResponse(
                                `Reply to tweet: ${tweet.content}`,
                                prompt
                            );
                  
                            if (generatedReply) {
                                const cleanedReply = ResponseValidator.cleanResponse(generatedReply);
                  
                                if (ResponseValidator.validateTweetResponse(cleanedReply)) {
                                    validReply = cleanedReply;
                                    const memoryPromise = storeReplyMemory(
                                        lettaClient,
                                        validReply,
                                        tweet,
                                        style,
                                        contextAnalysis,
                                        contentPatterns
                                    );

                                    replyPromises.push(memoryPromise);
                                    replies.push({
                                        content: validReply,
                                        style: style,
                                        analysis: {
                                            sentiment: contextAnalysis?.sentiment,
                                            patterns: contentPatterns,
                                            emotional_context: contextAnalysis?.emotional_context
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('AI generation error:', error);
                            continue;
                        }
                    }
                }

                // Wait for all memory stores
                await Promise.allSettled(replyPromises);
              
                return NextResponse.json({ 
                    replies,
                    context: {
                        patterns: contentPatterns,
                        analysis: contextAnalysis,
                        memory_chain: memoryChain
                    }
                });

            } catch (error) {
                console.error('Error in context processing:', error);
                return NextResponse.json({ 
                    error: true,
                    message: error instanceof Error ? error.message : 'Failed to process context',
                    code: 'CONTEXT_PROCESSING_ERROR',
                    stack: process.env.NODE_ENV === 'development' ? 
                        error instanceof Error ? error.stack : undefined 
                        : undefined
                }, { status: 500 });
            }
            
        } catch (error: any) {
            console.error('Error generating replies:', error);
            return NextResponse.json({ 
                error: true,
                message: error.message || 'Failed to generate replies',
                code: error.code || 'REPLY_GENERATION_ERROR',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }, { status: error.statusCode || 500 });
        }
    }))(request);
}