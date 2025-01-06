import { TwitterApi } from 'twitter-api-v2';

interface TweetOptions {
  reply?: {
    in_reply_to_tweet_id: string;
  };
}

export interface TweetStyle {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    formality?: 'casual' | 'formal';
}

export interface TwitterTimelineIncludes {
  users?: TwitterUser[];
  tweets?: TwitterData[];
}

export interface ContextData {
  platform: 'twitter';
  environmentalFactors: {
      timeOfDay: string;
      platformActivity: number;
      socialContext: string[];
      platform: string;
  };
  style: TweetStyle;
  additionalContext: {
      originalTweet?: string;
      replyingTo?: string;
      topics?: string[];
      relationship?: string;
  };
}


export interface ReplyContext {
  type: 'mention' | 'reply';
  content: string;
  user: string;
}

// app/core/twitter/types.ts
export type TwitterClient = TwitterApi;

export type TwitterTimelineOptions = Parameters<TwitterClient['userTimeline']>[0];

export interface TwitterMetrics {
  like_count: number;
  retweet_count: number;
  reply_count: number;
}

export interface TwitterData {
  id: string;
  text: string;
  author_id?: string;
  author_username?: string;
  public_metrics?: TwitterMetrics;
  created_at?: string;
  in_reply_to_user_id?: string;
  referenced_tweet_ids?: string[];
}

export interface TwitterResponse {
  data: TwitterData;
  includes?: TwitterTimelineIncludes;
}

export interface TwitterManager {
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface TwitterTimelineResponse {
  data: {
      data: TwitterData[];
      includes?: TwitterTimelineIncludes;
  };
}

export interface TweetStats {
  getStats(): any;
  reset(): void;
  increment(status: string): void;
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

export interface LastInteraction {
  timestamp: string;
}

export interface TweetV2 extends TwitterData {
  edit_history_tweet_ids?: string[];
}

export interface TwitterClientV2Methods {
  tweet: (content: string | { text: string, reply?: { in_reply_to_tweet_id: string } }) => Promise<{ data: TweetV2 }>;
  userTimeline: (userId: string, options?: any) => Promise<{ data: { data: TweetV2[] } }>;
  userMentionTimeline: (userId: string, options?: any) => Promise<{ data: { data: TweetV2[] } }>;
  me: () => Promise<{ data: { id: string } }>;
  userByUsername: (username: string) => Promise<{ data: { id: string; username: string; name: string; } }>;
}

export interface TwitterClientV2 extends TwitterClient {
  v2: TwitterClientV2Methods;
}
// Add interface for the third parameter in processInput
export interface PersonalitySystem {
  processInput(
    input: string,
    context?: any,
    examples?: any[]
  ): Promise<string>;
}

export interface TwitterClientWithV2 extends TwitterClient {
  tweet(content: string, options?: { reply?: { in_reply_to_tweet_id: string } }): Promise<TwitterResponse>;
}

export interface RepliedTweet {
  tweet_id: string;
  target_id: string;
  replied_at: string;
  reply_tweet_id: string;
}

