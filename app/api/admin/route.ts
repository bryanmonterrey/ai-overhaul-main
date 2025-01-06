// src/app/interfaces/admin/api/route.ts

import { NextResponse } from 'next/server';
import { IntegrationManager } from '../../core/personality/IntegrationManager';
import { configManager } from '../../lib/config/manager';
import { supabase } from '../../lib/supabase';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { AIError, handleAIError } from '../../core/errors/AIError';
import { validateAIInput, withRetry } from '../../lib/utils/ai-error-utils';
import { z } from 'zod';
import { PersonalitySystem } from '../../core/personality/PersonalitySystem';
import { EmotionalSystem } from '../../core/personality/EmotionalSystem';
import { MemorySystem } from '../../core/personality/MemorySystem';
import { LLMManager } from '../../core/llm/model_manager';
import { EmotionalState } from '../../core/types';

// Validation schemas
const updateActionSchema = z.object({
  action: z.literal('update'),
  updates: z.object({
    personalityState: z.any().optional(),
    emotionalResponse: z.any().optional(),
    platform: z.enum(['twitter', 'telegram', 'chat', 'internal']).optional()
  })
});

const resetActionSchema = z.object({
  action: z.literal('reset')
});

const adminActionSchema = z.discriminatedUnion('action', [
  updateActionSchema,
  resetActionSchema
]);

const config = configManager.getAll();
const personalitySystem = new PersonalitySystem({
  baseTemperature: config.personality.baseTemperature,
  creativityBias: config.personality.creativityBias,
  emotionalVolatility: config.personality.emotionalVolatility,
  memoryRetention: config.personality.memoryRetention,
  responsePatterns: {
    neutral: [config.personality.responsePatterns.neutral],
    happy: [config.personality.responsePatterns.happy],
    sad: [config.personality.responsePatterns.sad],
    excited: [config.personality.responsePatterns.excited],
    contemplative: [config.personality.responsePatterns.contemplative],
    analytical: [config.personality.responsePatterns.analytical],
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

async function checkAuth(request: Request) {
  try {
    const supabaseClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session?.user) {
      throw new AIError('Unauthorized', 'AUTH_ERROR', 401);
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!roles || roles.role !== 'admin') {
      throw new AIError('Insufficient permissions', 'AUTH_ERROR', 401);
    }

    return session.user;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError('Authentication failed', 'AUTH_ERROR', 401);
  }
}

interface SystemStats {
  timestamp: string;
  // Add other fields as needed
}

export async function GET(request: Request) {
  try {
    const user = await checkAuth(request);

    const [currentState, statsResult, activeConnectionsResult] = await Promise.all([
      withRetry(async () => await integrationManager.getCurrentState()),
      withRetry(async () => {
        const { data, error } = await supabase
          .from('system_stats')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        
        if (error) throw error;
        return data as SystemStats;
      }),
      withRetry(async () => {
        const { count } = await supabase
          .from('active_sessions')
          .select('*', { count: 'exact', head: true });
        return { count: count || 0 };
      })
    ]);

    return NextResponse.json({ 
      systemState: currentState,
      stats: {
        ...statsResult,
        activeConnections: activeConnectionsResult.count,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      }
    });
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Admin API error:', handledError);
    
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

export async function POST(request: Request) {
  try {
    const user = await checkAuth(request);
    const body = await request.json();
    const validatedInput = validateAIInput(adminActionSchema, body);

    // Log admin action with retry
    await withRetry(async () => {
      const { error } = await supabase
        .from('admin_logs')
        .insert({
          user_id: user.id,
          action: validatedInput.action,
          details: 'updates' in validatedInput ? validatedInput.updates : null,
          timestamp: new Date().toISOString()
        });
      
      if (error) throw error;
    });

    let systemState;

    if (validatedInput.action === 'update') {
      // Perform update with retry
      await withRetry(async () => {
        await integrationManager.updateState(validatedInput.updates);
        
        // Store state update in Supabase
        const { error } = await supabase
          .from('personality_states')
          .insert({
            state: validatedInput.updates,
            updated_by: user.id,
            timestamp: new Date().toISOString()
          });
        
        if (error) throw error;
      });
    } else if (validatedInput.action === 'reset') {
      // Perform reset with retry
      await withRetry(async () => {
        await integrationManager.reset();
        
        // Log system reset
        const { error } = await supabase
          .from('system_resets')
          .insert({
            initiated_by: user.id,
            timestamp: new Date().toISOString()
          });
        
        if (error) throw error;
      });
    }

    // Get updated state with retry
    systemState = await withRetry(async () => await integrationManager.getCurrentState());

    return NextResponse.json({ 
      success: true,
      systemState
    });
  } catch (error) {
    const handledError = handleAIError(error);
    console.error('Admin API error:', handledError);
    
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