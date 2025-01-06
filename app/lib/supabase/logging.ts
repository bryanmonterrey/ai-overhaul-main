// src/app/lib/supabase/logging.ts

import { supabase } from '../supabase';
import { Message, QualityMetrics } from '../../core/types/chat';
import { EmotionalState, Platform } from '../../core/types';

interface MessageLog {
  content: string;
  sender: 'user' | 'ai';
  emotional_state?: EmotionalState;
  platform: Platform;
  token_count?: number;
  model_used?: string;
  response_time?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  narrative_mode?: string;
  training_quality?: number;
}

export async function logMessage(
  message: Message, 
  platform: Platform = 'chat',
  metadata?: {
    responseTime?: number;
    trainingQuality?: number;
  }
) {
  const messageLog: MessageLog = {
    content: message.content,
    sender: message.sender,
    emotional_state: message.emotionalState as EmotionalState,
    platform,
    token_count: message.aiResponse?.tokenCount.total,
    model_used: message.aiResponse?.model,
    response_time: metadata?.responseTime,
    prompt_tokens: message.aiResponse?.tokenCount.prompt,
    completion_tokens: message.aiResponse?.tokenCount.completion,
    training_quality: metadata?.trainingQuality
  };

  const { error } = await supabase
    .from('message_logs')
    .insert(messageLog);

  if (error) {
    console.error('Error logging message:', error);
  }
}

export async function getTrainingData(
  quality_threshold = 0.8,
  limit = 1000
) {
  const { data, error } = await supabase
    .from('message_logs')
    .select('*')
    .gte('training_quality', quality_threshold)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data;
}