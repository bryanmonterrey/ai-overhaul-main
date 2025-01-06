// src/app/lib/errors/TwitterErrors.ts

export class TwitterError extends Error {
    constructor(message: string, public code?: string, public status?: number) {
      super(message);
      this.name = 'TwitterError';
    }
  }
  
  export class TwitterRateLimitError extends TwitterError {
    constructor(resetTime: Date) {
      super('Rate limit exceeded', 'RATE_LIMIT', 429);
      this.resetTime = resetTime;
    }
    readonly resetTime: Date;
  }
  
  export class TwitterAuthError extends TwitterError {
    constructor(message = 'Authentication failed') {
      super(message, 'AUTH_ERROR', 401);
    }
  }
  
  export class TwitterNetworkError extends TwitterError {
    constructor(message = 'Network request failed') {
      super(message, 'NETWORK_ERROR', 500);
    }
  }
  
  export class TwitterDataError extends TwitterError {
    constructor(message: string) {
      super(message, 'DATA_ERROR', 400);
    }
  }