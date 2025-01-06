// src/app/core/errors/AIError.ts

export class AIError extends Error {
    code: string;
    statusCode: number;
    retryable: boolean;
    context?: Record<string, any>;

    constructor(
      message: string,
      code: string = 'AI_ERROR',
      statusCode: number = 500,
      retryable: boolean = false,
      context?: Record<string, any>
    ) {
      super(message);
      this.name = 'AIError';
      this.code = code;
      this.statusCode = statusCode;
      this.retryable = retryable;
      this.context = context;
    }
  }
  
  export class AIValidationError extends AIError {
    constructor(message: string, context?: Record<string, any>) {
      super(message, 'VALIDATION_ERROR', 400, false, context);
      this.name = 'AIValidationError';
    }
  }
  
  export class AIRateLimitError extends AIError {
    retryAfter: number;

    constructor(message: string, retryAfter: number) {
      super(
        message,
        'RATE_LIMIT_ERROR',
        429,
        true,
        { retryAfter }
      );
      this.name = 'AIRateLimitError';
      this.retryAfter = retryAfter;
    }
  }
  
  export class AIModelError extends AIError {
    constructor(message: string, context?: Record<string, any>) {
      super(message, 'MODEL_ERROR', 503, true, context);
      this.name = 'AIModelError';
    }
  }
  
  export class AITimeoutError extends AIError {
    constructor(message: string, context?: Record<string, any>) {
      super(message, 'TIMEOUT_ERROR', 408, true, context);
      this.name = 'AITimeoutError';
    }
  }
  
  export class AIAuthenticationError extends AIError {
    constructor(message: string, context?: Record<string, any>) {
      super(message, 'AUTH_ERROR', 401, false, context);
      this.name = 'AIAuthenticationError';
    }
  }
  
  // Error handler utility
  export const handleAIError = (error: unknown): AIError => {
    if (error instanceof AIError) {
      return error;
    }
  
    if (error instanceof Error) {
      // Handle API-specific errors (example for OpenAI)
      if ('status' in error && typeof (error as any).status === 'number') {
        const status = (error as any).status;
        switch (status) {
          case 429:
            return new AIRateLimitError('Rate limit exceeded', 30);
          case 401:
            return new AIAuthenticationError('Authentication failed');
          case 503:
            return new AIModelError('Model temporarily unavailable');
          default:
            return new AIError(error.message, 'UNKNOWN_ERROR', status);
        }
      }
      return new AIError(error.message, 'UNKNOWN_ERROR');
    }
  
    return new AIError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      500
    );
  };
  
  // Type guard to check if an error is retryable
  export const isRetryableError = (error: unknown): error is AIError => {
    return error instanceof AIError && error.retryable;
  };