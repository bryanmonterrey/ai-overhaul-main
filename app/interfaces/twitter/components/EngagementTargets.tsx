// app/interfaces/twitter/components/EngagementTargets.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import type { EngagementTargetRow } from '../../../types/supabase';
import type { TweetStyle } from '../../../core/personality/types';
import { 
  Select,
  SelectContent, 
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '../../../components/common/Select';

export default function EngagementTargets() {
 const [targets, setTargets] = useState<EngagementTargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTarget, setNewTarget] = useState({
    username: '',
    twitter_id: '',  // Add this
    topics: '',
    replyProbability: 50,
    preferredStyle: 'casual' as TweetStyle
  });

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/twitter/targets');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || 'Failed to fetch targets');
      }
      setTargets(data.targets || []);
    } catch (error) {
      console.error('Error fetching targets:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch targets');
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const addTarget = async () => {
    try {
      const response = await fetch('/api/twitter/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newTarget.username,
          twitter_id: newTarget.twitter_id, 
          topics: newTarget.topics.split(',').map(t => t.trim()),
          replyProbability: newTarget.replyProbability / 100,
          preferredStyle: newTarget.preferredStyle
        })
      });

      if (response.ok) {
        await fetchTargets();
        setNewTarget({
          username: '',
          twitter_id: '',
          topics: '',
          replyProbability: 50,
          preferredStyle: 'casual'
        });
      }
    } catch (error) {
      console.error('Error adding target:', error);
    }
  };

  const removeTarget = async (id: string) => {
    try {
      await fetch(`/api/twitter/targets/${id}`, { method: 'DELETE' });
      await fetchTargets();
    } catch (error) {
      console.error('Error removing target:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <Card variant="system" title="ENGAGEMENT_TARGETS">
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="TWITTER_USERNAME"
            value={newTarget.username}
            className='bg-[#11111A] text-white'
            onChange={(e) => setNewTarget(prev => ({ ...prev, username: e.target.value }))}
          />
          <Input
    placeholder="TWITTER_ID"
    value={newTarget.twitter_id}
    className='bg-[#11111A] text-white'
            onChange={(e) => setNewTarget(prev => ({ ...prev, twitter_id: e.target.value }))}
          />
          <Input
            placeholder="TOPICS [COMMA_SEPARATED]"
            value={newTarget.topics}
            className='bg-[#11111A] text-white'
            onChange={(e) => setNewTarget(prev => ({ ...prev, topics: e.target.value }))}
          />
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>REPLY_RATE: {newTarget.replyProbability}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={newTarget.replyProbability}
              onChange={(e) => setNewTarget(prev => ({ 
                ...prev, 
                replyProbability: parseInt(e.target.value) 
              }))}
              className="flex-1 accent-white"
            />
          </div>
          <Select value={newTarget.preferredStyle} onValueChange={(value: TweetStyle) => setNewTarget(prev => ({ ...prev, preferredStyle: value }))}>
            <SelectTrigger className="w-full bg-[#11111A] text-white border border-zinc-800 p-2 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">CASUAL_MODE</SelectItem>
              <SelectItem value="shitpost">SHITPOST_MODE</SelectItem>
              <SelectItem value="metacommentary">META_MODE</SelectItem>
              <SelectItem value="rant">RANT_MODE</SelectItem>
              <SelectItem value="hornypost">HORNY_MODE</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="system"
            onClick={addTarget}
            className="w-full"
          >
            ADD_TARGET
          </Button>
        </div>

        <div className="space-y-2">
          {Array.isArray(targets) && targets.map(target => (
            <div key={target.id} className="flex items-center justify-between p-2 border border-white font-mono text-xs">
              <div>
                <div>@{target.username}</div>
                <div className="opacity-70">ID: {target.twitter_id}</div>
                <div className="opacity-70">
                  TOPICS: {target.topics.join(', ')}
                </div>
                <div className="opacity-70">
                  MODE: {target.preferred_style} | RATE: {Math.round(target.reply_probability * 100)}%
                </div>
                {target.last_interaction && (
                  <div className="opacity-70">
                    LAST_INTERACTION: {new Date(target.last_interaction).toLocaleDateString()}
                  </div>
                )}
              </div>
              <Button
                variant="system"
                onClick={() => removeTarget(target.id)}
                className="h-8 px-2"
              >
                REMOVE
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}