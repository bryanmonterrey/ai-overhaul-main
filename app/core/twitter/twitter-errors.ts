export class TwitterError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    Object.setPrototypeOf(this, TwitterError.prototype);
    this.name = 'TwitterError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class TwitterRateLimitError extends TwitterError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT', 429);
    Object.setPrototypeOf(this, TwitterRateLimitError.prototype);
    this.name = 'TwitterRateLimitError';
  }
}

export class TwitterAuthError extends TwitterError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    Object.setPrototypeOf(this, TwitterAuthError.prototype);
    this.name = 'TwitterAuthError';
  }
}

export class TwitterNetworkError extends TwitterError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 503);
    Object.setPrototypeOf(this, TwitterNetworkError.prototype);
    this.name = 'TwitterNetworkError';
  }
}

export class TwitterDataError extends TwitterError {
  constructor(message: string) {
    super(message, 'DATA_ERROR', 400);
    Object.setPrototypeOf(this, TwitterDataError.prototype);
    this.name = 'TwitterDataError';
  }
} 