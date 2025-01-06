// src/app/types/chat.ts

import { AIResponse } from './ai';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  emotionalState?: string;
  aiResponse?: AIResponse;
  error?: boolean;
  retryable?: boolean;
}

export interface QualityMetrics {
  coherence: number;
  emotionalAlignment: number;
  narrativeConsistency: number;
  responseRelevance: number;
}