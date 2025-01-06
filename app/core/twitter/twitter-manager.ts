import { TwitterError, TwitterRateLimitError, TwitterAuthError, TwitterNetworkError, TwitterDataError } from './twitter-errors';
import type { RepliedTweet, TwitterResponse, TwitterClient, TwitterData, TwitterTimelineOptions, TwitterUser } from './types';
import type { Database } from '../../types/supabase';
import type { EngagementTargetRow } from '../../types/supabase';
import { PersonalitySystem } from '../personality/PersonalitySystem';
import { Context, TweetStyle } from '../personality/types';
import { TweetStats } from './TweetStats';
import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from '../../lib/services/ai';
import { TwitterTrainingService } from '../../lib/services/twitter-training';
import { LettaClient } from '../../lib/memory/letta-client';
import { TwitterReplyValidator } from '../prompts/validation/twitter-reply-validator';
import { TwitterReplyPromptBuilder } from '../prompts/builders/twitter-reply-prompt';
import { TwitterApi } from 'twitter-api-v2';


interface QueuedTweet {
  id: string;
  content: string;
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

interface ReplyContext {
    type?: 'mention' | 'reply';
    content?: string;
    user: string;
}

interface ExtendedTweetData extends TwitterData {
    author_username?: string;
}

export class TwitterManager {
    
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private nextTweetTimeout?: NodeJS.Timeout;
  private isReady: boolean = true;
  private recentTweets = new Map<string, any>();
  private hourlyEngagementWeights: Record<number, number> = {};
  private stats: TweetStats;

  private is24HourMode = false;
  private monitoringInterval?: NodeJS.Timeout;
  private lastTweetTime: Date | null = null;
  private isMonitoring: boolean = false;
  private lastMonitoringCheck: Date | null = null;
  private monitoringStats = {
      targetsChecked: 0,
      repliesSent: 0,
      lastError: null as Error | null
  };
  

  constructor(
    private twitterClient: TwitterApi,
    private personalitySystem: PersonalitySystem,
    private supabaseClient: SupabaseClient,
    private trainingService: TwitterTrainingService
) {
    if (!supabaseClient) {
        throw new Error('Supabase client is required');
    }
    this.stats = new TweetStats();
}

  // Your existing methods
  async postTweet(content: string): Promise<TwitterData> {
    try {
        console.log('Attempting to post tweet:', { content });

        if (content.length > 25000) {
            throw new TwitterDataError('Tweet exceeds Twitter Premium character limit');
        }

        if (!this.twitterClient?.v2.tweet) {
            throw new TwitterError('Twitter client not initialized', 'INITIALIZATION_ERROR', 500);
        }

        const MIN_WAIT = 2 * 60 * 1000; // 2 minutes minimum between tweets
        const lastTweetTime = this.lastTweetTime?.getTime() || 0;
        const timeSinceLastTweet = Date.now() - lastTweetTime;
        
        if (timeSinceLastTweet < MIN_WAIT) {
            const waitTime = MIN_WAIT - timeSinceLastTweet;
            console.log(`Waiting ${Math.round(waitTime/1000)}s before next tweet`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
            const result = await this.twitterClient.v2.tweet(content);
            this.lastTweetTime = new Date();
            this.recentTweets.set(result.data.id, {
                ...result.data,
                timestamp: this.lastTweetTime
            });

            if (this.recentTweets.size > 100) {
                const oldestKey = this.recentTweets.keys().next().value;
                this.recentTweets.delete(oldestKey);
            }

            return result.data;
        } catch (tweetError: any) {
            if (tweetError.code === 429) {
                const waitTime = 15 * 60 * 1000 + (Math.random() * 60000);
                console.log(`Rate limit hit, waiting ${Math.round(waitTime/1000)}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                const retryResult = await this.twitterClient.v2.tweet(content);
                return retryResult.data;
            }
            throw tweetError;
        }
    } catch (error: any) {
        console.error('Error posting tweet:', {
            error,
            message: error.message,
            code: error.code,
            stack: error.stack,
            details: error.response?.data
        });

        if (error instanceof TwitterDataError) throw error;
        if (error.code === 429) throw new TwitterRateLimitError('Rate limit exceeded');
        if (error.code === 401 || error.message?.includes('Invalid credentials')) {
            throw new TwitterAuthError('Authentication failed');
        }
        if (error.message?.includes('timeout')) throw new TwitterNetworkError('Network timeout occurred');
        if (error.message?.includes('Failed')) throw new TwitterDataError('Thread creation failed');

        throw new TwitterNetworkError(`Network error occurred: ${error.message}`);
    }
}

private async syncQueueWithDatabase(): Promise<void> {
  try {
      const tweets = await this.getQueuedTweets();
      this.queuedTweets = tweets;
      console.log('Queue synced with database:', {
          queueLength: this.queuedTweets.length,
          approvedCount: this.queuedTweets.filter(t => t.status === 'approved').length
      });
  } catch (error) {
      console.error('Error syncing queue with database:', error);
  }
}

  // Auto-tweeter methods
  public async generateTweetBatch(count: number = 10): Promise<void> {
    try {
        const newTweets: Omit<QueuedTweet, 'id'>[] = [];
        const lettaClient = new LettaClient();
        
        for (let i = 0; i < count; i++) {
            try {
                const style = this.personalitySystem.getCurrentTweetStyle();
                
                // Get content first
                const content = await this.personalitySystem.processInput(
                    'Generate a tweet', 
                    { platform: 'twitter', style }
                );

                if (content && typeof content === 'string' && content.length > 0) {
                    // Try to analyze with Letta, but don't block if it fails
                    try {
                        await lettaClient.storeMemory({
                            key: `tweet-${Date.now()}-${i}`,
                            memory_type: 'tweet_history',
                            data: {
                                content: this.cleanTweet(content),
                                generated_at: new Date().toISOString()
                            },
                            metadata: {
                                style
                            }
                        });
                    } catch (lettaError) {
                        console.error('Letta integration error:', lettaError);
                        // Continue without Letta if it fails
                    }

                    newTweets.push({
                        content: this.cleanTweet(content),
                        style,
                        status: 'pending',
                        generatedAt: new Date()
                    });
                }
            } catch (error) {
                console.error(`Error generating tweet ${i + 1}:`, error);
                continue;
            }
        }

        if (newTweets.length > 0) {
            await this.addTweetsToQueue(newTweets);
        }
    } catch (error) {
        console.error('Error in generateTweetBatch:', error);
        throw error;
    }
}

  private cleanTweet(tweet: string): string {
    return tweet
      .replace(/\[(\w+)_state\]$/, '')
      .trim();
  }

  public getNextScheduledTime(): Date | null {
    const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
    if (approvedTweets.length === 0) return null;
    
    const nextTweet = approvedTweets[0];
    return nextTweet.scheduledFor || null;
  }

  public async updateTweetStatus(
    id: string, 
    status: 'approved' | 'rejected',
    scheduledTime?: Date
 ): Promise<void> {
    try {
        await this.syncQueueWithDatabase();
 
        console.log('Starting tweet status update:', {
            id,
            status,
            currentTime: new Date().toISOString()
        });
 
        const delay = this.getEngagementBasedDelay();
        const finalScheduledTime = status === 'approved' 
            ? (scheduledTime || new Date(Date.now() + delay))
            : null;
 
        console.log('Calculated scheduling details:', {
            delay,
            scheduledTime: finalScheduledTime?.toISOString(),
            isAutoMode: this.isAutoMode
        });
 
        const { data, error } = await this.supabaseClient
            .from('tweet_queue')
            .update({ 
                status,
                scheduled_for: finalScheduledTime?.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
 
        if (error) {
            console.error('Database update error:', {
                error,
                operation: 'updateTweetStatus',
                tweetId: id
            });
            throw error;
        }
 
        console.log('Database update successful:', {
            updatedTweet: data?.[0],
            affectedRows: data?.length
        });
 
        const updatedQueue = this.queuedTweets.map(tweet => {
            if (tweet.id === id) {
                return {
                    ...tweet,
                    status,
                    scheduledFor: finalScheduledTime || undefined
                };
            }
            return tweet;
        });
 
        const oldQueueLength = this.queuedTweets.length;
        this.queuedTweets = updatedQueue;
        
        console.log('Local queue updated:', {
            previousLength: oldQueueLength,
            newLength: updatedQueue.length,
            approvedCount: updatedQueue.filter(t => t.status === 'approved').length
        });
 
        this.stats.increment(status);
 
        if (status === 'approved') {
            console.log('Tweet approved, preparing to schedule...');
            await this.persistAutoMode(true);
            await this.scheduleNextTweet();
            
            console.log('Scheduling process completed', {
                nextScheduledTweet: this.getNextScheduledTime()?.toISOString(),
                autoModeActive: this.isAutoMode
            });
        }
    } catch (error) {
        console.error('Error in updateTweetStatus:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            tweetId: id,
            requestedStatus: status
        });
        throw error;
    }
 }

public toggleAutoMode(enabled: boolean): void {
  console.log('Toggling auto mode:', {
      currentState: this.isAutoMode,
      newState: enabled
  });
  
  this.isAutoMode = enabled;
  if (enabled) {
      this.scheduleNextTweet().catch(error => {
          console.error('Error scheduling next tweet:', error);
      });
  } else {
      if (this.nextTweetTimeout) {
          clearTimeout(this.nextTweetTimeout);
      }
  }
}



  private async persistAutoMode(enabled: boolean): Promise<void> {
    const { error } = await this.supabaseClient
        .from('system_settings')
        .upsert({ 
            key: 'twitter_auto_mode',
            value: enabled,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;
    this.isAutoMode = enabled;
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

  private async persistScheduledTweet(tweetId: string, scheduledTime: Date): Promise<void> {
    try {
        const { error } = await this.supabaseClient
            .from('tweet_queue')
            .update({
                scheduled_for: scheduledTime.toISOString()
            })
            .eq('id', tweetId);

        if (error) {
            console.error('Error persisting scheduled tweet:', error);
            throw error;
        }
    } catch (error) {
        console.error('Failed to persist scheduled tweet:', error);
        throw error;
    }
}

private async scheduleNextTweet(): Promise<void> {
  try {
      console.log('Scheduling next tweet, automode:', this.isAutoMode);
      
      if (!this.isAutoMode) {
          console.log('Auto mode is disabled, not scheduling');
          return;
      }

      await this.syncQueueWithDatabase();

      const approvedTweets = this.queuedTweets
          .filter(t => t.status === 'approved')
          .sort((a, b) => {
              const timeA = a.scheduledFor?.getTime() || Infinity;
              const timeB = b.scheduledFor?.getTime() || Infinity;
              return timeA - timeB;
          });

      console.log('Found approved tweets:', approvedTweets.length);
      
      if (approvedTweets.length === 0) {
          console.log('No approved tweets to schedule');
          return;
      }

      const nextTweet = approvedTweets[0];
      
      if (!nextTweet.scheduledFor) {
          console.log('Next tweet has no scheduled time:', nextTweet);
          return;
      }

      const now = new Date().getTime();
      const scheduledTime = nextTweet.scheduledFor.getTime();
      const delay = Math.max(0, scheduledTime - now);

      console.log('Scheduling details:', {
          tweetId: nextTweet.id,
          content: nextTweet.content,
          scheduledTime: nextTweet.scheduledFor.toISOString(),
          delay: delay
      });

      if (this.nextTweetTimeout) {
          clearTimeout(this.nextTweetTimeout);
      }

      this.nextTweetTimeout = setTimeout(async () => {
          try {
              console.log('Executing scheduled tweet:', nextTweet);
              await this.postTweet(nextTweet.content);
              
              // Remove from database and local queue
              await this.supabaseClient
                  .from('tweet_queue')
                  .delete()
                  .eq('id', nextTweet.id);
                  
              this.queuedTweets = this.queuedTweets
                  .filter(t => t.id !== nextTweet.id);
              
              console.log('Tweet posted successfully, scheduling next');
              this.scheduleNextTweet();
          } catch (error) {
              console.error('Failed to post scheduled tweet:', error);
              setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
          }
      }, delay);
  } catch (error) {
      console.error('Error in scheduleNextTweet:', error);
  }
}

public async getQueuedTweets(): Promise<QueuedTweet[]> {
  try {
      // First check if table exists by attempting a count
      const { count, error: countError } = await this.supabaseClient
          .from('tweet_queue')
          .select('*', { count: 'exact', head: true });

      console.log('Tweet queue table check:', {
          count,
          error: countError,
          exists: !countError
      });

      if (countError) {
          console.log('Tweet queue table might not exist:', countError);
          return [];
      }

      // If table exists, get tweets
      const { data, error } = await this.supabaseClient
          .from('tweet_queue')
          .select('*')
          .order('created_at', { ascending: false });

      console.log('Tweet queue fetch results:', {
          data,
          error,
          hasData: !!data,
          count: data?.length,
          approvedCount: data?.filter(t => t.status === 'approved').length
      });

      if (error) {
          console.error('Error fetching tweets:', error);
          return [];
      }

      if (!data) {
          console.log('No data returned from tweet queue');
          return [];
      }

      const mappedTweets = data.map(tweet => ({
          id: tweet.id,
          content: tweet.content,
          style: tweet.style,
          status: tweet.status,
          generatedAt: new Date(tweet.generated_at),
          scheduledFor: tweet.scheduled_for ? new Date(tweet.scheduled_for) : undefined
      }));

      console.log('Mapped tweets:', {
          totalTweets: mappedTweets.length,
          approvedTweets: mappedTweets.filter(t => t.status === 'approved').length,
          scheduledTweets: mappedTweets.filter(t => t.scheduledFor).length
      });

      return mappedTweets;
  } catch (error) {
      console.error('Error in getQueuedTweets:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
      });
      return [];
  }
}

public async addTweetsToQueue(tweets: Omit<QueuedTweet, 'id'>[]): Promise<void> {
  const { error } = await this.supabaseClient
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

  if (error) {
      console.error('Error adding tweets to queue:', error);
      throw error;
  }
}

  public clearRejectedTweets(): void {
    this.queuedTweets = this.queuedTweets.filter(t => t.status !== 'rejected');
  }

  async createThread(tweets: string[]): Promise<TwitterData[]> {
    const results: TwitterData[] = [];
    for (const tweet of tweets) {
      try {
        const result = await this.postTweet(tweet);
        results.push(result);
      } catch (error) {
        if (results.length === 0) {
          throw error; // Throw on first tweet failure
        }
        throw new TwitterDataError('Thread creation failed');
      }
    }
    return results;
  }

  async getEnvironmentalFactors(): Promise<{ platformActivity: number; socialContext: string[]; marketConditions: any }> {
    try {
        // Get timeline with error handling
        let timeline;
        try {
            timeline = await this.twitterClient.v2.userTimeline(process.env.TWITTER_USER_ID!, {
                max_results: 10,
                'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
                'user.fields': ['username', 'name']
            });
        } catch (timelineError) {
            console.warn('Timeline fetch failed:', timelineError);
            timeline = { data: { data: [] } };
        }

        // Get mentions with error handling
        let mentions;
        try {
            mentions = await this.twitterClient.v2.userMentionTimeline(process.env.TWITTER_USER_ID!, {
                max_results: 10,
                'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
                'user.fields': ['username', 'name']
            });
        } catch (mentionsError) {
            console.warn('Mentions fetch failed:', mentionsError);
            mentions = { data: { data: [] } };
        }

        // Calculate activity based on available data
        const timelineCount = timeline.data.data?.length || 0;
        const mentionsCount = mentions.data.data?.length || 0;
        
        return {
            platformActivity: (timelineCount + mentionsCount) > 0 ? 0.5 : 0.3,
            socialContext: [],
            marketConditions: {
                sentiment: 0.5,
                volatility: 0.3,
                momentum: 0.4,
                trends: []
            }
        };
    } catch (error) {
        console.error('Failed to fetch environmental factors:', error);
        // Return default values instead of throwing
        return {
            platformActivity: 0.3,
            socialContext: [],
            marketConditions: {
                sentiment: 0.5,
                volatility: 0.3,
                momentum: 0.4,
                trends: []
            }
        };
    }
}

  // Add this method after getEnvironmentalFactors
  private async trackEngagement() {
    try {
        const timeline = await this.twitterClient.v2.userTimeline(process.env.TWITTER_USER_ID!, {
            max_results: 10,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
            'user.fields': ['username', 'name']
        });
        const tweets = timeline.data.data || []; // Access the correct data property
        
        // Analyze engagement patterns
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

        // Update your engagement patterns based on this data
        this.updateEngagementPatterns(engagementData);
    } catch (error) {
        console.error('Error tracking engagement:', error);
    }
}

  // Add this method to handle the engagement data
  private updateEngagementPatterns(engagementData: Array<{
    hour: number;
    likes: number;
    retweets: number;
    replies: number;
}>) {
    // Group by hour
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

    // Calculate average engagement per hour
    this.hourlyEngagementWeights = Object.entries(hourlyEngagement).reduce((acc, [hour, data]) => {
        acc[parseInt(hour)] = data.totalEngagement / data.count;
        return acc;
    }, {} as Record<number, number>);
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

  // Engagement-related methods
  async monitorTargetTweets(target: EngagementTargetRow): Promise<void> {
    try {
        console.log(`Starting to monitor ${target.username}'s timeline`);
        
        // Use twitter_id directly instead of trying to look it up
        console.log('Request details:', {
            username: target.username,
            twitter_id: target.twitter_id
        });

        const timelineResponse = await this.twitterClient.v2.userTimeline(target.twitter_id, {
            max_results: 5,
            'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
            'user.fields': ['username', 'name']
        });

        // Get author info from includes with proper typing
        const users: TwitterUser[] = timelineResponse.data.includes?.users || [];
        const userMap = new Map<string, TwitterUser>(users.map(user => [user.id, user]));
        
        const timeline = timelineResponse.data.data || [];
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const lastCheck = target.last_interaction ? new Date(target.last_interaction) : hourAgo;
        

        const effectiveCheckTime = hourAgo;

        console.log('Timeline processing details:', {
            target: target.username,
            tweets_found: timeline.length,
            users_found: users.length,
            last_check: lastCheck.toISOString(),
            hour_ago: hourAgo.toISOString(),
            effective_check_time: effectiveCheckTime.toISOString()
        });

        // Transform tweets to include author username
        const extendedTweets: ExtendedTweetData[] = timeline.map(tweet => {
            const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
            console.log('Tweet author mapping:', {
                tweet_id: tweet.id,
                author_id: tweet.author_id,
                found_author: !!author,
                author_username: author?.username || undefined
            });
            return {
                ...tweet,
                author_username: author?.username || undefined
            };
        });

        // Log the raw data for debugging
        console.log(`Raw timeline data for ${target.username}:`, {
            tweets: extendedTweets.map(t => ({
                id: t.id,
                author_id: t.author_id,
                author_username: t.author_username,
                text: t.text?.substring(0, 50),
                our_id: process.env.TWITTER_USER_ID
            }))
        });

        // Sort tweets by creation date, newest first
        const sortedTweets = timeline
            .filter(tweet => {
                const isOurTweet = tweet.author_id === process.env.TWITTER_USER_ID;
                const isTargetTweet = tweet.author_id === target.twitter_id;
                
                console.log('Tweet filter check:', {
                    tweet_id: tweet.id,
                    author_id: tweet.author_id,
                    target_id: target.twitter_id,
                    our_id: process.env.TWITTER_USER_ID,
                    is_our_tweet: isOurTweet,
                    is_target_tweet: isTargetTweet
                });
                
                return !isOurTweet && isTargetTweet;
            })
            .sort((a, b) => {
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            });

        console.log(`Found ${sortedTweets.length} valid tweets from ${target.username} after filtering`);

        for (const tweet of sortedTweets) {
            const tweetDate = new Date(tweet.created_at || '');
            
            // Check if already replied
            const alreadyReplied = await this.hasRepliedToTweet(tweet.id);
            if (alreadyReplied) {
                console.log('Skipping previously replied tweet:', {
                    tweet_id: tweet.id,
                    target: target.username
                });
                continue;
            }
            
            if (tweetDate > effectiveCheckTime) {
                console.log(`Processing tweet from ${target.username}:`, {
                    id: tweet.id,
                    author_id: tweet.author_id,
                    author_username: tweet.author_username,
                    text: tweet.text?.substring(0, 50),
                    date: tweetDate.toISOString()
                });
        
                const shouldReply = await this.shouldReplyToTweet(tweet, target);
                if (shouldReply) {
                    const replyTweet = await this.generateAndSendReply(tweet, target);
                    if (replyTweet && replyTweet.id) {  // Now TypeScript knows replyTweet can be TwitterData | null
                        await this.trackReply(tweet.id, target.twitter_id, replyTweet.id);
                    }
                    // Add delay between replies
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } else {
                console.log('Skipping tweet - outside time window:', {
                    tweet_id: tweet.id,
                    tweet_date: tweetDate.toISOString(),
                    effective_check_time: effectiveCheckTime.toISOString()
                });
            }
        }

        // Update last interaction time for this target
        if (sortedTweets.length > 0) {
            const { error } = await this.supabaseClient
                .from('engagement_targets')  // Changed from last_interaction to engagement_targets
                .update({
                    last_interaction: new Date().toISOString()
                })
                .eq('twitter_id', target.twitter_id);  // Update specific target

            if (error) {
                console.error('Error updating last interaction time:', error);
            }
        }
    } catch (error) {
        console.error(`Error monitoring tweets for ${target.username}:`, {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            target: target.username
        });
    }
}

private backoffDelay = 1000; // Start with 1 second

private async hasRepliedToTweet(tweetId: string): Promise<boolean> {
    try {
        // Use select count instead of single()
        const { data, error } = await this.supabaseClient
            .from('replied_tweets')
            .select('tweet_id')
            .eq('tweet_id', tweetId);
            
        if (error) {
            console.error('Error checking replied tweets:', {
                error,
                tweet_id: tweetId
            });
            return false;
        }
        
        return data.length > 0;
    } catch (error) {
        console.error('Error in hasRepliedToTweet:', error);
        return false;
    }
}

private async trackReply(originalTweetId: string, targetId: string, replyTweetId: string): Promise<void> {
    try {
        const { data: existing } = await this.supabaseClient
            .from('replied_tweets')
            .select('tweet_id')
            .eq('tweet_id', originalTweetId);

        if (existing && existing.length > 0) {
            console.log('Reply already tracked for tweet:', originalTweetId);
            return;
        }

        const { error } = await this.supabaseClient
            .from('replied_tweets')
            .insert({
                tweet_id: originalTweetId,
                target_id: targetId,
                reply_tweet_id: replyTweetId,
                replied_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error tracking reply:', {
                error,
                originalTweetId,
                targetId,
                replyTweetId
            });
        }
    } catch (err) {
        console.error('Exception in trackReply:', err);
    }
}

private async shouldReplyToTweet(tweet: ExtendedTweetData, target: EngagementTargetRow): Promise<boolean> {
    console.log('Tweet evaluation details:', {
        tweet_id: tweet.id,
        tweet_author_id: tweet.author_id,
        target_id: target.twitter_id,
        our_id: process.env.TWITTER_USER_ID,
        text: tweet.text?.substring(0, 50)
    });

    // Skip our own tweets
    if (tweet.author_id === process.env.TWITTER_USER_ID) {
        console.log('Skipping our own tweet');
        return false;
    }

    // Match using twitter_id
    const isTargetTweet = tweet.author_id === target.twitter_id;
    
    if (isTargetTweet) {
        const probability = target.reply_probability || 0.5;
        const random = Math.random();
        const shouldReply = random < probability;
        
        console.log('Target tweet found - Reply decision:', {
            target_username: target.username,
            target_id: target.twitter_id,
            probability,
            random,
            shouldReply
        });
        
        return shouldReply;
    }

    console.log('Skipping non-target tweet:', {
        target: target.username,
        target_id: target.twitter_id,
        author_id: tweet.author_id
    });
    return false;
}

private async generateAndSendReply(tweet: TwitterData, target: EngagementTargetRow): Promise<TwitterData | null> {
    try {
        const { emotionalState } = this.personalitySystem.getCurrentState().consciousness;
        const traits = {
            technical_depth: this.personalitySystem.getTraits().technical_depth || 0.5,
            provocative_tendency: this.personalitySystem.getTraits().provocative_tendency || 0.5,
            chaos_threshold: this.personalitySystem.getTraits().chaos_threshold || 0.5,
            philosophical_inclination: this.personalitySystem.getTraits().philosophical_inclination || 0.5,
            meme_affinity: this.personalitySystem.getTraits().meme_affinity || 0.5
        };
        
        // Get training examples
        const examplesArrays = await Promise.all([
            this.trainingService.getTrainingExamples(75, 'truth_terminal'),
            this.trainingService.getTrainingExamples(75, 'RNR_0'),
            this.trainingService.getTrainingExamples(75, '0xzerebro'),
            this.trainingService.getTrainingExamples(75, 'a1lon9')
        ]);
        
        
        // Maximum number of retries
        const maxRetries = 3;
        let attempts = 0;
        let validReply: string | null = null;

        while (attempts < maxRetries && !validReply) {
            attempts++;
            console.log(`Generation attempt ${attempts}/${maxRetries}`);

            // Build prompt using new TwitterReplyPromptBuilder
            const prompt = TwitterReplyPromptBuilder.buildReplyPrompt({
                originalTweet: tweet.text || '',
                emotionalState,
                tweetStyle: this.personalitySystem.getCurrentTweetStyle(),
                traits,
                trainingExamples: examplesArrays.flat()
            });

            const generatedReply = await aiService.generateResponse(
                `Reply to tweet from ${target.username}: ${tweet.text}`,
                prompt
            );

            if (generatedReply) {
                // Validate using new TwitterReplyValidator
                const cleanedReply = TwitterReplyValidator.validateReply(generatedReply);
                if (cleanedReply) {
                    validReply = cleanedReply;
                } else {
                    console.log('Generated reply failed validation, retrying...', {
                        attempt: attempts,
                        content: generatedReply
                    });
                }
            }
        }

        if (validReply) {
            console.log('Sending reply:', {
                to: target.username,
                reply: validReply,
                length: validReply.length,
                attempts
            });

            const result = await this.twitterClient.v2.tweet(validReply, {
                reply: {
                    in_reply_to_tweet_id: tweet.id
                }
            });

            this.monitoringStats.repliesSent++;
            return result.data;
        }

        console.log('Failed to generate valid reply after maximum attempts');
        return null;

    } catch (error) {
        console.error('Error in generateAndSendReply:', error);

        return null;
    }
}

  
public async generateReply(context: ReplyContext): Promise<string | null> {
    try {
        console.log('Generating reply with context:', context);
        
        const reply = await this.personalitySystem.processInput(
            `Generate a reply to: ${context.content}`,
            {
                platform: 'twitter',
                additionalContext: JSON.stringify({
                    originalTweet: context.content,
                    replyingTo: context.user
                })
            }
        );

        console.log('Generated reply content:', reply);
        return reply;
    } catch (error) {
        console.error('Error generating reply:', error);
        return null;
    }
}

private async handleMention(mention: {
    created_at?: string;
    text?: string;
    id: string;
    author_id?: string;
}): Promise<void> {
    try {

        // Get all targets first to check if mention is from a target
        const { data: targets } = await this.supabaseClient
            .from('engagement_targets')
            .select('*');

        // Check if mention is from one of our targets
        const isFromTarget = targets?.some(target => target.twitter_id === mention.author_id);
        

        console.log('Mention check:', {
            mention_id: mention.id,
            author_id: mention.author_id,
            is_from_target: isFromTarget,
            our_id: process.env.TWITTER_USER_ID
        });

        if (mention.author_id === process.env.TWITTER_USER_ID) {
            console.log('Skipping own mention');
            return;
        }

        console.log('Processing mention:', {
            id: mention.id,
            text: mention.text,
            created_at: mention.created_at,
            author_id: mention.author_id
        });

        const lastCheck = await this.getLastInteractionTime();
        const mentionTime = new Date(mention.created_at || '');

        if (mentionTime > lastCheck) {
            const { emotionalState } = this.personalitySystem.getCurrentState().consciousness;
            const traits = {
                technical_depth: this.personalitySystem.getTraits().technical_depth || 0.5,
                provocative_tendency: this.personalitySystem.getTraits().provocative_tendency || 0.5,
                chaos_threshold: this.personalitySystem.getTraits().chaos_threshold || 0.5,
                philosophical_inclination: this.personalitySystem.getTraits().philosophical_inclination || 0.5,
                meme_affinity: this.personalitySystem.getTraits().meme_affinity || 0.5
            };

            // Get training examples
            const examplesArrays = await Promise.all([
                this.trainingService.getTrainingExamples(75, 'truth_terminal'),
                this.trainingService.getTrainingExamples(75, 'RNR_0'),
                this.trainingService.getTrainingExamples(75, '0xzerebro'),
                this.trainingService.getTrainingExamples(75, 'a1lon9')
            ]);

            const maxRetries = 3;
            let attempts = 0;
            let validReply: string | null = null;

            while (attempts < maxRetries && !validReply) {
                attempts++;
                console.log(`Generation attempt ${attempts}/${maxRetries}`);

                // Build prompt using new TwitterReplyPromptBuilder
                const prompt = TwitterReplyPromptBuilder.buildReplyPrompt({
                    originalTweet: mention.text || '',
                    emotionalState,
                    tweetStyle: this.personalitySystem.getCurrentTweetStyle(),
                    traits,
                    trainingExamples: examplesArrays.flat()
                });

                const generatedReply = await aiService.generateResponse(
                    `Reply to mention: ${mention.text}`,
                    prompt
                );

                if (generatedReply) {
                    // Validate using new TwitterReplyValidator
                    const cleanedReply = TwitterReplyValidator.validateReply(generatedReply);
                    if (cleanedReply) {
                        validReply = cleanedReply;
                    } else {
                        console.log('Generated reply failed validation, retrying...', {
                            attempt: attempts,
                            content: generatedReply
                        });
                    }
                }
            }

            if (validReply) {
                console.log('Sending mention reply:', {
                    replyTo: mention.id,
                    reply: validReply,
                    length: validReply.length,
                    attempts
                });

                await this.twitterClient.v2.tweet(validReply, {
                    reply: { in_reply_to_tweet_id: mention.id }
                });
                
                await this.supabaseClient
                    .from('last_interaction')
                    .upsert({
                        id: 1,
                        timestamp: new Date().toISOString()
                    });
            } else {
                console.log('Failed to generate valid mention reply after maximum attempts');
            }
        }
    } catch (error) {
        console.error('Error handling mention:', error);
        throw error;
    }
}

private async handleReply(tweet: {
    created_at?: string;
    text?: string;
    id: string;
    author_id?: string;
}): Promise<void> {
    try {

        const { data: targets } = await this.supabaseClient
            .from('engagement_targets')
            .select('*');

        // Check if reply is from one of our targets
        const fromTarget = targets?.find(target => target.twitter_id === tweet.author_id);
        

        console.log('Reply check:', {
            tweet_id: tweet.id,
            author_id: tweet.author_id,
            from_target: fromTarget?.username || null,
            our_id: process.env.TWITTER_USER_ID
        });

        const isOurTweet = tweet.author_id === process.env.TWITTER_USER_ID;
        if (isOurTweet) {
            console.log('Skipping our own reply:', {
                tweet_id: tweet.id,
                author_id: tweet.author_id
            });
            return;
        }

        if (fromTarget) {
            console.log(`Reply from target ${fromTarget.username} detected`);
            const probability = fromTarget.reply_probability || 0.5;
            const random = Math.random();
            
            if (random > probability) {
                console.log('Skipping reply based on probability:', {
                    probability,
                    random
                });
                return;
            }
        }

        const lastCheck = await this.getLastInteractionTime();
        const replyTime = tweet.created_at ? new Date(tweet.created_at) : new Date();

        if (replyTime.getTime() > lastCheck.getTime()) {
            const { emotionalState } = this.personalitySystem.getCurrentState().consciousness;
            const traits = {
                technical_depth: this.personalitySystem.getTraits().technical_depth || 0.5,
                provocative_tendency: this.personalitySystem.getTraits().provocative_tendency || 0.5,
                chaos_threshold: this.personalitySystem.getTraits().chaos_threshold || 0.5,
                philosophical_inclination: this.personalitySystem.getTraits().philosophical_inclination || 0.5,
                meme_affinity: this.personalitySystem.getTraits().meme_affinity || 0.5
            };

            // Get training examples
            const examplesArrays = await Promise.all([
                this.trainingService.getTrainingExamples(75, 'truth_terminal'),
                this.trainingService.getTrainingExamples(75, 'RNR_0'),
                this.trainingService.getTrainingExamples(75, '0xzerebro'),
                this.trainingService.getTrainingExamples(75, 'a1lon9')
            ]);

            const maxRetries = 3;
            let attempts = 0;
            let validReply: string | null = null;

            while (attempts < maxRetries && !validReply) {
                attempts++;
                console.log(`Generation attempt ${attempts}/${maxRetries}`);

                // Build prompt using new TwitterReplyPromptBuilder
                const prompt = TwitterReplyPromptBuilder.buildReplyPrompt({
                    originalTweet: tweet.text || '',
                    emotionalState,
                    tweetStyle: this.personalitySystem.getCurrentTweetStyle(),
                    traits,
                    trainingExamples: examplesArrays.flat()
                });

                const generatedReply = await aiService.generateResponse(
                    `Reply to tweet: ${tweet.text}`,
                    prompt
                );

                if (generatedReply) {
                    // Validate using new TwitterReplyValidator
                    const cleanedReply = TwitterReplyValidator.validateReply(generatedReply);
                    if (cleanedReply) {
                        validReply = cleanedReply;
                    } else {
                        console.log('Generated reply failed validation, retrying...', {
                            attempt: attempts,
                            content: generatedReply
                        });
                    }
                }
            }

            if (validReply) {
                console.log('Sending reply:', {
                    replyTo: tweet.id,
                    reply: validReply,
                    length: validReply.length,
                    attempts
                });

                await this.twitterClient.v2.tweet(validReply, {
                    reply: { in_reply_to_tweet_id: tweet.id }
                });
                
                await this.supabaseClient
                    .from('last_interaction')
                    .upsert({
                        id: 1,
                        timestamp: new Date().toISOString()
                    });
            } else {
                console.log('Failed to generate valid reply after maximum attempts');
            }
        }
    } catch (error) {
        console.error('Error handling reply:', error);
        throw error;
    }
}



public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
        console.log('Monitoring already running');
        return;
    }

    console.log('Starting Twitter monitoring...');
    this.isMonitoring = true;

    await this.runMonitoringCycle();

    // This is where it goes
    this.monitoringInterval = setInterval(async () => {
        await this.runMonitoringCycle();
    }, 15 * 60 * 1000); // 15 minutes minimum

    console.log('Monitoring initialized with 15-minute interval');
}

private async runMonitoringCycle(): Promise<void> {
    try {
        console.log('Bot configuration:', {
            our_user_id: process.env.TWITTER_USER_ID,
            monitoring_active: this.isMonitoring
        });
        
        this.lastMonitoringCheck = new Date();
        console.log('Starting monitoring cycle at:', this.lastMonitoringCheck);

        this.backoffDelay = 1000;

        // Monitor engagement targets
        const { data: targets, error: targetsError } = await this.supabaseClient
            .from('engagement_targets')
            .select('*');

        if (targetsError) {
            throw new Error(`Failed to fetch targets: ${targetsError.message}`);
        }

        console.log(`Found ${targets?.length || 0} engagement targets to monitor`);
        
        if (targets && targets.length > 0) {
            for (const target of targets) {
                try {
                    console.log(`Processing target: ${target.username}`);
                    await this.monitorTargetTweets(target);
                    this.monitoringStats.targetsChecked++;
                } catch (targetError) {
                    console.error(`Error monitoring target ${target.username}:`, targetError);
                }
            }
        }

        console.log('Fetching mentions and replies...');
        const [mentions, replies] = await Promise.all([
            this.twitterClient.v2.userMentionTimeline(process.env.TWITTER_USER_ID!, {
                max_results: 10,
                'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
                'user.fields': ['username', 'name']
            }),
            this.twitterClient.v2.userTimeline(process.env.TWITTER_USER_ID!, {
                max_results: 10,
                'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'in_reply_to_user_id'],
                'user.fields': ['username', 'name'],
                expansions: ['author_id']
            })
        ]);

        console.log('Processing mentions and replies:', {
            mentions: mentions.data.data?.length || 0,
            replies: replies.data.data?.length || 0
        });

        // Handle mentions
        for (const mention of mentions.data.data || []) {
            try {
                await this.handleMention(mention);
            } catch (mentionError) {
                console.error('Error handling mention:', mentionError);
            }
        }

        // Handle replies
        for (const tweet of replies.data.data || []) {
            try {
                await this.handleReply(tweet);
            } catch (replyError) {
                console.error('Error handling reply:', replyError);
            }
        }

        console.log('Monitoring cycle completed');

    } catch (error) {
        console.error('Error in monitoring cycle:', error);
        this.monitoringStats.lastError = error as Error;

        // Implement exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.backoffDelay));
        this.backoffDelay = Math.min(this.backoffDelay * 2, 5 * 60 * 1000); 
    }
}

public async getMonitoringStatus(): Promise<any> {
    return {
        isMonitoring: this.isMonitoring,
        lastCheck: this.lastMonitoringCheck,
        stats: this.monitoringStats,
        recentTweets: Array.from(this.recentTweets.values()).slice(0, 5)
    };
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

  async getStatus(): Promise<any> {  // Define return type based on your needs
    return {
      lastTweetTime: this.lastTweetTime,
      isReady: this.isReady,  // Assuming these properties exist
      // Add other status properties as needed
    };
  }


public toggle24HourMode(enabled: boolean) {
    this.is24HourMode = enabled;
    if (enabled) {
        this.schedule24Hours().catch(console.error);
    }
}

private async schedule24Hours() {
    const baseTime = new Date();
    const tweets = await this.getQueuedTweets();
    const pendingTweets = tweets.filter(t => t.status === 'pending');
    
    // Spread tweets over 24 hours
    const interval = (24 * 60 * 60 * 1000) / (pendingTweets.length || 1);
    
    for (let i = 0; i < pendingTweets.length; i++) {
        const scheduledTime = new Date(baseTime.getTime() + (interval * i));
        await this.updateTweetStatus(pendingTweets[i].id, 'approved', scheduledTime);
    }
}

private async getLastInteractionTime(): Promise<Date> {
    try {
        const { data, error } = await this.supabaseClient
            .from('last_interaction')
            .select('timestamp')
            .single();
        
        if (error) {
            console.error('Error fetching last interaction time:', error);
            // If there's an error, return a very old date to ensure we process messages
            return new Date(0);
        }
        
        console.log('Last interaction time from DB:', data?.timestamp);
        return data ? new Date(data.timestamp) : new Date(0);
    } catch (error) {
        console.error('Error in getLastInteractionTime:', error);
        return new Date(0);
    }
}

  public getRecentTweets() {
    return this.recentTweets;
  }

  public getTweetStats() {
    return this.stats.getStats();
  }

  public resetTweetStats(): void {
    this.stats?.reset();
  }

  async getEngagementTargets() {
    try {
        const { data, error } = await this.supabaseClient
            .from('engagement_targets')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching engagement targets:', error);
        throw error;
    }
  }

  async addEngagementTarget(username: string) {
    try {
      const user = await this.twitterClient.v2.userByUsername(username);
      if (!user.data) {
        throw new Error('User not found');
      }

      const { data, error } = await this.supabaseClient
        .from('engagement_targets')
        .insert({
          username,
          twitter_id: user.data.id,
          topics: [],
          reply_probability: 0.5,
          preferred_style: 'casual'
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding engagement target:', error);
      throw error;
    }
  }

  async removeEngagementTarget(id: string) {
    try {
      const { error } = await this.supabaseClient
        .from('engagement_targets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error removing engagement target:', error);
      throw error;
    }
  }

  public async startAutoQueue(): Promise<void> {
    try {
      this.isAutoMode = true;
      await this.persistAutoMode(true);
      await this.scheduleNextTweet();
    } catch (error) {
      console.error('Error starting auto queue:', error);
      throw error;
    }
  }

  public async stopAutoQueue(): Promise<void> {
    this.isAutoMode = false;
    await this.persistAutoMode(false);
    if (this.nextTweetTimeout) {
      clearTimeout(this.nextTweetTimeout);
    }
  }

  public async getAutoQueueStatus(): Promise<{ enabled: boolean }> {
    return { enabled: this.isAutoMode };
  }

  async updateEngagementTarget(id: string, data: Partial<EngagementTargetRow>) {
    try {
      const { error } = await this.supabaseClient
        .from('engagement_targets')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating engagement target:', error);
      throw error;
    }
  }

  async getTrainingData(username: string, limit: number = 100) {
    try {
      const { data, error } = await this.supabaseClient
        .from('training_data')
        .select('*')
        .eq('username', username)
        .limit(limit);
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching training data:', error);
      throw error;
    }
  }

  async addTrainingData(username: string, tweets: any[]) {
    try {
      const { error } = await this.supabaseClient
        .from('training_data')
        .insert(tweets.map(tweet => ({
          username,
          content: tweet.content,
          metadata: tweet.metadata || {},
          created_at: new Date().toISOString()
        })));
        
      if (error) throw error;
    } catch (error) {
      console.error('Error adding training data:', error);
      throw error;
    }
  }
}