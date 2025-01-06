// src/app/interfaces/telegram/api/route.ts

import { NextResponse } from 'next/server';
import { TelegramManager } from '../../lib/telegram';
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

const telegramInputSchema = z.object({
  message: z.string().min(1),
  chatId: z.string(),
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

// Initialize systems
const config = configManager.getAll();
const personalitySystem = new PersonalitySystem({
  baseTemperature: config.personality.baseTemperature,
  creativityBias: config.personality.creativityBias,
  emotionalVolatility: config.personality.emotionalVolatility,
  memoryRetention: config.personality.memoryRetention,
  responsePatterns: {
    neutral: config.personality.responsePatterns?.neutral ?? [],
    excited: config.personality.responsePatterns?.excited ?? [],
    contemplative: config.personality.responsePatterns?.contemplative ?? [],
    chaotic: config.personality.responsePatterns?.chaotic ?? [],
    creative: config.personality.responsePatterns?.creative ?? [],
    analytical: config.personality.responsePatterns?.analytical ?? []
  }
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
const telegramManager = new TelegramManager();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedInput = validateAIInput(telegramInputSchema, body);

    // Get environmental factors with retry
    const [activityLevel, chatContext] = await Promise.all([
      withRetry(() => telegramManager.getActivityLevel(validatedInput.chatId)),
      withRetry(() => telegramManager.getChatContext(validatedInput.chatId))
    ]);

    const environmentalFactors: EnvironmentalFactors = {
      platform: 'telegram',
      timeOfDay: new Date().getHours() >= 17 ? 'evening' : 
                 new Date().getHours() >= 12 ? 'afternoon' : 
                 new Date().getHours() >= 5 ? 'morning' : 'night',
      platformActivity: activityLevel || 0,
      socialContext: chatContext || [],
      marketConditions: {
        sentiment: 0.5,
        volatility: 0.5,
        momentum: 0.5,
        trends: []
      }
    };

    // Process through integration manager with retry
    const result = await withRetry(async () => {
      return integrationManager.processInput(
        validatedInput.message,
        'telegram' as Platform
      );
    });

    // Send message with retry
    await withRetry(async () => {
      await telegramManager.sendMessage(validatedInput.chatId, result.response);
    });

    return NextResponse.json({ 
      success: true, 
      response: result.response,
      state: result.state,
      emotion: result.emotion
    });

  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Telegram processing error:', handledError);
    
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      throw new AIError('ChatId is required', 'VALIDATION_ERROR', 400);
    }

    // Get status with retry
    const status = await withRetry(() => telegramManager.getChatStatus(chatId));
    
    const [activeChats, lastActivity] = await Promise.all([
      telegramManager.getActiveChats(),
      withRetry(() => telegramManager.getLastActivity(chatId))
    ]);
    
    return NextResponse.json({
      success: true,
      status,
      activeChats,
      lastActivity
    });

  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Error getting Telegram status:', handledError);
    
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

export async function PUT(request: Request) {
  try {
    const update = await request.json();
    
    if (!update) {
      throw new AIError('No update data provided', 'VALIDATION_ERROR', 400);
    }

    await withRetry(() => telegramManager.processUpdate(update));
    return NextResponse.json({ success: true });

  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Error processing Telegram webhook:', handledError);
    
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

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { chatId, clearHistory } = validateAIInput(
      z.object({
        chatId: z.string(),
        clearHistory: z.boolean().optional()
      }),
      body
    );

    if (clearHistory) {
      await withRetry(() => telegramManager.clearChatHistory(chatId));
    } else {
      await withRetry(() => telegramManager.removeChat(chatId));
    }

    return NextResponse.json({ 
      success: true,
      message: clearHistory ? 'Chat history cleared' : 'Chat removed'
    });

  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Error handling Telegram DELETE request:', handledError);
    
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