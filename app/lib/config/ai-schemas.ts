// src/app/lib/config/ai-schemas.ts

import { z } from 'zod';

export const providerTypeSchema = z.enum(['anthropic', 'openai', 'huggingface']);
export const modelTypeSchema = z.enum(['chat', 'completion', 'embedding']);

export const aiModelSchema = z.object({
  id: z.string(),
  provider: providerTypeSchema,
  type: modelTypeSchema,
  name: z.string(),
  version: z.string(),
  contextWindow: z.number().positive(),
  maxTokens: z.number().positive(),
  costPer1kTokens: z.number().nonnegative()
});

export const providerConfigSchema = z.object({
  type: providerTypeSchema,
  apiKey: z.string(),
  baseURL: z.string().url().optional(),
  organization: z.string().optional(),
  models: z.array(aiModelSchema),
  rateLimit: z.object({
    requestsPerMinute: z.number().positive(),
    tokensPerMinute: z.number().positive()
  })
});

export const safetyConfigSchema = z.object({
  contentFiltering: z.object({
    enabled: z.boolean(),
    levels: z.object({
      hate: z.enum(['low', 'medium', 'high']),
      violence: z.enum(['low', 'medium', 'high']),
      sexual: z.enum(['low', 'medium', 'high'])
    })
  }),
  topicBlocking: z.object({
    enabled: z.boolean(),
    blockedTopics: z.array(z.string())
  }),
  outputValidation: z.object({
    enabled: z.boolean(),
    maxTokens: z.number().positive(),
    stopSequences: z.array(z.string()),
    allowedFormats: z.array(z.string()).optional()
  })
});

export const cacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().positive(),
  maxSize: z.number().positive(),
  strategy: z.enum(['lru', 'fifo'])
});

export const aiSettingsSchema = z.object({
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
  repetitionPenalty: z.number().min(0).max(2),
  stopSequences: z.array(z.string()),
  maxTokens: z.number().positive()
});

export const aiConfigSchema = z.object({
  defaultProvider: providerTypeSchema,
  providers: z.array(providerConfigSchema),
  defaultSettings: aiSettingsSchema,
  safety: safetyConfigSchema,
  cache: cacheConfigSchema
});

// Response schemas
export const tokenCountSchema = z.object({
  prompt: z.number().nonnegative(),
  completion: z.number().nonnegative(),
  total: z.number().nonnegative()
});

export const aiResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  provider: providerTypeSchema,
  tokenCount: tokenCountSchema,
  cached: z.boolean(),
  duration: z.number().nonnegative(),
  cost: z.number().nonnegative()
});

export const streamingAIResponseSchema = aiResponseSchema.extend({
  isComplete: z.boolean(),
  chunks: z.array(z.string())
});