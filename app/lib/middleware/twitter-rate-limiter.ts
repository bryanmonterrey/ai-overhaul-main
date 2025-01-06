import { RateLimiter } from '../../lib/utils/ai';

// Create separate limiters for different endpoints
const DEFAULT_RATE_LIMIT = {
  points: 300,  // requests per 15 minutes
  duration: 15 * 60 * 1000  // 15 minutes in milliseconds
};

const ENDPOINTS = {
  tweets: new RateLimiter(180, 15 * 60 * 1000),  // 180 requests per 15 minutes
  user: new RateLimiter(100, 15 * 60 * 1000),   // 100 requests per 15 minutes
  search: new RateLimiter(450, 15 * 60 * 1000), // 450 requests per 15 minutes
  targets: new RateLimiter(300, 15 * 60 * 1000),
  targets_add: new RateLimiter(100, 15 * 60 * 1000),
  targets_delete: new RateLimiter(100, 15 * 60 * 1000),
  targets_update: new RateLimiter(100, 15 * 60 * 1000),
  queue: new RateLimiter(300, 15 * 60 * 1000),
  queue_update: new RateLimiter(200, 15 * 60 * 1000),
  auto_queue: new RateLimiter(100, 15 * 60 * 1000),
  auto_queue_status: new RateLimiter(100, 15 * 60 * 1000),
  generate_tweets: new RateLimiter(50, 15 * 60 * 1000),
  post_tweet: new RateLimiter(200, 15 * 60 * 1000),
  monitoring: new RateLimiter(300, 15 * 60 * 1000),
  monitoring_status: new RateLimiter(300, 15 * 60 * 1000),
  analytics: new RateLimiter(300, 15 * 60 * 1000),
  replies: new RateLimiter(150, 15 * 60 * 1000),
  training: new RateLimiter(100, 15 * 60 * 1000),
  training_add: new RateLimiter(100, 15 * 60 * 1000),
  get_status: new RateLimiter(300, 15 * 60 * 1000),
  default: new RateLimiter(
    DEFAULT_RATE_LIMIT.points, 
    DEFAULT_RATE_LIMIT.duration
  )
} as const;

class RateLimitError extends Error {
  code: number;
  endpoint?: string;
  
  constructor(endpoint?: string) {
    super('Twitter API rate limit exceeded. Please try again later.');
    this.code = 429;
    this.endpoint = endpoint;
  }
}

export async function checkTwitterRateLimit(endpoint: keyof typeof ENDPOINTS = 'default') {
  const limiter = ENDPOINTS[endpoint] || ENDPOINTS.default;
  const canProceed = await limiter.checkLimit(`twitter:${endpoint}`, 1);
  
  if (!canProceed) {
    throw new RateLimitError(endpoint);
  }
  
  return true;
}