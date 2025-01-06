// src/app/interfaces/twitter/components/TweetStream.tsx

import React from 'react';
import { Card } from '../../../components/common/Card';

interface Tweet {
  id: string;
  content: string;
  timestamp: Date;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  style: string;
}

interface TweetStreamProps {
  tweets: Tweet[] | null | undefined;
  onDelete?: (id: string) => Promise<void>;
}

export default function TweetStream({ tweets = [], onDelete }: TweetStreamProps) {
  const tweetArray = Array.isArray(tweets) ? tweets : [];

  return (
    <Card variant="system" title="TWEET_STREAM" className="space-y-4">
      {tweetArray.length > 0 ? (
        tweetArray.map((tweet) => (
          <div
            key={tweet.id}
            className="border border-white p-3 hover:border-white transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs text-white">
                {new Date(tweet.timestamp).toISOString()}
              </div>
              {onDelete && (
                <button
                  onClick={() => onDelete(tweet.id)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  TERMINATE
                </button>
              )}
            </div>

            <div className="font-mono text-sm mb-2">{tweet.content}</div>

            <div className="flex justify-between text-xs text-white">
              <div>style: {tweet.style}</div>
              <div className="flex space-x-4">
                <span>likes: {tweet.metrics.likes}</span>
                <span>retweets: {tweet.metrics.retweets}</span>
                <span>replies: {tweet.metrics.replies}</span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-sm text-white">
          NO_TWEETS_FOUND
        </div>
      )}
    </Card>
  );
}