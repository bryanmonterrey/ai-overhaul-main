// app/types/supabase.ts

import type { Database as BaseDatabase } from '@/types/supabase.types';
import { supabase } from '@/types/supabase';

export interface EngagementTargetRow {
  id: string;
  username: string;
  twitter_id: string;
  topics: string[];
  reply_probability: number;
  preferred_style: string;
  created_at: string;
  last_interaction: string | null;
}

export interface TrainingDataRow {
  id: string;
  username: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EngagementHistoryRow {
  id: string;
  target_id: string;
  tweet_id: string;
  reply_id: string;
  engagement_type: string;
  timestamp: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagement_rate: number;
  } | null;
  created_at: string;
}

export interface EngagementRules {
    maxRepliesPerDay: number;
    cooldownPeriod: number;  // minutes
    topicRelevanceThreshold: number;
    replyTypes: ('agree' | 'disagree' | 'question' | 'build')[];
}

// Fixed Database interface
export type Database = {
  public: {
    Tables: {
      engagement_targets: {
        Row: EngagementTargetRow;
        Insert: Omit<EngagementTargetRow, 'id' | 'created_at'>;
        Update: Partial<EngagementTargetRow>;
      };
      training_data: {
        Row: TrainingDataRow;
        Insert: Omit<TrainingDataRow, 'id' | 'created_at'>;
        Update: Partial<TrainingDataRow>;
      };
      tweet_training_data: {
        Row: TrainingDataRow;
        Insert: Omit<TrainingDataRow, 'id' | 'created_at'>;
        Update: Partial<TrainingDataRow>;
      };
      trading_sessions: {
        Row: {
          id: string;
          public_key: string;
          signature: string;
          timestamp: number;
          expires_at: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          public_key: string;
          signature: string;
          timestamp: number;
          expires_at: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          public_key?: string;
          signature?: string;
          timestamp?: number;
          expires_at?: number;
          created_at?: string;
          updated_at?: string;
        };
      };   
    };
  };
};

// Helper functions for engagement targets
export async function getEngagementTargets() {
  const { data, error } = await supabase
    .from('engagement_targets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addEngagementTarget(target: Omit<EngagementTargetRow, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('engagement_targets')
    .insert([target])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEngagementTarget(id: string, updates: Partial<EngagementTargetRow>) {
  const { data, error } = await supabase
    .from('engagement_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEngagementTarget(id: string) {
  const { error } = await supabase
    .from('engagement_targets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

