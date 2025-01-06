// app/core/twitter/AutoTweeter.ts

import { PersonalitySystem } from '../personality/PersonalitySystem';
import { TweetStyle } from '../personality/types';
import { TweetStats } from './TweetStats'; 

interface QueuedTweet {
  id: string;
  content: string;
  style: TweetStyle;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export class AutoTweeter {
  private queuedTweets: QueuedTweet[] = [];
  private isAutoMode: boolean = false;
  private minTimeBetweenTweets = 30 * 60 * 1000; // 30 minutes
  private nextTweetTimeout?: NodeJS.Timeout;
  private stats: TweetStats;

  constructor(
    private personality: PersonalitySystem,
    private twitterService: any // Your Twitter service
  ) {
    this.stats = new TweetStats();  // Initialize stats
  }

  private updateStatistics(status: 'approved' | 'rejected' | 'posted') {
    this.stats.increment(status);
  }

  // Add postTweet method
  private async postTweet(content: string): Promise<any> {
    return this.twitterService.postTweet(content);
  }

  public async generateTweetBatch(count: number = 10): Promise<void> {
    const newTweets: QueuedTweet[] = [];
    
    for (let i = 0; i < count; i++) {
      const style = this.personality.getCurrentTweetStyle();
      const content = await this.personality.processInput(
        'Generate a tweet', 
        { platform: 'twitter', style }
      );

      newTweets.push({
        id: crypto.randomUUID(),
        content: this.cleanTweet(content),
        style,
        status: 'pending',
        generatedAt: new Date()
      });
    }

    this.queuedTweets = [...this.queuedTweets, ...newTweets];
  }

  private cleanTweet(tweet: string): string {
    return tweet
      .replace(/\[(\w+)_state\]$/, '') // Remove state markers
      .trim();
  }

  public updateTweetStatus(id: string, status: 'approved' | 'rejected'): void {
    // Update the tweet status
    this.queuedTweets = this.queuedTweets.map(tweet => {
      if (tweet.id === id) {
        return {
          ...tweet,
          status,
          updatedAt: new Date(), // Add timestamp for tracking
          scheduledFor: status === 'approved' ? new Date(Date.now() + this.getRandomDelay()) : undefined
        };
      }
      return tweet;
    });

    // Emit an event or update statistics
    this.updateStatistics(status);
    
    // If approved and auto mode is on, schedule it
    if (status === 'approved' && this.isAutoMode) {
      this.scheduleNextTweet();
    }
}

  public toggleAutoMode(enabled: boolean): void {
    this.isAutoMode = enabled;
    if (enabled) {
      this.scheduleNextTweet();
    } else {
      if (this.nextTweetTimeout) {
        clearTimeout(this.nextTweetTimeout);
      }
    }
  }

  private getOptimalTweetTime(): Date {
    const now = new Date();
    const hour = now.getHours();
    
    // Avoid tweeting during low engagement hours (11 PM - 6 AM)
    if (hour >= 23 || hour < 6) {
      now.setHours(7, 0, 0, 0); // Set to 7 AM
      if (hour >= 23) now.setDate(now.getDate() + 1);
    }
    
    return now;
  }

  private getRandomDelay(): number {
    // Random delay between 15-45 minutes (in milliseconds)
    const minDelay = 15 * 60 * 1000;
    const maxDelay = 45 * 60 * 1000;
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

private getEngagementBasedDelay(): number {
    const hour = new Date().getHours();
    
    // Define engagement weights with proper type
    const hourlyWeights: Record<number, number> = {
        0: 0.2,  // 12 AM
        1: 0.1,
        9: 0.8,  // 9 AM
        10: 0.9,
        11: 0.8,
        12: 0.7,
        13: 0.8,
        14: 0.7,
        15: 0.8,
        16: 0.9,  // 4 PM
        17: 1.0,  // 5 PM peak
        18: 0.9,
        19: 0.8,
        20: 0.7,
        21: 0.6,
        22: 0.4,
        23: 0.3
    };

    // Get base delay
    const baseDelay = this.getRandomDelay();
    
    // Adjust delay based on engagement weight
    const weight = hourlyWeights[hour] ?? 0.5;  // Use nullish coalescing
    const adjustedDelay = baseDelay * (1 + (1 - weight));
    
    return Math.floor(adjustedDelay);
  }

private async scheduleNextTweet(): Promise<void> {
    if (!this.isAutoMode) return;

    const approvedTweets = this.queuedTweets.filter(t => t.status === 'approved');
    if (approvedTweets.length === 0) return;

    const nextTweet = approvedTweets[0];
    
    // Get delay based on engagement patterns
    const delay = this.getEngagementBasedDelay();
    const scheduledTime = new Date(Date.now() + delay);

    // Don't schedule during low engagement hours (11 PM - 6 AM)
    if (scheduledTime.getHours() >= 23 || scheduledTime.getHours() < 6) {
        scheduledTime.setHours(7, 0, 0, 0); // Set to 7 AM
        if (scheduledTime.getHours() >= 23) scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    nextTweet.scheduledFor = scheduledTime;

    if (this.nextTweetTimeout) {
        clearTimeout(this.nextTweetTimeout);
    }

    console.log(`Scheduling tweet for ${scheduledTime}`);

    this.nextTweetTimeout = setTimeout(async () => {
        try {
            console.log(`Posting scheduled tweet: ${nextTweet.content}`);
            await this.postTweet(nextTweet.content);
            
            // Remove the posted tweet from queue
            this.queuedTweets = this.queuedTweets.filter(t => t.id !== nextTweet.id);
            
            // Update stats
            this.updateStatistics('posted');
            
            // Log success and schedule next tweet
            console.log('Tweet posted successfully');
            this.scheduleNextTweet();
        } catch (error) {
            console.error('Error posting scheduled tweet:', error);
            setTimeout(() => this.scheduleNextTweet(), 5 * 60 * 1000);
        }
    }, delay);
}

  public getQueuedTweets(): QueuedTweet[] {
    return this.queuedTweets;
  }

  public clearRejectedTweets(): void {
    this.queuedTweets = this.queuedTweets.filter(t => t.status !== 'rejected');
  }
}