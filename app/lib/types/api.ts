// src/app/lib/types/api.ts

import { 
    EmotionalState, 
    PersonalityState, 
    Memory,
    TweetStyle
  } from '../../core/types';
import { AIResponse, ProviderType } from '../../core/types/ai';
  
  // Chat API types
  export interface ChatResponse {
    response: string;
    emotionalState: EmotionalState;
    personalityState: PersonalityState;
  }
  
  export interface ChatHistoryResponse {
    messages: Array<{
      id: string;
      content: string;
      sender: 'user' | 'ai';
      timestamp: string;
      emotionalState?: EmotionalState;
    }>;
  }
  
  // Twitter API types
  export interface TweetResponse {
    tweet: {
      id: string;
      content: string;
      timestamp: string;
      metrics: {
        likes: number;
        retweets: number;
        replies: number;
      };
      style: TweetStyle;
    };
    personalityState: PersonalityState;
  }
  
  export interface TwitterAnalytics {
    engagement: {
      total_likes: number;
      total_retweets: number;
      total_replies: number;
      average_engagement_rate: number;
    };
    performance: {
      best_style: TweetStyle;
      peak_hours: string[];
      top_themes: string[];
    };
    trends: {
      sentiment: number;
      volatility: number;
      momentum: number;
    };
  }
  
  // Telegram API types
  export interface TelegramResponse {
    message: {
      id: string;
      chatId: string;
      content: string;
      timestamp: string;
      emotionalState: EmotionalState;
    };
    personalityState: PersonalityState;
  }
  
  export interface TelegramStats {
    activeChats: number;
    messagesProcessed: number;
    averageResponseTime: number;
    uptime: number;
    successRate: number;
    activeUsers: Array<{
      chatId: string;
      messageCount: number;
      lastActive: string;
    }>;
  }
  
  // Admin API types
  export interface SystemStats {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
    totalChats: number;
    totalTweets: number;
    averageResponseTime: number;
    successRate: number;
    totalMemories: number;
    memoryEfficiency: number;
    contextSwitches: number;
    cacheHitRate: number;
  }
  
  export interface AdminResponse {
    systemState: PersonalityState;
    stats: SystemStats;
  }
  
  // Common error response type
  export interface ApiError {
    error: string;
    code?: string;
    details?: unknown;
  }