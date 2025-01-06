// src/app/api/chat/route.ts

import { NextResponse } from 'next/server';
import { IntegrationManager } from '../../core/personality/IntegrationManager';
import { LLMManager } from '../../core/llm/model_manager';
import { AIError, handleAIError } from '../../core/errors/AIError';
import { configManager } from '../../lib/config/manager';
import { validateAIInput, withRetry } from '../../lib/utils/ai-error-utils';
import { z } from 'zod';
import { Platform } from '../../core/types';
import { PersonalitySystem } from '../../core/personality/PersonalitySystem';
import { EmotionalSystem } from '../../core/personality/EmotionalSystem';
import { MemorySystem } from '../../core/personality/MemorySystem';
import { EmotionalState } from '../../core/personality/types';
import { LettaClient } from '../../lib/memory/letta-client';

// Input validation schema
const chatInputSchema = z.object({
  message: z.string().min(1).max(4000),
  personality: z.any().optional().nullable(),
  context: z.object({
    environmentalFactors: z.object({
      timeOfDay: z.string(),
      platformActivity: z.number(),
      socialContext: z.array(z.string()),
      platform: z.string(),
      marketConditions: z.object({
        sentiment: z.number(),
        volatility: z.number(),
        momentum: z.number(),
        trends: z.array(z.string())
      })
    }).optional(),
    recentInteractions: z.array(z.any()).optional(),
    activeNarratives: z.array(z.string()).optional()
  }).optional()
});

// Initialize systems
const config = configManager.getAll();
const personalitySystem = new PersonalitySystem({
  baseTemperature: config.personality.baseTemperature,
  creativityBias: config.personality.creativityBias,
  emotionalVolatility: config.personality.emotionalVolatility,
  memoryRetention: config.personality.memoryRetention,
  platform: 'chat' as Platform,
  responsePatterns: {
    neutral: [],
    excited: [],
    contemplative: [],
    analytical: [],
    chaotic: [],
    creative: []
  } as Record<EmotionalState, string[]>
});
const emotionalSystem = new EmotionalSystem();
const memorySystem = new MemorySystem();
const llmManager = new LLMManager();

const integrationManager = new IntegrationManager(
  personalitySystem,
  emotionalSystem,
  memorySystem,
  llmManager
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedInput = validateAIInput(chatInputSchema, body);
    const platform = (validatedInput.context?.environmentalFactors?.platform as Platform) || 'chat';

    // Use withRetry for the integration manager call
    const result = await withRetry(async () => {
      // The memory handling is now done inside processInput
      const response = await integrationManager.processInput(
        validatedInput.message,
        platform
      );

      // Store new memory with enhanced metadata
      const memClient = new LettaClient();
      await memClient.storeMemory({
        key: `chat-${Date.now()}`,
        memory_type: 'chat_history',
        data: {
          messages: [{
            role: 'user',
            content: validatedInput.message,
            timestamp: new Date().toISOString()
          }, {
            role: 'assistant',
            content: response.response,
            timestamp: new Date().toISOString()
          }]
        },
        metadata: {
          platform,
          personalityState: response.state,
          emotionalState: response.emotion,
          conversationSummary: await integrationManager.summarizeMemories([{
            data: {
              messages: [{
                role: 'user',
                content: validatedInput.message,
                timestamp: new Date().toISOString()
              }, {
                role: 'assistant',
                content: response.response,
                timestamp: new Date().toISOString()
              }]
            },
            metadata: {
              platform,
              personalityState: response.state,
              emotionalState: response.emotion
            }
          }])
        }
      });

      return response;
    });


    // Ensure the response has all required fields
    return NextResponse.json({
      response: result.response,
      personalityState: result.state,
      emotionalState: result.emotion,
      aiResponse: {
        content: result.response,
        model: llmManager.getCurrentModel(),
        tokenCount: {
          total: 0,
          prompt: 0,
          completion: 0
        },
        cached: false,
        duration: 0,
        cost: 0
      }
    });
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Chat processing error:', handledError);
    
    return NextResponse.json(
      { 
        error: handledError.message,
        code: handledError.code,
        retryable: handledError.retryable
      },
      { status: handledError.statusCode || 500 }
    );
  }
}