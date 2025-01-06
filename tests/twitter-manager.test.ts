// src/tests/twitter-manager.test.ts

import { jest } from '@jest/globals';
import { TwitterManager } from '@/app/core/twitter/twitter-manager';
import { mockTwitterApi } from '@/tests/mocks/twitter-api.mock';
import { 
  TwitterRateLimitError, 
  TwitterAuthError, 
  TwitterNetworkError,
  TwitterDataError 
} from '@/app/core/twitter/twitter-errors';

// Define a simpler mock type
type MockTweetFn = jest.MockedFunction<typeof mockTwitterApi.tweet>;

jest.mock('@/tests/mocks/twitter-api.mock', () => ({
  mockTwitterApi: {
    tweet: jest.fn().mockImplementation(async () => ({ 
      data: { id: '123', text: 'test' } 
    })),
    userTimeline: jest.fn(),
    userMentionTimeline: jest.fn()
  }
}));

describe('TwitterManager', () => {
  let twitterManager: TwitterManager;

  beforeEach(() => {
    jest.clearAllMocks();
    twitterManager = new TwitterManager(mockTwitterApi);
  });

  describe('postTweet', () => {
    it('should successfully post a tweet', async () => {
      const content = 'Test tweet';
      const expectedTweet = {
        id: '123',
        text: content
      };

      (mockTwitterApi.tweet as MockTweetFn).mockResolvedValueOnce({ 
        data: expectedTweet 
      });

      const result = await twitterManager.postTweet(content);
      expect(result).toEqual(expectedTweet);
    });

    it('should handle rate limits', async () => {
      (mockTwitterApi.tweet as MockTweetFn).mockRejectedValueOnce({
        code: 429,
        message: 'Rate limit exceeded'
      });

      await expect(twitterManager.postTweet('test'))
        .rejects
        .toThrow(TwitterRateLimitError);
    });

    it('should handle network errors', async () => {
      (mockTwitterApi.tweet as MockTweetFn).mockRejectedValueOnce(
        new Error('timeout')
      );

      await expect(twitterManager.postTweet('test'))
        .rejects
        .toThrow(TwitterNetworkError);
    });
  });

  describe('createThread', () => {
    it('should create a thread of tweets', async () => {
      const tweets = ['Tweet 1', 'Tweet 2', 'Tweet 3'];
      const expectedResponses = tweets.map((text, i) => ({
        id: `${i}`,
        text
      }));

      (mockTwitterApi.tweet as MockTweetFn)
        .mockResolvedValueOnce({ data: expectedResponses[0] })
        .mockResolvedValueOnce({ data: expectedResponses[1] })
        .mockResolvedValueOnce({ data: expectedResponses[2] });

      const result = await twitterManager.createThread(tweets);
      expect(result).toHaveLength(3);
      expect(result[1].id).toBe('1');
    });

    it('should handle partial thread failure', async () => {
      (mockTwitterApi.tweet as MockTweetFn)
        .mockResolvedValueOnce({ data: { id: '1', text: 'Tweet 1' } })
        .mockRejectedValueOnce(new Error('Failed'));

      await expect(twitterManager.createThread(['Tweet 1', 'Tweet 2']))
        .rejects
        .toThrow(TwitterDataError);
    });
  });

  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      (mockTwitterApi.tweet as MockTweetFn).mockRejectedValueOnce({
        code: 401,
        message: 'Invalid credentials'
      });

      await expect(twitterManager.postTweet('test'))
        .rejects
        .toThrow(TwitterAuthError);
    });

    it('should handle network timeouts', async () => {
      (mockTwitterApi.tweet as MockTweetFn).mockRejectedValueOnce(
        new Error('timeout')
      );

      await expect(twitterManager.postTweet('test'))
        .rejects
        .toThrow(TwitterNetworkError);
    });

    it('should handle data validation errors', async () => {
      const longTweet = 'a'.repeat(281);
      (mockTwitterApi.tweet as MockTweetFn).mockRejectedValueOnce(
        new TwitterDataError('Tweet exceeds character limit')
      );

      await expect(twitterManager.postTweet(longTweet))
        .rejects
        .toThrow(TwitterDataError);
    });
  });
});