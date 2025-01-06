// app/core/personality/training/TrainingIntegration.ts

import { PersonalitySystem } from '../PersonalitySystem';
import { createClient } from '@supabase/supabase-js';
import { Context } from '../types';
import { 
  TrainingPattern,
  TrainingConversation,
  PromptTemplate 
} from './types';
import { TROLL_PATTERNS } from './constants';

// Create the Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TrollPatternOutput {
  patterns: string[];
  themes: string[];
}

export class TrainingIntegration {
  constructor(
    private personalitySystem: PersonalitySystem,
    private tweetGenerator: any // Temporarily type as any if PersonalityDrivenTweetGenerator is not available
  ) {}

  private generateEnhancedPrompt(
    conversations: TrainingConversation[],
    templates: PromptTemplate[],
    trollPatterns: TrollPatternOutput[],
    context: Context
  ): string {
    // Implement your prompt generation logic here
    return `Enhanced prompt with ${trollPatterns.length} patterns`; // Placeholder return
  }

  async getTrainedPrompt(context: Context): Promise<string> {
    // Get relevant approved conversations
    const { data: conversations } = await supabase
      .from('training_conversations')
      .select('*')
      .eq('is_approved', true)
      .order('votes', { ascending: false })
      .limit(5);

    // Get matching prompt templates
    const { data: templates } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_active', true);

    // Combine TrollTweets patterns with type safety
    const trollPatterns = Object.values(TROLL_PATTERNS)
      .filter((p: TrainingPattern) => p.responseStyle === context.style)
      .map((p: TrainingPattern) => ({
        patterns: p.triggers,
        themes: p.themes || []
      }));

    // Generate prompt using all sources
    return this.generateEnhancedPrompt(
      conversations || [],
      templates || [],
      trollPatterns,
      context
    );
  }
}