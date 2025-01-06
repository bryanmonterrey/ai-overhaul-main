// src/types/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { Database } from './supabase.types';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Type definitions for our database tables
export interface Memory {
  id: string;
  content: string;
  type: 'experience' | 'fact' | 'emotion' | 'interaction' | 'narrative';
  emotional_context: string;
  importance: number;
  timestamp: string;
  associations: string[];
  platform: string;
}

export interface Interaction {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'ai';
  emotional_state: string;
  timestamp: string;
}

export interface PersonalityState {
  id: string;
  current_emotional_state: string;
  volatility: number;
  narrative_mode: string;
  recent_memories: string[];
  timestamp: string;
}

// Database helper functions
export async function getMemories(limit = 10) {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function storeMemory(memory: Omit<Memory, 'id'>) {
  const { data, error } = await supabase
    .from('memories')
    .insert([memory])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function storeInteraction(interaction: Omit<Interaction, 'id'>) {
  const { data, error } = await supabase
    .from('interactions')
    .insert([interaction])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPersonalityState() {
  const { data, error } = await supabase
    .from('personality_state')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

export async function updatePersonalityState(state: Omit<PersonalityState, 'id'>) {
  const { data, error } = await supabase
    .from('personality_state')
    .insert([state])
    .select()
    .single();

  if (error) throw error;
  return data;
}