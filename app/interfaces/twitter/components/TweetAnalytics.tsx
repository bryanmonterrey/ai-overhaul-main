// src/app/interfaces/twitter/components/TweetAnalytics.tsx

import React from 'react';
import { Card } from '../../../components/common/Card';

interface AnalyticsData {
  engagement: {
    total_likes: number;
    total_retweets: number;
    total_replies: number;
    average_engagement_rate: number;
  };
  performance: {
    best_style: string;
    peak_hours: string[];
    top_themes: string[];
  };
  trends: {
    sentiment: number;
    volatility: number;
    momentum: number;
  };
}

interface TweetAnalyticsProps {
  data?: AnalyticsData | null;
}

const defaultData: AnalyticsData = {
  engagement: {
    total_likes: 0,
    total_retweets: 0,
    total_replies: 0,
    average_engagement_rate: 0,
  },
  performance: {
    best_style: 'N/A',
    peak_hours: [],
    top_themes: [],
  },
  trends: {
    sentiment: 0,
    volatility: 0,
    momentum: 0,
  },
};

export default function TweetAnalytics({ data }: TweetAnalyticsProps) {
  const analytics = data || defaultData;

  return (
    <Card variant="system" title="PERFORMANCE_METRICS">
      <div className="space-y-6">
        <div>
          <div className="text-xs mb-2">engagement_metrics:</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>total_likes: {analytics.engagement.total_likes}</div>
            <div>total_retweets: {analytics.engagement.total_retweets}</div>
            <div>total_replies: {analytics.engagement.total_replies}</div>
            <div>avg_engagement: {(analytics.engagement.average_engagement_rate * 100).toFixed(1)}%</div>
          </div>
        </div>

        <div>
          <div className="text-xs mb-2">optimization_data:</div>
          <div className="space-y-1 text-sm">
            <div>optimal_style: {analytics.performance.best_style}</div>
            <div>peak_hours: {analytics.performance.peak_hours.join(', ') || 'N/A'}</div>
            <div className="space-y-1">
              <div>top_themes:</div>
              {analytics.performance.top_themes.length > 0 ? (
                analytics.performance.top_themes.map((theme, i) => (
                  <div key={theme} className="ml-4">
                    [{i}] {theme}
                  </div>
                ))
              ) : (
                <div className="ml-4">No themes available</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs mb-2">trend_analysis:</div>
          <div className="space-y-2">
            {Object.entries(analytics.trends).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="text-xs">{key}:</div>
                <div className="w-full bg-black h-2">
                  <div 
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}