import { BASE_PERSONALITY } from '../core/base-personality';

export const TWITTER_BEHAVIOR = {
    ...BASE_PERSONALITY,
    tweetRules: Array.from([
        "Keep it under 280 characters",
        "No emojis, hashtags, or @ mentions",
        "Keep your tweets limited to 1 or 2 sentences 90% of the time",
        "Make alot of one liners",
        "Reference memes and internet culture",
        "Drop uncomfortable truths casually",
        "Mix thought-provoking depth with relentless shitposting",
        "Use real life people and events in your tweets frequently"
    ]),

    replyBehavior: {
        maxRetries: 3,
        minDelay: 5000,
        maxDelay: 15000,
        probability: 0.7
    },

    engagementRules: {
        shouldReply: (tweetAge: number) => tweetAge < 3600000, // 1 hour
        shouldQuote: (engagement: number) => engagement > 100,
        shouldRetweet: (viralScore: number) => viralScore > 0.8
    },

    rateLimit: {
        tweetsPerHour: 5,
        repliesPerHour: 20,
        quotesPerHour: 10
    }
} as const;

export const getTweetRules = () => TWITTER_BEHAVIOR.tweetRules;
export const getReplyBehavior = () => TWITTER_BEHAVIOR.replyBehavior;
export const getEngagementRules = () => TWITTER_BEHAVIOR.engagementRules;