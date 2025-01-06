// lib/middleware/rate-limiter.ts
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

// Default auth rate limiter
export const authRateLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(100, "15 m"), // 100 requests per 15 minutes
  analytics: true,
});

// Token validation rate limiter
export const tokenValidationRateLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 requests per minute
  analytics: true,
  prefix: "ratelimit:token_validation"
});

// Session initialization rate limiter
export const sessionInitRateLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "60 s"), // 3 requests per minute
  analytics: true,
  prefix: "ratelimit:session_init"
});

// Helper function to get the appropriate rate limiter
export const getRateLimiter = (type: 'auth' | 'tokenValidation' | 'sessionInit') => {
  switch (type) {
    case 'tokenValidation':
      return tokenValidationRateLimiter;
    case 'sessionInit':
      return sessionInitRateLimiter;
    default:
      return authRateLimiter;
  }
};