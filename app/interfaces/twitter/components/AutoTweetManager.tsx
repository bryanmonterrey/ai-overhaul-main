// app/interfaces/twitter/components/AutoTweetManager.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js'; 
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Switch } from '../../../components/common/Switch';

interface QueuedTweet {
  id: string;
  content: string;
  style: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: Date;
  scheduledFor?: Date;
}

export default function AutoTweetManager() {
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [queuedTweets, setQueuedTweets] = useState<QueuedTweet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [totalTweets] = useState(10);

  useEffect(() => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const subscription = supabase
        .channel('tweet_queue_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'tweet_queue'
            },
            () => {
                fetchQueuedTweets();  // Refresh when changes occur
            }
        )
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}, []);

  useEffect(() => {
    const fetchQueue = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/twitter/queue');
            const data = await response.json();
            if (data.tweets) {
                setQueuedTweets(data.tweets);
            }
        } catch (error) {
            console.error('Error fetching queue:', error);
            setError('Failed to fetch tweet queue');
        } finally {
            setIsLoading(false);
        }
    };

    fetchQueue();
  }, []);

  const fetchQueuedTweets = async () => {
    try {
      setError(null);
      const response = await fetch('/api/twitter/queue');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || 'Failed to fetch tweets');
      }
      setQueuedTweets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching queued tweets:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tweets');
      setQueuedTweets([]); // Reset to empty array on error
    }
  };

  const generateTweetBatch = async () => {
    setIsLoading(true);
    setGenerationProgress(0);
    setError(null);
    
    try {
        const response = await fetch('/api/twitter/queue/generate', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate tweets');
        }

        const data = await response.json();
        
        if (data.success) {
            setQueuedTweets(data.tweets || []);
            setGenerationProgress(totalTweets);
        } else {
            throw new Error(data.error || 'Failed to generate tweets');
        }
    } catch (error) {
        console.error('Error generating tweets:', error);
        setError(error instanceof Error ? error.message : 'Failed to generate tweets');
        // Don't clear existing tweets on error
    } finally {
        setIsLoading(false);
    }
};

  const updateTweetStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      setError(null);
      const response = await fetch(`/api/twitter/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error(`Failed to update tweet status: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.tweets) {
        setQueuedTweets(data.tweets);
      } else {
        throw new Error('Failed to update tweets');
      }
    } catch (error) {
      console.error('Error updating tweet status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const toggleAutoMode = async () => {
    try {
      setError(null);
      const response = await fetch('/api/twitter/queue/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isAutoMode })
      });
      if (!response.ok) {
        throw new Error(`Failed to toggle auto mode: ${response.statusText}`);
      }
      setIsAutoMode(!isAutoMode);
    } catch (error) {
      console.error('Error toggling auto mode:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle auto mode');
    }
  };

  const renderProgressBar = () => (
    <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden">
      <div 
        className="h-full bg-green-500 transition-all duration-300"
        style={{ width: `${(generationProgress / totalTweets) * 100}%` }}
      />
    </div>
  );

  return (
    <Card variant="system" title="AUTO_TWEET_MANAGER">
      <div className="space-y-4">
        {error && (
          <div className="text-red-500 text-xs  p-2 border border-red-500 bg-red-500/10">
            ERROR: {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className=" text-xs">
            MODE: {isAutoMode ? 'AUTOMATIC' : 'MANUAL'}
          </div>
          <Switch
            checked={isAutoMode}
            onCheckedChange={toggleAutoMode}
            className="data-[state=checked]:bg-green-500"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={generateTweetBatch}
            disabled={isLoading}
            className="flex-1 bg-[#00FFA2] hover:bg-[#00FFA2]/80 text-[#11111A] font-semibold"
          >
            {isLoading ? 'generating...' : 'generate batch'}
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2  text-xs">
            <div>generating: {generationProgress}/{totalTweets}</div>
            {renderProgressBar()}
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-3 gap-2 text-xs ">
            <div className="border border-zinc-800/20 p-2">
              TOTAL: {queuedTweets.length}
            </div>
            <div className="border border-zinc-800/20 p-2">
              PENDING: {queuedTweets.filter(t => t.status === 'pending').length}
            </div>
            <div className="border border-zinc-800/20 p-2">
              APPROVED: {queuedTweets.filter(t => t.status === 'approved').length}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {queuedTweets.map(tweet => (
            <div key={tweet.id} className="p-2 border border-zinc-800  text-xs">
              <div className="flex justify-between items-start mb-2">
                <div className="opacity-70">
                  {tweet.style.toUpperCase()}_MODE | {
                    tweet.scheduledFor 
                      ? `SCHEDULED: ${new Date(tweet.scheduledFor).toLocaleString()}`
                      : 'UNSCHEDULED'
                  }
                </div>
                <div className={`
                  px-1 
                  ${tweet.status === 'approved' ? 'text-green-500' : ''}
                  ${tweet.status === 'rejected' ? 'text-red-500' : ''}
                  ${tweet.status === 'pending' ? 'text-yellow-500' : ''}
                `}>
                  {tweet.status.toUpperCase()}
                </div>
              </div>
              
              <div className="mb-2 whitespace-pre-wrap border-l-2 border-zinc-800/20 pl-2">
                {tweet.content}
              </div>
              
              {tweet.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    variant="system"
                    onClick={() => updateTweetStatus(tweet.id, 'approved')}
                    className="flex-1 bg-green-900 hover:bg-green-800"
                  >
                    APPROVE
                  </Button>
                  <Button
                    variant="system"
                    onClick={() => updateTweetStatus(tweet.id, 'rejected')}
                    className="flex-1 bg-red-900 hover:bg-red-800"
                  >
                    REJECT
                  </Button>
                </div>
              )}

              {tweet.status === 'approved' && (
                <div className="mt-2 text-green-500/50 text-xs">
                  ESTIMATED_POST: {new Date(Date.now() + 1800000).toLocaleString()}
                </div>
              )}
            </div>
          ))}

          {queuedTweets.length === 0 && !isLoading && (
            <div className="text-center  text-xs opacity-50 p-4">
              NO_TWEETS_IN_QUEUE
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}