// src/app/lib/utils/ai-error-utils.ts

import { z } from 'zod';
import {
  AIError,
  AIValidationError,
  handleAIError,
  isRetryableError
} from '../../core/errors/AIError';

// Validation helper that throws AIValidationError
export const validateAIInput = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AIValidationError('Invalid input data', {
        errors: error.errors,
        data
      });
    }
    throw error;
  }
};

// Retry helper for AI operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!isRetryableError(error)) {
        throw handleAIError(error);
      }

      if (attempt === maxRetries - 1) {
        break;
      }

      // If it's a rate limit error with retryAfter, use that
      if (error instanceof AIError && error.context && 'retryAfter' in error.context) {
        delay = error.context.retryAfter * 1000;
      } else {
        delay *= 2; // Exponential backoff
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Example usage with your model manager
export const createSafeModelManager = (modelManager: any) => ({
  async generateResponse(prompt: string, options = {}) {
    // Validate input
    const validatedPrompt = validateAIInput(
      z.string().min(1).max(4000),
      prompt
    );

    // Retry with backoff
    return await withRetry(async () => {
      try {
        return await modelManager.generateResponse(validatedPrompt, options);
      } catch (error) {
        throw handleAIError(error);
      }
    });
  }
});