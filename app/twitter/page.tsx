// src/app/twitter/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import TweetComposer from '../interfaces/twitter/components/TweetComposer';
import TweetStream from '../interfaces/twitter/components/TweetStream';
import TweetAnalytics from '../interfaces/twitter/components/TweetAnalytics';
import { EmotionalStateDisplay } from '../components/personality/EmotionalStateDisplay';
import { TweetStyle } from '../core/types';
import EngagementTargets from '../interfaces/twitter/components/EngagementTargets';
import AutoTweetManager from '../interfaces/twitter/components/AutoTweetManager';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import TweetTraining from '../interfaces/twitter/components/TweetTraining';
import ReplyGenerator from '../interfaces/twitter/components/ReplyGenerator';


export default function TwitterPage() {
  const [tweets, setTweets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityState, setPersonalityState] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const handleTweet = async (content: string, style: TweetStyle) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/twitter/tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, style, personality: personalityState }),
      });

      const data = await response.json();
      
      setTweets(prev => [data.tweet, ...prev]);
      setPersonalityState(data.personalityState);
      await loadAnalytics();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplySelect = async (content: string) => {
    try {
      // Handle posting the selected reply
      await postTweet(content);
      // Show success message or handle UI updates
    } catch (error) {
      // Handle error
      console.error('Failed to post reply:', error);
    }
  };
  

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/twitter/analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/twitter/tweet/${id}`, { method: 'DELETE' });
      setTweets(prev => prev.filter(tweet => tweet.id !== id));
      await loadAnalytics();
    } catch (error) {
      console.error('Error deleting tweet:', error);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [tweetsRes, analyticsRes] = await Promise.all([
          fetch('/api/twitter/tweets'),
          fetch('/api/twitter/analytics')
        ]);
        
        if (!tweetsRes.ok) {
          throw new Error(`Tweets API error: ${tweetsRes.status} ${await tweetsRes.text()}`);
        }
        if (!analyticsRes.ok) {
          throw new Error(`Analytics API error: ${analyticsRes.status} ${await analyticsRes.text()}`);
        }
  
        const [tweetsData, analyticsData] = await Promise.all([
          tweetsRes.json(),
          analyticsRes.json()
        ]);
  
        if (tweetsData.error) {
          throw new Error(tweetsData.message || 'Error fetching tweets');
        }
        if (analyticsData.error) {
          throw new Error(analyticsData.message || 'Error fetching analytics');
        }
  
        setTweets(tweetsData);
        setAnalytics(analyticsData);
      } catch (error: any) {
        console.error('Error loading initial data:', error);
        // Optionally show error to user
        // setError(error.message);
      }
    };
  
    loadInitialData();
  }, []);

  return (
    <ErrorBoundary>
    <div className="grid grid-cols-[1fr_300px] gap-6 h-[calc(100vh-10rem)]">
      <div className="space-y-6">
        <TweetComposer
          onTweet={handleTweet}
          currentStyle={personalityState?.tweetStyle || 'metacommentary'}
          isLoading={isLoading}
        />
        <TweetStream tweets={tweets} onDelete={handleDelete} />
        <TweetTraining />
        <ReplyGenerator
          onReplySelect={handleReplySelect}
          isLoading={false} // Add your loading state
        />
      </div>

      <div className="space-y-4">
        <EmotionalStateDisplay
          state={personalityState?.consciousness?.emotionalState || 'neutral'}
          intensity={personalityState?.emotionalProfile?.volatility || 0.5}
          narrativeMode={personalityState?.narrativeMode || 'default'}
          traits={personalityState?.traits || {}}
        />
        
        {analytics && <TweetAnalytics data={analytics} />}
      </div>
      <AutoTweetManager />
      <EngagementTargets />
      </div>
    </ErrorBoundary>
  );
}