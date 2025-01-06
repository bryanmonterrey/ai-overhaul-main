// app/core/personality/training/TrainingPatternManager.ts

import { LRUCache } from 'lru-cache';
import { createClient } from '@supabase/supabase-js';
import { PersonalitySystem } from '../PersonalitySystem';
import { EmotionalSystem } from '../EmotionalSystem';
import { MemorySystem } from '../MemorySystem';
import type { TrainingPattern, TrainingOutcome, TrainingConfig } from './types';
import { EmotionalState, NarrativeMode, PersonalityState } from '../types';

export class TrainingPatternManager {
  private patterns: Map<string, TrainingPattern> = new Map();
  private recentApplications: LRUCache<string, Date>;
  private supabase;

  constructor(
    private personalitySystem: PersonalitySystem,
    private emotionalSystem: EmotionalSystem,
    private memorySystem: MemorySystem,
    private config: TrainingConfig
  ) {
    this.recentApplications = new LRUCache({
      max: 1000, // Maximum number of pattern applications to track
      ttl: 1000 * 60 * 60 // 1 hour TTL
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.loadPatternsFromDB();
  }

  private async loadPatternsFromDB(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('training_patterns')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      data?.forEach(pattern => {
        this.patterns.set(pattern.id, {
          ...pattern,
          lastApplied: this.recentApplications.get(pattern.id)
        });
      });
    } catch (error) {
      console.error('Error loading training patterns:', error);
    }
  }

  public async addPattern(pattern: TrainingPattern): Promise<void> {
    // Validate pattern
    this.validatePattern(pattern);

    // Store in database
    try {
      const { error } = await this.supabase
        .from('training_patterns')
        .insert({
          id: pattern.id,
          name: pattern.name,
          description: pattern.description,
          triggers: pattern.triggers,
          response_style: pattern.responseStyle,
          emotional_shift: pattern.emotionalShift,
          narrative_preference: pattern.narrativePreference,
          trait_modifications: pattern.traitModifications,
          min_confidence: pattern.minConfidence,
          cooldown_period: pattern.cooldownPeriod,
          active: true
        });

      if (error) throw error;

      // Add to local cache
      this.patterns.set(pattern.id, pattern);
    } catch (error) {
      console.error('Error adding training pattern:', error);
      throw error;
    }
  }

  public async matchPattern(input: string): Promise<TrainingPattern | null> {
    const now = new Date();
    const matches: Array<{ pattern: TrainingPattern; confidence: number }> = [];

    // Check each pattern for matches
    for (const pattern of Array.from(this.patterns.values())) {
      // Skip if in cooldown
      if (pattern.lastApplied && 
          now.getTime() - pattern.lastApplied.getTime() < pattern.cooldownPeriod) {
        continue;
      }

      const confidence = this.calculateMatchConfidence(input, pattern);
      if (confidence >= pattern.minConfidence) {
        matches.push({ pattern, confidence });
      }
    }

    // Return the best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.confidence - a.confidence);
      return matches[0].pattern;
    }

    return null;
  }

  private calculateMatchConfidence(input: string, pattern: TrainingPattern): number {
    const words = input.toLowerCase().split(/\s+/);
    let matchCount = 0;
    let totalTriggers = pattern.triggers.length;

    pattern.triggers.forEach(trigger => {
      if (words.includes(trigger.toLowerCase())) {
        matchCount++;
      }
    });

    return matchCount / totalTriggers;
  }

  public async applyPattern(
    pattern: TrainingPattern,
    input: string
  ): Promise<TrainingOutcome> {
    const initialState = this.personalitySystem.getCurrentState();
    const startTime = Date.now();

    // Apply personality modifications
    Object.entries(pattern.traitModifications).forEach(([trait, delta]) => {
      this.personalitySystem.modifyTrait(trait, delta);
    });

    // Update emotional state
    this.emotionalSystem.updateVolatility(
      this.config.adaptiveThresholds.emotionalVolatility
    );

    // Record in memory system
    await this.memorySystem.addMemory(
      `Training pattern ${pattern.name} applied: ${input}`,
      'experience',
      pattern.emotionalShift
    );

    // Track application time
    this.recentApplications.set(pattern.id, new Date());
    const resultingState = this.personalitySystem.getCurrentState();

    // Calculate effectiveness
    const outcome: TrainingOutcome = {
      patternId: pattern.id,
      timestamp: new Date(),
      input,
      initialState,
      resultingState,
      confidenceScore: this.calculateMatchConfidence(input, pattern),
      effectivenessMeasures: {
        emotionalAlignment: this.calculateEmotionalAlignment(
          pattern.emotionalShift,
          resultingState.consciousness.emotionalState
        ),
        narrativeAlignment: this.calculateNarrativeAlignment(
          pattern.narrativePreference,
          resultingState.narrativeMode
        ),
        traitAlignment: this.calculateTraitAlignment(
          pattern.traitModifications,
          resultingState
        )
      }
    };

    // Record outcome
    await this.recordOutcome(outcome);

    return outcome;
  }

  private calculateEmotionalAlignment(
    target: EmotionalState,
    current: EmotionalState
  ): number {
    return target === current ? 1 : 0;
  }

  private calculateNarrativeAlignment(
    target: NarrativeMode,
    current: NarrativeMode
  ): number {
    return target === current ? 1 : 0;
  }

  private calculateTraitAlignment(
    targetModifications: Record<string, number>,
    currentState: PersonalityState
  ): number {
    const traits = Object.keys(targetModifications);
    let totalAlignment = 0;

    // Calculate how well traits aligned with intended modifications
    traits.forEach(trait => {
      const target = targetModifications[trait];
      const current = this.personalitySystem.getTraits()[trait] || 0;
      totalAlignment += Math.max(0, 1 - Math.abs(target - current));
    });

    return totalAlignment / traits.length;
  }

  private async recordOutcome(outcome: TrainingOutcome): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('training_outcomes')
        .insert({
          pattern_id: outcome.patternId,
          timestamp: outcome.timestamp,
          input: outcome.input,
          initial_state: outcome.initialState,
          resulting_state: outcome.resultingState,
          confidence_score: outcome.confidenceScore,
          effectiveness_measures: outcome.effectivenessMeasures
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error recording training outcome:', error);
    }
  }

  private validatePattern(pattern: TrainingPattern): void {
    if (!pattern.id || !pattern.name || !pattern.triggers.length) {
      throw new Error('Invalid pattern: missing required fields');
    }

    if (pattern.minConfidence < 0 || pattern.minConfidence > 1) {
      throw new Error('Invalid pattern: minConfidence must be between 0 and 1');
    }

    if (pattern.cooldownPeriod < 0) {
      throw new Error('Invalid pattern: cooldownPeriod must be positive');
    }
  }
}