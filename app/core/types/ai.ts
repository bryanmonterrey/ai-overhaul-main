export type ProviderType = 'anthropic' | 'openai' | 'huggingface';

export type ModelType = 'chat' | 'completion' | 'embedding';

export interface AIModel {
  id: string;
  provider: ProviderType;
  type: ModelType;
  name: string;
  version: string;
  contextWindow: number;
  maxTokens: number;
  costPer1kTokens: number;
}

export interface AIConfig {
  defaultProvider: ProviderType;
  providers: Array<{
    type: ProviderType;
    apiKey: string;
    baseURL?: string;
    organization?: string;
    models: AIModel[];
    rateLimit: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    };
  }>;
  defaultSettings: {
    temperature: number;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
    repetitionPenalty: number;
    stopSequences: string[];
    maxTokens: number;
  };
  safety: {
    contentFiltering: {
      enabled: boolean;
      levels: {
        hate: 'low' | 'medium' | 'high';
        violence: 'low' | 'medium' | 'high';
        sexual: 'low' | 'medium' | 'high';
      };
    };
    topicBlocking: {
      enabled: boolean;
      blockedTopics: string[];
    };
    outputValidation: {
      enabled: boolean;
      maxTokens: number;
      stopSequences: string[];
      allowedFormats?: string[];
    };
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    strategy: 'lru' | 'fifo';
  };
}

export interface AISettings {
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  repetitionPenalty: number;
  stopSequences: string[];
  maxTokens: number;
}

export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: ProviderType;
  tokenCount: TokenCount;
  cached: boolean;
  duration: number;
  cost: number;
}

export interface StreamingAIResponse extends AIResponse {
  isComplete: boolean;
  chunks: string[];
}

export interface CacheConfig {
  maxSize: number;  // in MB
  ttl: number;      // in seconds
}