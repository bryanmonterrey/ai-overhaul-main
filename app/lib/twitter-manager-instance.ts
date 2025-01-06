// app/lib/twitter-manager-instance.ts
import { TwitterManager } from '../core/twitter/twitter-manager';
import { PersonalitySystem } from '../core/personality/PersonalitySystem';
import { DEFAULT_PERSONALITY } from '../core/personality/config';
import { getTwitterClient } from './twitter-client';
import { getSupabaseClient } from './supabase/server';
import { TwitterTrainingService } from './services/twitter-training';

let twitterManagerInstance: TwitterManager | null = null;

export function getTwitterManager(): TwitterManager {
  if (!twitterManagerInstance) {
    try {
      const twitterClient = getTwitterClient();
      if (!twitterClient) {
        throw new Error('Twitter client not initialized');
      }

      const supabase = getSupabaseClient();
      const trainingService = new TwitterTrainingService(supabase);
      
      // Important: Pass trainingService to PersonalitySystem
      const personalitySystem = new PersonalitySystem(DEFAULT_PERSONALITY, trainingService);

      twitterManagerInstance = new TwitterManager(
        twitterClient,
        personalitySystem,
        supabase,
        trainingService
      );

      console.log('Twitter manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Twitter manager:', error);
      throw error;
    }
  }
  return twitterManagerInstance;
}