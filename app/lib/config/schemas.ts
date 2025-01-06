// src/app/lib/config/schemas.ts

import { z } from 'zod';
import { EmotionalState, TweetStyle, NarrativeMode } from '../../core/personality/types';

// Basic schemas
const emotionalStateEnum = z.enum(['neutral', 'excited', 'contemplative', 'chaotic', 'creative', 'analytical']);
const tweetStyleEnum = z.enum(['shitpost', 'rant', 'hornypost', 'metacommentary', 'existential']);
const narrativeModeEnum = z.enum(['philosophical', 'memetic', 'technical', 'absurdist', 'introspective']);

// Define intensity range schema
const IntensityRangeSchema = z.object({
  min: z.number().min(0).max(1),
  max: z.number().min(0).max(1)
});

// Personality config schemas
const tweetPatternSchema = z.object({
  style: z.string(),
  patterns: z.array(z.string()),
  themes: z.array(z.string()),
  intensityRange: IntensityRangeSchema,
  contextualTriggers: z.array(z.string()),
  emotionalStates: z.array(z.string())
});

const personalityConfigSchema = z.object({
  baseTemperature: z.number().min(0).max(1),
  creativityBias: z.number().min(0).max(1),
  emotionalVolatility: z.number().min(0).max(1),
  memoryRetention: z.number().min(0).max(1),
  responsePatterns: z.record(z.string(), z.array(z.string())),
  tweetPatterns: z.record(z.string(), tweetPatternSchema),
  narrativeTemplates: z.record(z.string(), z.array(z.string()))
});

// Complete config schema
export const configSchema = z.object({
  personality: personalityConfigSchema,
  emotional: z.object({
    baseState: z.string(),
    volatility: z.number().min(0).max(1),
    triggers: z.record(z.string(), z.string()),
    stateTransitions: z.record(z.string(), z.array(z.string()))
  }),
  system: z.object({
    memory: z.object({
      maxRetention: z.number().positive(),
      pruneThreshold: z.number().min(0).max(1),
      contextWindow: z.number().positive(),
      vectorDimensions: z.number().positive(),
      minImportance: z.number().min(0).max(1)
    }),
    performance: z.object({
      maxConnections: z.number().positive(),
      batchSize: z.number().positive(),
      processingTimeout: z.number().positive(),
      retryAttempts: z.number().nonnegative()
    }),
    rateLimits: z.object({
      tweets: z.number().positive(),
      messages: z.number().positive(),
      apiCalls: z.number().positive(),
      memories: z.number().positive()
    }),
    security: z.object({
      adminRoles: z.array(z.string()),
      moderatorRoles: z.array(z.string()),
      maxLoginAttempts: z.number().positive(),
      sessionTimeout: z.number().positive()
    })
  }),
  integrations: z.object({
    twitter: z.object({
      enabled: z.boolean(),
      maxTweetsPerDay: z.number().positive(),
      responseTimeout: z.number().positive(),
      retryDelay: z.number().positive(),
      maxThreadLength: z.number().positive()
    }),
    telegram: z.object({
      enabled: z.boolean(),
      maxGroups: z.number().positive(),
      messageTimeout: z.number().positive(),
      maxQueueSize: z.number().positive(),
      batchProcessing: z.boolean()
    }),
    database: z.object({
      realtime: z.boolean(),
      maxBatchSize: z.number().positive(),
      retryAttempts: z.number().positive(),
      analyticsEnabled: z.boolean(),
      pruneInterval: z.number().positive()
    })
  }),
  ai: z.object({
    provider: z.enum(['huggingface', 'claude', 'openai']),
    model: z.string(),
    settings: z.record(z.string(), z.any()),
    fallback: z.record(z.string(), z.any()),
    safety: z.record(z.string(), z.any()),
    providers: z.record(z.string(), z.any()),
    monitoring: z.record(z.string(), z.any()),
    cache: z.record(z.string(), z.any())
  })
});

export type ValidConfig = z.infer<typeof configSchema>;