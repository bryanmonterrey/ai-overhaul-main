// src/app/lib/twitter.ts

import { TwitterApi, TweetV2, UserV2, TweetV2PostTweetResult } from 'twitter-api-v2';
import { createClient } from '@supabase/supabase-js';
import { EnvironmentalFactors } from '.././core/types';
import {
  TwitterMetrics,
  TweetMetrics,
  CachedTweet,
  TwitterStatus,
  ScheduledTweet,
  TweetThread,
  TweetSearchResult
} from './types/twitter';
import { TwitterAuthError, TwitterRateLimitError, TwitterNetworkError, TwitterDataError, TwitterError } from '.././lib/errors/TwitterErrors';
import type { EngagementTargetRow } from '.././types/supabase';
import { PersonalitySystem } from '.././core/personality/PersonalitySystem';
import { Context, TweetStyle } from '.././core/personality/types';
import { TwitterTrainingService } from '.././lib/services/twitter-training';

interface QueuedTweet {
  id: string;
  content: string; 
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export class TwitterManager {
  private client: TwitterApi;
  private supabase;
  private recentTweets: Map<string, CachedTweet> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private personality: PersonalitySystem;
  private trainingService: any;
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private nextTweetTimeout?: NodeJS.Timeout;
  private is24HourMode = false;
  private hourlyEngagementWeights: Record<number, number> = {};
  private lastTweetTime: Date | null = null;

  constructor() {
    const requiredEnvVars = [
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET'
    ];

    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            throw new Error(`${varName} is not defined`);
        }
    });

    this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    });

    this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.trainingService = new TwitterTrainingService();
    this.personality = new PersonalitySystem({
        baseTemperature: 0.7,
        creativityBias: 0.5,
        emotionalVolatility: 0.3,
        memoryRetention: 0.8,
        responsePatterns: {
            neutral: [],
            excited: [],
            contemplative: [],
            chaotic: [],
            creative: [],
            analytical: []
        },
        platform: 'twitter'
    });

    this.loadRecentTweets();
}

async monitorTargetTweets(target: EngagementTargetRow): Promise<void> {
  try {
      const timelineResponse = await this.client.userTimeline({
          user_id: target.username, 
          max_results: 10, 
          exclude: ['retweets', 'replies']
      });
      
      const timeline = timelineResponse.data.data;
      const lastCheck = target.last_interaction ? new Date(target.last_interaction) : new Date(0);

      console.log(`Monitoring tweets for ${target.username}`, {
          tweetsFound: timeline?.length,
          lastCheck: lastCheck.toISOString()
      });

      for (const tweet of (timeline || [])) {
          const tweetDate = new Date(tweet.created_at || '');
          if (tweetDate > lastCheck && await this.shouldReplyToTweet(tweet, target)) {
              await this.generateAndSendReply(tweet, target);
              
              // Update last interaction time
              await this.supabase
                  .from('engagement_targets')
                  .update({ last_interaction: new Date().toISOString() })
                  .eq('id', target.id);
          }
      }
  } catch (error) {
      console.error(`Error monitoring tweets for ${target.username}:`, error);
  }
}

private shouldReplyToTweet(tweet: any, target: EngagementTargetRow): boolean {
  // Reply based on probability alone
  return Math.random() < target.reply_probability;
}

  private async generateAndSendReply(tweet: TweetV2, target: EngagementTargetRow): Promise<void> {
    try {
        const context = {
            platform: 'twitter' as const,
            environmentalFactors: {
                timeOfDay: this.getTimeOfDay(),
                platformActivity: 0.5,
                socialContext: [target.relationship_level],
                platform: 'twitter'
            },
            style: target.preferred_style as TweetStyle,
            additionalContext: {
                replyingTo: target.username,
                originalTweet: tweet.text,
                topics: target.topics,
                relationship: target.relationship_level
            },
            trainingExamples: await this.trainingService.getTrainingExamples(3, 'replies')
        };

        const reply = await this.personality.processInput(
            `Generate a reply to: ${tweet.text}`,
            context as unknown as Partial<Context>
        );

        if (reply) {
            await this.client.v2.tweet(reply, {
                reply: { in_reply_to_tweet_id: tweet.id }
            });
            console.log(`Reply sent to ${target.username}:`, reply);
        }
    } catch (error) {
        console.error(`Error generating reply for ${target.username}:`, error);
    }
}

private async handleMention(mention: any): Promise<void> {
  const lastCheck = await this.getLastInteractionTime();
  const mentionTime = new Date(mention.created_at);

  if (mentionTime > lastCheck) {
      const context = {
          type: 'mention',
          content: mention.text,
          user: mention.author_id
      };

      const reply = await this.generateReply(context);
      if (reply) {
          await this.client.v2.tweet(reply, {
              reply: { in_reply_to_tweet_id: mention.id }
          });
      }
  }
}

private async handleReply(tweet: any): Promise<void> {
  const lastCheck = await this.getLastInteractionTime();
  const replyTime = new Date(tweet.created_at);

  if (replyTime > lastCheck) {
      const context = {
          platform: 'twitter' as const,
          environmentalFactors: {
              timeOfDay: this.getTimeOfDay(),
              platformActivity: 0.5,
              socialContext: ['casual'],
              platform: 'twitter'
          },
          style: 'casual' as TweetStyle,
          additionalContext: JSON.stringify({
              originalTweet: tweet.text,
              replyingTo: tweet.author_id
          })
      };

      const reply = await this.personality.processInput(
          `Generate a reply to: ${tweet.text}`,
          context
      );

      if (reply) {
          await this.postTweet(reply, tweet.id);
      }
  }
}

private async generateReply(context: any): Promise<string | null> {
  try {
      const reply = await this.personality.processInput(
          `Generate a reply to: ${context.content}`,
          {
              platform: 'twitter',
              additionalContext: JSON.stringify({
                  originalTweet: context.content,
                  replyingTo: context.user
              })
          }
      );
      return reply;
  } catch (error) {
      console.error('Error generating reply:', error);
      return null;
  }
}

  // Add these methods to your TwitterManager class
  public startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
        try {
            // Monitor engagement targets
            const { data: targets } = await this.supabase
                .from('engagement_targets')
                .select('*');
                
            if (targets) {
                for (const target of targets) {
                    await this.monitorTargetTweets(target);
                }
            }

            // Monitor mentions and replies to own tweets
            const [mentions, replies] = await Promise.all([
                this.client.v2.userMentionTimeline(process.env.TWITTER_USER_ID!),
                this.client.v2.userTimeline(process.env.TWITTER_USER_ID!)
            ]);

            // Handle mentions
            for (const mention of mentions.data.data || []) {
                await this.handleMention(mention);
            }

            // Handle replies to own tweets
            for (const tweet of replies.data.data || []) {
                await this.handleReply(tweet);
            }

        } catch (error) {
            console.error('Error in monitoring cycle:', error);
        }
    }, 2 * 60 * 1000); // Check every 2 minutes
}



public stopMonitoring(): void {
    if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
    }
}

private getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

private async syncQueueWithDatabase(): Promise<void> {
  try {
      const tweets = await this.getQueuedTweets();
      this.queuedTweets = tweets;
  } catch (error) {
      console.error('Error syncing queue:', error);
  }
}

public async getQueuedTweets(): Promise<QueuedTweet[]> {
  const { count, error: countError } = await this.supabase
      .from('tweet_queue')
      .select('*', { count: 'exact', head: true });

  if (countError) return [];

  const { data, error } = await this.supabase
      .from('tweet_queue')
      .select('*')
      .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(tweet => ({
      id: tweet.id,
      content: tweet.content,
      style: tweet.style,
      status: tweet.status,
      generatedAt: new Date(tweet.generated_at),
      scheduledFor: tweet.scheduled_for ? new Date(tweet.scheduled_for) : undefined
  }));
}

public async addTweetsToQueue(tweets: Omit<QueuedTweet, 'id'>[]): Promise<void> {
  const { error } = await this.supabase
      .from('tweet_queue')
      .insert(
          tweets.map(tweet => ({
              content: tweet.content,
              style: tweet.style,
              status: tweet.status,
              generated_at: tweet.generatedAt.toISOString(),
              scheduled_for: tweet.scheduledFor?.toISOString()
          }))
      );

  if (error) throw error;
}

private async scheduleNextTweet(): Promise<void> {
  if (!this.isAutoMode) return;

  await this.syncQueueWithDatabase();

  const approvedTweets = this.queuedTweets
      .filter(t => t.status === 'approved')
      .sort((a, b) => {
          const timeA = a.scheduledFor?.getTime() || Infinity;
          const timeB = b.scheduledFor?.getTime() || Infinity;
          return timeA - timeB;
      });

  if (approvedTweets.length === 0) return;

  const nextTweet = approvedTweets[0];
  if (!nextTweet.scheduledFor) return;

  const now = new Date().getTime();
  const scheduledTime = nextTweet.scheduledFor.getTime();
  const delay = Math.max(0, scheduledTime - now);

  if (this.nextTweetTimeout) clearTimeout(this.nextTweetTimeout);

  this.nextTweetTimeout = setTimeout(async () => {
      try {
          await this.postTweet(nextTweet.content);
          await this.supabase
              .from('tweet_queue')
              .delete()
              .eq('id', nextTweet.id);
          
          this.queuedTweets = this.queuedTweets
              .filter(t => t.id !== nextTweet.id);
          
          this.scheduleNextTweet();
      } catch (error) {
          console.error('Failed to post tweet:', error);
          setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
      }
  }, delay);
}

public toggle24HourMode(enabled: boolean) {
  this.is24HourMode = enabled;
  if (enabled) {
      this.schedule24Hours().catch(console.error);
  }
}

private async schedule24Hours() {
  const tweets = await this.getQueuedTweets();
  const pendingTweets = tweets.filter(t => t.status === 'pending');
  const interval = (24 * 60 * 60 * 1000) / (pendingTweets.length || 1);
  
  const baseTime = new Date();
  for (let i = 0; i < pendingTweets.length; i++) {
      const scheduledTime = new Date(baseTime.getTime() + (interval * i));
      await this.updateTweetStatus(pendingTweets[i].id, 'approved', scheduledTime);
  }
}

private async trackEngagement() {
  try {
      const timeline = await this.client.v2.userTimeline(process.env.TWITTER_USER_ID!, {
          max_results: 100,
          "tweet.fields": ["public_metrics", "created_at"]
      });
      const tweets = timeline.data.data || [];
      const engagementData = tweets.map((tweet: {
          created_at?: string;
          public_metrics?: {
              like_count: number;
              retweet_count: number;
              reply_count: number;
          }
      }) => ({
          hour: new Date(tweet.created_at || '').getHours(),
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0
      }));
      this.updateEngagementPatterns(engagementData);
  } catch (error) {
      console.error('Error tracking engagement:', error);
  }
}

private updateEngagementPatterns(engagementData: Array<{
  hour: number;
  likes: number;
  retweets: number;
  replies: number;
}>) {
  const hourlyEngagement = engagementData.reduce((acc, data) => {
      if (!acc[data.hour]) {
          acc[data.hour] = {
              totalEngagement: 0,
              count: 0
          };
      }
      const engagement = data.likes + data.retweets + data.replies;
      acc[data.hour].totalEngagement += engagement;
      acc[data.hour].count++;
      return acc;
  }, {} as Record<number, { totalEngagement: number; count: number }>);

  this.hourlyEngagementWeights = Object.entries(hourlyEngagement).reduce((acc, [hour, data]) => {
      acc[parseInt(hour)] = data.totalEngagement / data.count;
      return acc;
  }, {} as Record<number, number>);
}


private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries === 0) throw this.handleTwitterError(error);
      
      if (error.code === 429) {  // Rate limit
        const resetTime = new Date(error.reset * 1000);
        throw new TwitterRateLimitError(resetTime);
      }
  
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryOperation(operation, retries - 1, delay * 2);
    }
  }
  
  private handleTwitterError(error: any): Error {
    // Rate limit handling
    if (error.code === 429) {
      return new TwitterRateLimitError(new Date(error.reset * 1000));
    }
  
    // Auth errors
    if (error.code === 401 || error.code === 403) {
      return new TwitterAuthError(error.message);
    }
  
    // Network errors
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      return new TwitterNetworkError(error.message);
    }
  
    // Data validation errors
    if (error.code === 400) {
      return new TwitterDataError(error.message);
    }
  
    // Log unknown errors
    console.error('Unexpected Twitter error:', error);
    return new TwitterError('An unexpected error occurred', 'UNKNOWN', 500);
  }
  
  // Example usage in a method:
  async postTweet(content: string, replyToId?: string): Promise<TweetV2> {
    // Validate content length
    if (content.length > 280) {
      throw new TwitterDataError('Tweet exceeds maximum length');
    }
  
    return this.retryOperation(async () => {
      try {
        const tweetData = replyToId 
          ? { text: content, reply: { in_reply_to_tweet_id: replyToId } }
          : { text: content };
  
        const tweet = await this.client.v2.tweet(tweetData);
        this.lastTweetTime = new Date();
  
        // Add missing property to match TweetV2 type
        const tweetWithEditHistory = {
          ...tweet.data,
          edit_history_tweet_ids: [tweet.data.id]
        };
  
        // Store in Supabase
        await this.supabase
          .from('tweets')
          .insert({
            tweet_id: tweetWithEditHistory.id,
            content: content,
            reply_to: replyToId,
            timestamp: new Date().toISOString()
          })
          .then(result => {
            if (result.error) {
              console.error('Supabase storage error:', result.error);
            }
          });
  
        this.recentTweets.set(tweetWithEditHistory.id, {
          content,
          timestamp: new Date(),
          engagement: { likes: 0, retweets: 0, replies: 0 }
        });
  
        return tweetWithEditHistory;
      } catch (error) {
        throw this.handleTwitterError(error);
      }
    });
  }

  private async loadRecentTweets(): Promise<void> {
    try {
      const timeline = await this.client.v2.userTimeline(
        process.env.TWITTER_USER_ID!,
        {
          max_results: 100,
          "tweet.fields": ["public_metrics", "created_at"]
        }
      );

      for (const tweet of timeline.data.data) {
        this.recentTweets.set(tweet.id, {
          content: tweet.text,
          timestamp: new Date(tweet.created_at!),
          engagement: {
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0
          }
        });
      }
    } catch (error) {
      console.error('Error loading recent tweets:', error);
    }
  }

  public async toggleAutoMode(enabled: boolean): Promise<void> {
    this.isAutoMode = enabled;
    if (enabled) {
        await this.scheduleNextTweet();
    } else if (this.nextTweetTimeout) {
        clearTimeout(this.nextTweetTimeout);
    }
}
 
 public async generateTweetBatch(count: number = 10): Promise<void> {
    const newTweets: Omit<QueuedTweet, 'id'>[] = [];
    
    for (let i = 0; i < count; i++) {
        const style = this.personality.getCurrentTweetStyle();
        const content = await this.personality.processInput(
            'Generate a tweet', 
            { platform: 'twitter', style }
        );
 
        newTweets.push({
            content: this.cleanTweet(content),
            style,
            status: 'pending',
            generatedAt: new Date()
        });
    }
 
    await this.addTweetsToQueue(newTweets);
 }
 
 public getNextScheduledTime(): Date | null {
    const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
    if (approvedTweets.length === 0) return null;
    
    const nextTweet = approvedTweets[0];
    return nextTweet.scheduledFor || null;
 }
 
 private async persistScheduledTweet(tweetId: string, scheduledTime: Date): Promise<void> {
    const { error } = await this.supabase
        .from('tweet_queue')
        .update({
            scheduled_for: scheduledTime.toISOString()
        })
        .eq('id', tweetId);
 
    if (error) throw error;
 }
 
 private getOptimalTweetTime(): Date {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 23 || hour < 6) {
        now.setHours(7, 0, 0, 0);
        if (hour >= 23) now.setDate(now.getDate() + 1);
    }
    
    return now;
 }
 
 public clearRejectedTweets(): void {
    this.queuedTweets = this.queuedTweets.filter(t => t.status !== 'rejected');
 }
 
 public getTweetStats() {
    return {
        recentTweets: this.recentTweets.size,
        queuedTweets: this.queuedTweets.length,
        approvedTweets: this.queuedTweets.filter(t => t.status === 'approved').length,
        lastTweetTime: this.lastTweetTime
    };
 }

  async getEnvironmentalFactors(): Promise<Partial<EnvironmentalFactors>> {
    try {
      const [timeline, mentions] = await Promise.all([
        this.client.v2.userTimeline(process.env.TWITTER_USER_ID!, {
          max_results: 100,
          "tweet.fields": ["public_metrics", "created_at"]
        }),
        this.client.v2.userMentionTimeline(process.env.TWITTER_USER_ID!)
      ]);

      const platformActivity = this.calculateActivity(timeline.data.data, mentions.data.data);
      const trends = await this.getTrends();
      const { sentiment, momentum } = this.analyzeEngagement(timeline.data.data);

      return {
        platformActivity,
        socialContext: this.extractTopics(timeline.data.data),
        marketConditions: {
          sentiment,
          volatility: this.calculateVolatility(timeline.data.data),
          momentum,
          trends
        }
      };
    } catch (error) {
      console.error('Error getting Twitter environment:', error);
      return {};
    }
  }

  private async getTrends(): Promise<string[]> {
    try {
      // Get trends for worldwide (id: 1) or specify another location
      const { data } = await this.client.v2.get('trends/place.json?id=1');
      return data[0].trends
        .slice(0, 5)
        .map((trend: { name: string }) => trend.name);
    } catch (error) {
      console.error('Error getting trends:', error);
      return [];
    }
  }

  private calculateActivity(timeline: TweetV2[], mentions: TweetV2[]): number {
    const recentTime = Date.now() - 3600000;
    const recentInteractions = [...timeline, ...mentions]
      .filter(t => new Date(t.created_at!).getTime() > recentTime);
    
    return Math.min(1, recentInteractions.length / 20);
  }

  private analyzeEngagement(tweets: TweetV2[]): { sentiment: number; momentum: number } {
    const engagements = tweets.map(tweet => ({
      total: (tweet.public_metrics?.like_count || 0) + 
             (tweet.public_metrics?.retweet_count || 0) * 2 + 
             (tweet.public_metrics?.reply_count || 0) * 3,
      timestamp: new Date(tweet.created_at!).getTime()
    }));

    const averageEngagement = engagements.reduce((acc, curr) => acc + curr.total, 0) / engagements.length;
    const recentEngagement = engagements
      .filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((acc, curr) => acc + curr.total, 0) / engagements.length;

    return {
      sentiment: Math.min(1, recentEngagement / averageEngagement),
      momentum: (recentEngagement - averageEngagement) / averageEngagement
    };
  }

  private calculateVolatility(tweets: TweetV2[]): number {
    const engagements = tweets
      .map(t => t.public_metrics?.like_count || 0)
      .slice(0, 20);
    
    if (engagements.length < 2) return 0;

    const diffs = engagements
      .slice(1)
      .map((e, i) => Math.abs(e - engagements[i]));
    
    return Math.min(1, diffs.reduce((a, b) => a + b, 0) / (engagements.length * 100));
  }

  private extractTopics(tweets: TweetV2[]): string[] {
    const text = tweets.map(t => t.text).join(' ');
    const words = text.toLowerCase().split(' ');
    const wordFreq = new Map<string, number>();
    
    words.forEach(word => {
      if (word.length > 4 && !word.startsWith('@') && !word.startsWith('http')) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  async getStatus(): Promise<TwitterStatus> {
    try {
      const user = await this.client.v2.me();
      const userDetails = await this.client.v2.user(user.data.id, {
        "user.fields": ["public_metrics", "created_at"]
      });

      const recentTweets = Array.from(this.recentTweets.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      const averageEngagement = recentTweets.reduce((acc, tweet) => {
        return acc + tweet.engagement.likes + 
               tweet.engagement.retweets * 2 + 
               tweet.engagement.replies * 3;
      }, 0) / recentTweets.length;

      return {
        account: {
          username: user.data.username,
          followers: userDetails.data.public_metrics?.followers_count || 0,
          following: userDetails.data.public_metrics?.following_count || 0,
          tweetsCount: userDetails.data.public_metrics?.tweet_count || 0
        },
        activity: {
          recentTweetsCount: this.recentTweets.size,
          averageEngagement,
          lastTweetTime: recentTweets[0]?.timestamp || null
        },
        limits: await this.getRateLimits()
      };
    } catch (error) {
      console.error('Error getting Twitter status:', error);
      throw error;
    }
  }

  private async getRateLimits() {
    try {
      const response = await this.client.v2.get('application/rate_limit_status.json');
      return {
        tweets: response.resources?.tweets,
        users: response.resources?.users
      };
    } catch (error) {
      console.error('Error getting rate limits:', error);
      return null;
    }
  }

  async createThread(tweets: string[]): Promise<TweetV2[]> {
    try {
      let previousTweetId: string | undefined;
      const threadTweets: TweetV2[] = [];

      for (const tweetContent of tweets) {
        const tweet = await this.postTweet(tweetContent, previousTweetId);
        threadTweets.push(tweet);
        previousTweetId = tweet.id;
      }

      await this.supabase
        .from('tweet_threads')
        .insert({
          thread_id: threadTweets[0].id,
          tweets: threadTweets.map(t => t.id),
          timestamp: new Date().toISOString()
        });

      return threadTweets;
    } catch (error) {
      console.error('Error creating thread:', error);
      throw error;
    }
  }

  async searchRelevantTweets(query: string, limit: number = 100): Promise<TweetSearchResult[]> {
    try {
      const results = await this.client.v2.search(query, {
        max_results: limit,
        "tweet.fields": ["public_metrics", "created_at", "context_annotations"]
      });

      return results.data.data.map(tweet => ({
        id: tweet.id,
        content: tweet.text,
        metrics: tweet.public_metrics || {},
        created_at: tweet.created_at,
        context: tweet.context_annotations
      }));
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async scheduleTweet(content: string, scheduledTime: Date): Promise<boolean> {
    try {
      await this.supabase
        .from('scheduled_tweets')
        .insert({
          content,
          scheduled_time: scheduledTime.toISOString(),
          status: 'pending'
        });

      return true;
    } catch (error) {
      console.error('Error scheduling tweet:', error);
      throw error;
    }
  }

  private getEngagementBasedDelay(): number {
    if (this.is24HourMode) return 0;
    
    const minDelay = 15 * 60 * 1000;  // 15 minutes
    const maxDelay = 30 * 60 * 1000;  // 30 minutes
    const baseDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    const hour = new Date().getHours();
    const weight = this.hourlyEngagementWeights[hour] || 0.5;
    return Math.floor(baseDelay * (1 + (1 - weight)));
 }
 
 private async persistAutoMode(enabled: boolean): Promise<void> {
    const { error } = await this.supabase
        .from('system_settings')
        .upsert({ 
            key: 'twitter_auto_mode',
            value: enabled,
            updated_at: new Date().toISOString()
        });
 
    if (error) throw error;
    this.isAutoMode = enabled;
 }
 
 private cleanTweet(tweet: string): string {
    return tweet
        .replace(/\[(\w+)_state\]$/, '')
        .trim();
 }
 
 public async updateTweetStatus(
    id: string, 
    status: 'approved' | 'rejected',
    scheduledTime?: Date
 ): Promise<void> {
    await this.syncQueueWithDatabase();
    
    const delay = this.getEngagementBasedDelay();
    const finalScheduledTime = status === 'approved' 
        ? (scheduledTime || new Date(Date.now() + delay))
        : null;
 
    const { error } = await this.supabase
        .from('tweet_queue')
        .update({ 
            status,
            scheduled_for: finalScheduledTime?.toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id);
 
    if (error) throw error;
 
    this.queuedTweets = this.queuedTweets.map(tweet => 
        tweet.id === id 
            ? {...tweet, status, scheduledFor: finalScheduledTime || undefined}
            : tweet
    );
 
    if (status === 'approved') {
        await this.persistAutoMode(true);
        await this.scheduleNextTweet();
    }
 }
  

  async processScheduledTweets(): Promise<number> {
    try {
      const { data: scheduledTweets, error } = await this.supabase
        .from('scheduled_tweets')
        .select('*')
        .eq('status', 'pending')
        .lt('scheduled_time', new Date().toISOString());

      if (error) throw error;

      for (const tweet of scheduledTweets) {
        await this.postTweet(tweet.content);
        
        await this.supabase
          .from('scheduled_tweets')
          .update({ status: 'completed' })
          .eq('id', tweet.id);
      }

      return scheduledTweets.length;
    } catch (error) {
      console.error('Error processing scheduled tweets:', error);
      throw error;
    }
  }

  private async getLastInteractionTime(): Promise<Date> {
    const { data } = await this.supabase
      .from('last_interaction')
      .select('timestamp')
      .single();
    
    return data ? new Date(data.timestamp) : new Date(0);
  }
}

export default TwitterManager;