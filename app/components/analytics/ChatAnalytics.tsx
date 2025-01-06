// src/app/components/analytics/ChatAnalytics.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { dbService } from '../../lib/services/database';

interface AnalyticStats {
  messageCount: number;
  averageQuality: number;
  averageResponseTime: number;
  emotionalStates: Record<string, number>;
}

export function ChatAnalytics() {
  const [stats, setStats] = useState<AnalyticStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
    // Set up interval to refresh analytics
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadAnalytics() {
    try {
      const sessionId = dbService.getCurrentSessionId();
      if (!sessionId) {
        setError('No active session');
        return;
      }

      const [messages, sessionStats] = await Promise.all([
        dbService.getSessionMessages(sessionId),
        dbService.getSessionStats(sessionId)
      ]);

      // Calculate emotional state distribution
      const emotionalStates = messages.reduce((acc, msg) => {
        const state = msg.emotion || 'neutral';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setStats({
        messageCount: sessionStats.total_messages,
        averageQuality: sessionStats.avg_quality_score || 0,
        averageResponseTime: sessionStats.avg_response_time || 0,
        emotionalStates
      });

      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="border border-white p-4 font-mono">
        <div className="text-white text-sm animate-pulse">
          LOADING_ANALYTICS...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-white p-4 font-mono">
        <div className="text-red-500 text-sm">
          ERROR: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white p-4 font-mono text-sm">
      <h3 className="text-white mb-4">[SESSION_ANALYTICS]</h3>
      
      <div className="space-y-4">
        <div className="border-b border-white pb-2">
          <div className="text-white">
            MESSAGES: {stats?.messageCount || 0}
          </div>
          <div className="text-white">
            AVG_QUALITY: {(stats?.averageQuality || 0).toFixed(2)}
          </div>
          <div className="text-white">
            AVG_RESPONSE: {(stats?.averageResponseTime || 0).toFixed(0)}ms
          </div>
        </div>

        <div>
          <div className="text-white mb-2">EMOTIONAL_STATES:</div>
          {stats?.emotionalStates && Object.entries(stats.emotionalStates).map(([state, count]) => (
            <div key={state} className="flex justify-between text-white">
              <span>{state.toUpperCase()}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-white">
          <div className="text-white">
            SYSTEM_STATUS: {stats?.messageCount ? 'OPERATIONAL' : 'STANDBY'}
          </div>
          <div className="text-white">
            QUALITY_THRESHOLD: {(stats?.averageQuality || 0) > 0.7 ? 'OPTIMAL' : 'SUBOPTIMAL'}
          </div>
        </div>
      </div>
    </div>
  );
}