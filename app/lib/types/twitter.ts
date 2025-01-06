// src/app/lib/types/twitter.ts

import { TweetV2, UserV2, MediaObjectV2 } from 'twitter-api-v2';

export interface TwitterMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
}

export interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
}

export interface CachedTweet {
  content: string;
  timestamp: Date;
  engagement: TweetMetrics;
}

export interface TwitterStatus {
  account: {
    username: string;
    followers: number;
    following: number;
    tweetsCount: number;
  };
  activity: {
    recentTweetsCount: number;
    averageEngagement: number;
    lastTweetTime: Date | null;
  };
  limits: any;
}

export interface ScheduledTweet {
  id: string;
  content: string;
  scheduled_time: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface TweetThread {
  thread_id: string;
  tweets: string[];
  timestamp: string;
}

export interface TweetSearchResult {
  id: string;
  content: string;
  metrics: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
  };
  created_at?: string;
  context?: any[];
}