import { TwitterApi } from 'twitter-api-v2';
import type { TwitterClient, TwitterData, TwitterResponse, TwitterTimelineResponse } from '../core/twitter/types';
import type { TTweetv2Expansion } from 'twitter-api-v2';

const RATE_LIMITS: Record<string, { WINDOW: number; LIMIT: number; MIN_DELAY: number }> = {
  '/2/tweets': {
      WINDOW: 24 * 60 * 60 * 1000,  // 24 hours
      LIMIT: 100,  // 100 tweets per day per user
      MIN_DELAY: 60 * 1000
  },
  '/2/users/:id/tweets': {
      WINDOW: 15 * 60 * 1000,
      LIMIT: 10,  // 5 requests per 15 min per user
      MIN_DELAY: 45 * 1000
  },
  '/2/users/:id/mentions': {
      WINDOW: 15 * 60 * 1000,
      LIMIT: 10,  // 5 requests per 15 min per user  
      MIN_DELAY: 45 * 1000
  },
  '/2/users/me': {
      WINDOW: 24 * 60 * 60 * 1000,
      LIMIT: 250,  // 250 requests per 24 hours
      MIN_DELAY: 5 * 1000
  },
  '/2/users/by/username/:username': {
      WINDOW: 24 * 60 * 60 * 1000,
      LIMIT: 100,  // 100 per 24 hours
      MIN_DELAY: 5 * 1000
  }
} as const;

const ENDPOINTS = {
   TWEETS: '/2/tweets',
   USER_TIMELINE: '/2/users/:id/tweets',
   USER_MENTIONS: '/2/users/:id/mentions',
   USER_ME: '/2/users/me',
   USER_BY_USERNAME: '/2/users/by/username/:username',
   TWEET_COUNTS: '/2/tweets/counts/recent',
   TWEET_SEARCH: '/2/tweets/search/recent',
   TWEET_LOOKUP: '/2/tweets/:id',
   USER_LOOKUP: '/2/users/:id'
} as const;

export class TwitterApiClient extends TwitterApi {
   private client: TwitterApi;
   private endpointRateLimits: Map<string, {
       limit: number;
       remaining: number;
       reset: number;
       lastRequest?: number;
       window: number;
       minDelay: number;
   }> = new Map();
   private userIdCache: Map<string, string> = new Map();
   private userIdCacheExpiry: Map<string, number> = new Map();
   private requestQueue: Map<string, Promise<any>[]> = new Map();
   private readonly MAX_CONCURRENT_REQUESTS = 2;
   private readonly USER_ID_CACHE_DURATION = 24 * 60 * 60 * 1000;

   constructor(private credentials: {
       apiKey: string;
       apiSecret: string;
       accessToken: string;
       accessSecret: string;
   }) {
       super({
           appKey: credentials.apiKey,
           appSecret: credentials.apiSecret,
           accessToken: credentials.accessToken,
           accessSecret: credentials.accessSecret,
       });
       
       // Initialize rate limits after super()
       Object.values(ENDPOINTS).forEach(endpoint => {
           this.endpointRateLimits.set(endpoint, {
               limit: RATE_LIMITS[endpoint]?.LIMIT || 15,
               remaining: RATE_LIMITS[endpoint]?.LIMIT || 15,
               reset: Date.now() + (RATE_LIMITS[endpoint]?.WINDOW || 15 * 60 * 1000),
               window: RATE_LIMITS[endpoint]?.WINDOW || 15 * 60 * 1000,
               minDelay: RATE_LIMITS[endpoint]?.MIN_DELAY || 30 * 1000
           });
       });
   }

   private async enforceMinDelay(endpoint: string): Promise<void> {
       const rateLimit = this.endpointRateLimits.get(endpoint);
       const defaultMinDelay = RATE_LIMITS[endpoint]?.MIN_DELAY || 30 * 1000;
       
       if (!rateLimit?.lastRequest) return Promise.resolve();

       const timeSinceLastRequest = Date.now() - rateLimit.lastRequest;
       if (timeSinceLastRequest < defaultMinDelay) {
           const delayNeeded = defaultMinDelay - timeSinceLastRequest;
           const jitter = Math.random() * 5000;
           return new Promise(resolve => setTimeout(resolve, delayNeeded + jitter));
       }
       return Promise.resolve();
   }

   private async queueRequest(endpoint: string, requestFn: () => Promise<any>): Promise<any> {
       const queue = this.requestQueue.get(endpoint) || [];
       
       if (queue.length >= this.MAX_CONCURRENT_REQUESTS) {
           const queuePromise = new Promise((resolve) => {
               setInterval(() => {
                   if (queue.length < this.MAX_CONCURRENT_REQUESTS) {
                       resolve(null);
                   }
               }, 1000);
           });
           await queuePromise;
       }

       const request = requestFn();
       queue.push(request);
       this.requestQueue.set(endpoint, queue);

       try {
           return await request;
       } finally {
           const index = queue.indexOf(request);
           if (index > -1) {
               queue.splice(index, 1);
           }
           this.requestQueue.set(endpoint, queue);
       }
   }

   private async checkRateLimit(endpoint: string): Promise<void> {
       const rateLimit = this.endpointRateLimits.get(endpoint);
       if (!rateLimit) return;

       const remainingThreshold = Math.ceil(rateLimit.limit * 0.2);

       if (endpoint === ENDPOINTS.TWEETS) {
           if (rateLimit.remaining === 0) {
               const now = Date.now();
               if (rateLimit.reset > now) {
                   console.log(`Tweet rate limit stats for ${endpoint}:`, {
                       remaining: rateLimit.remaining,
                       limit: rateLimit.limit,
                       resetTime: new Date(rateLimit.reset).toISOString()
                   });
                   await new Promise(resolve => setTimeout(resolve, rateLimit.reset - now));
               }
           }
       } else {
           if (rateLimit.remaining <= remainingThreshold) {
               const now = Date.now();
               if (rateLimit.reset > now) {
                   const window = RATE_LIMITS[endpoint]?.WINDOW || 15 * 60 * 1000;
                   const waitTime = Math.min(rateLimit.reset - now + 1000, window);
                   console.log(`Rate limit pause for ${endpoint}:`, {
                       waitTimeMs: waitTime,
                       remaining: rateLimit.remaining,
                       threshold: remainingThreshold,
                       resetTime: new Date(rateLimit.reset).toISOString()
                   });
                   await new Promise(resolve => setTimeout(resolve, waitTime));
               }
           }
       }
   }

   private updateRateLimit(endpoint: string, rateLimit: any) {
       const currentLimit = this.endpointRateLimits.get(endpoint);
       if (!currentLimit) return;

       const currentTime = Date.now();
       const limits = RATE_LIMITS[endpoint] || {
           WINDOW: 15 * 60 * 1000,
           LIMIT: 15,
           MIN_DELAY: 30 * 1000
       };

       console.log('Raw rate limit data:', {
           endpoint,
           rateLimit,
           currentLimit
       });

       let newRemaining: number;
       if (rateLimit?.remaining !== undefined) {
           newRemaining = rateLimit.remaining;
       } else {
           newRemaining = Math.max(0, currentLimit.remaining - 1);
       }

       const newReset = rateLimit?.reset 
           ? new Date(rateLimit.reset * 1000)
           : new Date(currentLimit.reset);

       const newLimits = {
           ...currentLimit,
           limit: rateLimit?.limit || currentLimit.limit,
           remaining: newRemaining,
           reset: newReset.getTime(),
           lastRequest: currentTime
       };

       this.endpointRateLimits.set(endpoint, newLimits);

       console.log(`Rate limit updated for ${endpoint}:`, {
           limit: newLimits.limit,
           remaining: newLimits.remaining,
           resetTime: new Date(newLimits.reset).toISOString(),
           source: rateLimit?.remaining !== undefined ? 'Twitter API' : 'Local tracking',
           lastRequest: new Date(newLimits.lastRequest).toISOString()
       });
   }

   private async handleRateLimit(error: any, endpoint: string) {
       try {
           console.log('Rate limit error details:', { endpoint, error });

           let resetTime: Date;
           if (error.rateLimit?.reset) {
               resetTime = new Date(error.rateLimit.reset * 1000);
           } else {
               const window = RATE_LIMITS[endpoint]?.WINDOW || 15 * 60 * 1000;
               resetTime = new Date(Date.now() + window);
           }

           const maxWindow = RATE_LIMITS[endpoint]?.WINDOW || 15 * 60 * 1000;
           const maxResetTime = new Date(Date.now() + maxWindow);
           
           if (resetTime > maxResetTime) {
               console.warn('Reset time too far in future, using default window');
               resetTime = maxResetTime;
           }

           const waitTime = Math.max(0, resetTime.getTime() - Date.now()) + 2000;
           console.log(`Rate limit hit for ${endpoint}:`, {
               resetTime: resetTime.toISOString(),
               waitTimeSeconds: Math.round(waitTime / 1000)
           });

           await new Promise(resolve => setTimeout(resolve, waitTime));
       } catch (e) {
           console.error('Error handling rate limit:', e);
           await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
       }
   }

   private async getUserIdByUsername(username: string): Promise<string> {
       const cachedId = this.userIdCache.get(username);
       const cacheExpiry = this.userIdCacheExpiry.get(username);
       if (cachedId && cacheExpiry && Date.now() < cacheExpiry) {
           return cachedId;
       }

       try {
           await this.enforceMinDelay(ENDPOINTS.USER_BY_USERNAME);
           await this.checkRateLimit(ENDPOINTS.USER_BY_USERNAME);
           
           const user = await this.client.v2.userByUsername(username);
           this.updateRateLimit(ENDPOINTS.USER_BY_USERNAME, user.rateLimit);

           if (!user.data) {
               throw new Error(`User not found: ${username}`);
           }
           
           this.userIdCache.set(username, user.data.id);
           this.userIdCacheExpiry.set(username, Date.now() + this.USER_ID_CACHE_DURATION);
           
           return user.data.id;
       } catch (error: any) {
           if (error.code === 429) {
               await this.handleRateLimit(error, ENDPOINTS.USER_BY_USERNAME);
               return this.getUserIdByUsername(username);
           }
           throw error;
       }
   }

   async tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse> {
       try {
           await this.enforceMinDelay(ENDPOINTS.TWEETS);
           await this.checkRateLimit(ENDPOINTS.TWEETS);

           console.log('Posting tweet:', { content, options });

           let tweet;
           try {
               if (options?.reply) {
                   tweet = await this.client.v2.tweet({
                       text: content,
                       reply: {
                           in_reply_to_tweet_id: options.reply.in_reply_to_tweet_id
                       }
                   });
               } else {
                   tweet = await this.client.v2.tweet(content);
               }
               
               this.updateRateLimit(ENDPOINTS.TWEETS, tweet.rateLimit);
               
               console.log('Tweet posted successfully:', {
                   id: tweet.data.id,
                   text: tweet.data.text,
                   isReply: !!options?.reply
               });

               return tweet;
           } catch (error: any) {
               if (error.code === 429) {
                   await this.handleRateLimit(error, ENDPOINTS.TWEETS);
                   return this.tweet(content, options);
               }
               throw error;
           }
       } catch (error: any) {
           console.error('Error posting tweet:', error);
           throw error;
       }
   }

   async userTimeline(options?: { 
       user_id?: string;
       max_results?: number;
       exclude?: Array<'retweets' | 'replies'>;
       'tweet.fields'?: string[];
       'user.fields'?: string[];
       expansions?: string[];
   }): Promise<TwitterTimelineResponse> {
       return this.queueRequest(
           ENDPOINTS.USER_TIMELINE,
           async () => {
               await this.enforceMinDelay(ENDPOINTS.USER_TIMELINE);
               await this.checkRateLimit(ENDPOINTS.USER_TIMELINE);

               let userId = options?.user_id;
               if (!userId) {
                   userId = await this.getCurrentUserId();
               }

               const timeline = await this.client.v2.userTimeline(userId, options);
               this.updateRateLimit(ENDPOINTS.USER_TIMELINE, timeline.rateLimit);
               
               return timeline;
           }
       );
   }

   async userMentionTimeline(options?: {
       max_results?: number;
       'tweet.fields'?: string[];
       'user.fields'?: string[];
       expansions?: string[];
   }): Promise<TwitterTimelineResponse> {
       return this.queueRequest(
           ENDPOINTS.USER_MENTIONS,
           async () => {
               await this.enforceMinDelay(ENDPOINTS.USER_MENTIONS);
               await this.checkRateLimit(ENDPOINTS.USER_MENTIONS);

               const userId = await this.getCurrentUserId();
               const mentions = await this.client.v2.userMentionTimeline(userId, options);
               this.updateRateLimit(ENDPOINTS.USER_MENTIONS, mentions.rateLimit);
               
               return mentions;
           }
       );
   }

   private async getCurrentUserId(): Promise<string> {
       try {
           await this.enforceMinDelay(ENDPOINTS.USER_ME);
           await this.checkRateLimit(ENDPOINTS.USER_ME);
           
           const me = await this.client.v2.me();
           this.updateRateLimit(ENDPOINTS.USER_ME, me.rateLimit);
           return me.data.id;
       } catch (error: any) {
           if (error.code === 429) {
               await this.handleRateLimit(error, ENDPOINTS.USER_ME);
               return this.getCurrentUserId();
           }
           throw error;
       }
   }

   public getRateLimitStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [endpoint, limit] of this.endpointRateLimits.entries()) {
        status[endpoint] = {
            remaining: limit.remaining,
            resetIn: Math.round((limit.reset - Date.now()) / 1000) + ' seconds',
            lastRequest: limit.lastRequest ? new Date(limit.lastRequest).toISOString() : 'never',
            minDelay: limit.minDelay / 1000 + ' seconds'
        };
    }
    return status;
}

async getUser(userId: string): Promise<any> {
    return this.queueRequest(
        ENDPOINTS.USER_LOOKUP,
        async () => {
            await this.enforceMinDelay(ENDPOINTS.USER_LOOKUP);
            await this.checkRateLimit(ENDPOINTS.USER_LOOKUP);

            const user = await this.client.v2.user(userId);
            this.updateRateLimit(ENDPOINTS.USER_LOOKUP, user.rateLimit);
            
            return user;
        }
    );
}

async getUserByUsername(username: string): Promise<any> {
    return this.queueRequest(
        ENDPOINTS.USER_BY_USERNAME,
        async () => {
            await this.enforceMinDelay(ENDPOINTS.USER_BY_USERNAME);
            await this.checkRateLimit(ENDPOINTS.USER_BY_USERNAME);

            const user = await this.client.v2.userByUsername(username);
            const rateLimitRemaining = user.headers?.get('x-rate-limit-remaining');
            const rateLimitReset = user.headers?.get('x-rate-limit-reset');
            
            if (rateLimitRemaining && rateLimitReset) {
                this.updateRateLimit(ENDPOINTS.USER_BY_USERNAME, {
                    remaining: parseInt(rateLimitRemaining),
                    reset: parseInt(rateLimitReset) * 1000
                });
            }
            
            return user;
        }
    );
}

async searchTweets(query: string, options?: {
    max_results?: number;
    'tweet.fields'?: string[];
    'user.fields'?: string[];
    expansions?: string[];
}): Promise<any> {
    return this.queueRequest(
        ENDPOINTS.TWEET_SEARCH,
        async () => {
            await this.enforceMinDelay(ENDPOINTS.TWEET_SEARCH);
            await this.checkRateLimit(ENDPOINTS.TWEET_SEARCH);

            const search = await this.client.v2.search(query, options);
            this.updateRateLimit(ENDPOINTS.TWEET_SEARCH, search.rateLimit);
            
            return search;
        }
    );
}

async getTweetCounts(query: string): Promise<any> {
    return this.queueRequest(
        ENDPOINTS.TWEET_COUNTS,
        async () => {
            await this.enforceMinDelay(ENDPOINTS.TWEET_COUNTS);
            await this.checkRateLimit(ENDPOINTS.TWEET_COUNTS);

            const counts = await this.client.v2.tweetCountRecent(query);
            this.updateRateLimit(ENDPOINTS.TWEET_COUNTS, counts.rateLimit);
            
            return counts;
        }
    );
}

async getTweet(tweetId: string, options?: {
    'tweet.fields'?: string[];
    'user.fields'?: string[];
    expansions?: string[];
}): Promise<any> {
    return this.queueRequest(
        ENDPOINTS.TWEET_LOOKUP,
        async () => {
            await this.enforceMinDelay(ENDPOINTS.TWEET_LOOKUP);
            await this.checkRateLimit(ENDPOINTS.TWEET_LOOKUP);

            const tweet = await this.client.v2.tweet(tweetId, options);
            this.updateRateLimit(ENDPOINTS.TWEET_LOOKUP, tweet.rateLimit);
            
            return tweet;
        }
    );
}
}

let twitterClientInstance: TwitterApiClient | null = null;

export function getTwitterClient(): TwitterApiClient {
 if (!twitterClientInstance) {
     if (!process.env.TWITTER_API_KEY ||
         !process.env.TWITTER_API_SECRET ||
         !process.env.TWITTER_ACCESS_TOKEN ||
         !process.env.TWITTER_ACCESS_TOKEN_SECRET
     ) {
         console.error('Twitter API credentials missing');
         throw new Error('Twitter API credentials not configured');
     }

     const credentials = {
         apiKey: process.env.TWITTER_API_KEY,
         apiSecret: process.env.TWITTER_API_SECRET,
         accessToken: process.env.TWITTER_ACCESS_TOKEN,
         accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
     };

     try {
         twitterClientInstance = new TwitterApiClient(credentials);
         console.log('Twitter client initialized successfully');
     } catch (error) {
         console.error('Failed to initialize Twitter client:', error);
         throw error;
     }
 }
 return twitterClientInstance;
}

export function resetTwitterClient(): void {
 twitterClientInstance = null;
}