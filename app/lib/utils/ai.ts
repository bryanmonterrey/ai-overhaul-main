// src/app/lib/utils/ai.ts

import { TokenCount, ProviderType, CacheConfig } from '../../core/types/ai';
import { LRUCache } from 'lru-cache';

// Token counting utility
export class TokenCounter {
  private static readonly AVG_CHARS_PER_TOKEN = 4;

  static estimateTokenCount(text: string, provider: ProviderType): number {
    // This is a basic estimation - for production, use provider-specific tokenizers
    return Math.ceil(text.length / this.AVG_CHARS_PER_TOKEN);
  }

  static async getTokenCount(text: string, provider: ProviderType): Promise<TokenCount> {
    const total = this.estimateTokenCount(text, provider);
    return {
      prompt: total,
      completion: 0,
      total
    };
  }
}

// Rate limiter utility
export class RateLimiter {
  private requestCounts: Map<string, number> = new Map();
  private tokenCounts: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  constructor(
    private readonly requestsPerMinute: number,
    private readonly tokensPerMinute: number
  ) {}

  async checkLimit(provider: string, estimatedTokens: number): Promise<boolean> {
    this.resetIfNeeded();

    const currentRequests = this.requestCounts.get(provider) || 0;
    const currentTokens = this.tokenCounts.get(provider) || 0;

    if (
      currentRequests >= this.requestsPerMinute ||
      currentTokens + estimatedTokens > this.tokensPerMinute
    ) {
      return false;
    }

    this.requestCounts.set(provider, currentRequests + 1);
    this.tokenCounts.set(provider, currentTokens + estimatedTokens);
    return true;
  }

  private resetIfNeeded(): void {
    const now = new Date();
    if (now.getTime() - this.lastReset.getTime() >= 60000) {
      this.requestCounts.clear();
      this.tokenCounts.clear();
      this.lastReset = now;
    }
  }
}

// Cache manager utility
export class CacheManager<T extends object = object> {
  private cache: LRUCache<string, T>;
  
  constructor(config: CacheConfig) {
    this.cache = new LRUCache<string, T>({
      max: config.maxSize * 1024 * 1024, // Convert MB to bytes
      ttl: config.ttl * 1000, // Convert seconds to milliseconds
      allowStale: false,
      updateAgeOnGet: true
    });
  }

  async get(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      itemCount: this.cache.size
    };
  }
}

// Utility function to generate cache keys
export function generateCacheKey(
  provider: ProviderType,
  model: string,
  input: string,
  settings: Record<string, unknown>
): string {
  const settingsStr = JSON.stringify(settings);
  return `${provider}:${model}:${Buffer.from(input).toString('base64')}:${
    Buffer.from(settingsStr).toString('base64')
  }`;
}