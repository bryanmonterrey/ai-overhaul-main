// src/app/lib/services/ai.ts
import { configManager } from '../config/manager';
import { 
    AIConfig, 
    AIResponse, 
    ProviderType 
} from '@/app/core/types/ai';
import { TokenCounter, RateLimiter, CacheManager } from '../../lib/utils/ai';
import { PersonalitySystem } from '../../core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '../../core/personality/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function getPersonalitySystem(): PersonalitySystem {
  return new PersonalitySystem(DEFAULT_PERSONALITY);
}

interface FallbackConfig {
  enabled: boolean;
  provider: 'claude' | 'openai';
  model: string;
}

export class AIService {
  private static instance: AIService;
  private provider: 'claude' | 'openai';

  private constructor() {
    try {
      console.log('Initializing AI Service...');
      this.provider = configManager.get('ai', 'provider') as 'claude' | 'openai';
      console.log('AI Service initialized successfully with provider:', this.provider);
    } catch (error) {
      console.error('Error during AI Service initialization:', error);
      throw error;
    }
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateResponse(prompt: string, context?: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          context,
          provider: this.provider
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate response');
      }

      const data = await response.json();
      return data.response;

    } catch (error) {
      const fallback = configManager.get('ai', 'fallback') as FallbackConfig;
      if (fallback.enabled) {
        console.warn(`Primary AI provider failed, using fallback`);
        return this.generateWithFallback(prompt, context);
      }
      throw error;
    }
  }

  private async generateWithFallback(prompt: string, context?: string) {
    const fallbackConfig = configManager.get('ai', 'fallback') as FallbackConfig;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          context,
          provider: fallbackConfig.provider,
          model: fallbackConfig.model
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate fallback response');
      }

      const data = await response.json();
      return data.response;

    } catch (error) {
      console.error('Fallback also failed:', error);
      throw error;
    }
  }

  public setProvider(provider: 'claude' | 'openai') {
    this.provider = provider;
  }
}

export const aiService = AIService.getInstance();