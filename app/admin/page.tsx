'use client';

import React, { useState, useEffect } from 'react';
import Pusher from 'pusher-js';
import AdminControls from '../components/personality/AdminControls';
import { EmotionalStateDisplay } from '../components/personality/EmotionalStateDisplay';
import { PersonalityMonitor } from '../components/personality/PersonalityMonitor';
import { MemoryViewer } from '../components/personality/MemoryViewer';
import { Card } from '../components/common/Card';
import { EmotionalState } from '../core/types';
import { NarrativeMode, TweetStyle } from '../core/types';

interface SystemState {
  consciousness: {
    emotionalState: EmotionalState;
  };
  emotionalProfile?: {
    volatility: number;
  };
  narrative_mode: NarrativeMode;
  tweet_style: TweetStyle;
  traits: Record<string, number>;
  memories?: any[];
  currentContext?: {
    activeNarratives?: string[];
  };
}

export default function AdminPage() {
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing');
  

  const loadSystemState = async () => {
    try {
      const response = await fetch('/api/admin/system-state');
      const data = await response.json();
      setSystemState(data);
    } catch (error) {
      console.error('Error loading system state:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleUpdateState = async (updates: Partial<any>) => {
    setIsLoading(true);
    try {
      console.log('Sending updates:', updates);
      
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received updated state:', data);
      
      // Update the local state with the new data, using proper snake_case keys
      setSystemState((prevState: SystemState | null) => ({
        ...prevState,
        narrative_mode: data.narrative_mode || prevState?.narrative_mode,
        consciousness: {
          ...prevState?.consciousness,
          emotionalState: data.consciousness?.emotionalState || prevState?.consciousness?.emotionalState
        },
        traits: data.traits || prevState?.traits || {},
        tweet_style: data.tweet_style || prevState?.tweet_style
      }));

      // Force a refresh of the system state
      await loadSystemState();
    } catch (error) {
      console.error('Error updating state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      await loadSystemState();
      await loadStats();
    } catch (error) {
      console.error('Error resetting system:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadSystemState();
    loadStats();
    
    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    // Subscribe to channel
    const channel = pusher.subscribe('admin-stats');

    // Connection handling
    pusher.connection.bind('connected', () => {
      setConnectionStatus('ONLINE');
      console.log('Realtime connection established');
    });

    pusher.connection.bind('disconnected', () => {
      setConnectionStatus('OFFLINE');
      console.log('Realtime connection lost');
    });

    // Listen for updates
    channel.bind('stats-update', (data: any) => {
      console.log('Received realtime update:', data);
      setStats(data);
    });

    // Keep the polling as fallback
    const interval = setInterval(() => {
      if (pusher.connection.state !== 'connected') {
        loadStats();
      }
    }, 30000);
    
    // Cleanup
    return () => {
      clearInterval(interval);
      channel.unbind_all();
      pusher.unsubscribe('admin-stats');
      pusher.disconnect();
    };
  }, []);

  if (!systemState) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Card variant="system">
          <div className="text-white">INITIALIZING_ADMIN_INTERFACE...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_300px] mb-24 pb-24 gap-6 h-[calc(100vh-1rem)]">
      <div className="space-y-6">
        <Card variant="system" title="SYSTEM_OVERVIEW">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>status: {connectionStatus}</div>
            <div>uptime: {stats?.uptime || 0}s</div>
            <div>memory_usage: {stats?.memoryUsage || 0}mb</div>
            <div>active_connections: {stats?.activeConnections || 0}</div>
          </div>
        </Card>

        {/* Rest of your components remain the same */}
        <div className="grid grid-cols-2 gap-6">
          <Card variant="system" title="INTERFACE_STATS">
            <div className="space-y-2 text-sm">
              <div>total_chats: {stats?.totalChats || 0}</div>
              <div>total_tweets: {stats?.totalTweets || 0}</div>
              <div>response_time_avg: {stats?.averageResponseTime || 0}ms</div>
              <div>success_rate: {((stats?.successRate || 0) * 100).toFixed(1)}%</div>
            </div>
          </Card>

          <Card variant="system" title="MEMORY_STATS">
            <div className="space-y-2 text-sm">
              <div>total_memories: {stats?.totalMemories || 0}</div>
              <div>memory_efficiency: {((stats?.memoryEfficiency || 0) * 100).toFixed(1)}%</div>
              <div>context_switches: {stats?.contextSwitches || 0}</div>
              <div>cache_hits: {((stats?.cacheHitRate || 0) * 100).toFixed(1)}%</div>
            </div>
          </Card>
        </div>

        <AdminControls
  onUpdateState={handleUpdateState}
  onReset={handleReset}
  currentState={{
    emotionalState: systemState?.consciousness?.emotionalState || 'neutral' as EmotionalState,
    tweetStyle: systemState?.tweet_style || 'shitpost' as TweetStyle,
    narrativeMode: systemState?.narrative_mode || 'philosophical' as NarrativeMode,
    traits: systemState?.traits || {}
  }}
  isLoading={isLoading}
/>
      </div>

      <div className="space-y-4 mb-24">
      
      <EmotionalStateDisplay
          state={systemState?.consciousness?.emotionalState}
          intensity={systemState?.emotionalProfile?.volatility}
          narrativeMode={systemState?.narrative_mode}
          traits={systemState?.traits || {}}
        />
        
        
        <PersonalityMonitor
          traits={systemState?.traits}
          tweetStyle={systemState?.tweet_style as TweetStyle}
          activeThemes={systemState?.currentContext?.activeNarratives || []} 
        />
        
        <MemoryViewer
          memories={systemState.memories || []}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}