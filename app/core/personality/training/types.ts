// app/core/personality/training/types.ts

import { 
    EmotionalState, 
    TweetStyle, 
    NarrativeMode, 
    PersonalityState,
    Context
  } from '../types';

  
  /**
   * Represents a single training pattern that can be applied to modify personality traits
   */
  export interface TrainingPattern {
    id: string;
    name: string;
    description: string;
    triggers: string[];
    themes?: string[]; 
    patterns?: string[];  
    responseStyle: TweetStyle;
    emotionalShift: EmotionalState;
    narrativePreference: NarrativeMode;
    traitModifications: Record<string, number>;
    minConfidence: number;
    cooldownPeriod: number; // in milliseconds
    lastApplied?: Date;
  }

  export interface PromptTemplate {
    id: string;
    name: string;
    content: string;
    type: string;
    is_active: boolean;
    style: string;         // Add this
    patterns: string[];    // Add this
    themes: string[];      // Add this
  }

  export interface TrainingConversation {
    id: string;
    messages: any[]; // Define proper message type
    votes: number;
    is_approved: boolean;
  }
  
  /**
   * Represents the outcome of applying a training pattern
   */
  export interface TrainingOutcome {
    patternId: string;
    timestamp: Date;
    input: string;
    initialState: Partial<PersonalityState>;
    resultingState: Partial<PersonalityState>;
    confidenceScore: number;
    effectivenessMeasures: {
      emotionalAlignment: number;
      narrativeAlignment: number;
      traitAlignment: number;
    };
  }
  
  /**
   * Defines a step in a training sequence
   */
  export interface TrainingStep {
    pattern: TrainingPattern;
    requiredTraits: Record<string, number>;
    requiredEmotionalState?: EmotionalState;
    completionCriteria: (state: PersonalityState) => boolean;
    timeout?: number; // Optional timeout in milliseconds
    retryStrategy?: {
      maxAttempts: number;
      delayBetweenAttempts: number;
    };
  }
  
  /**
   * Represents a complete training sequence
   */
  export interface TrainingSequence {
    id: string;
    name: string;
    description: string;
    version: string;
    steps: TrainingStep[];
    prerequisites?: {
      minimumTraits: Record<string, number>;
      requiredSequences: string[];
    };
    targetPersonality: {
      primaryTraits: Record<string, number>;
      emotionalBaseline: EmotionalState;
      preferredNarrativeModes: NarrativeMode[];
    };
  }
  
  /**
   * Represents an event during training
   */
  export interface TrainingEvent {
    id: string;
    sequenceId?: string;
    stepIndex?: number;
    input: string;
    pattern: TrainingPattern;
    context: Context;
    resultingState: Partial<PersonalityState>;
    timestamp: Date;
    success: boolean;
    metrics: {
      responseTime: number;
      confidenceScore: number;
      emotionalAlignment: number;
      narrativeAlignment: number;
    };
  }
  
  /**
   * Configuration for the training system
   */
  export interface TrainingConfig {
    minConfidenceThreshold: number;
    maxSequentialPatterns: number;
    cooldownPeriod: number;
    adaptiveThresholds: {
      emotionalVolatility: number;
      traitModification: number;
      narrativeShift: number;
    };
    monitoring: {
      trackMetrics: boolean;
      persistEvents: boolean;
      alertThresholds: Record<string, number>;
    };
  }
  
  /**
   * Status of a training sequence
   */
  export interface SequenceStatus {
    sequenceId: string;
    currentStep: number;
    startTime: Date;
    lastUpdateTime: Date;
    completedSteps: number[];
    metrics: {
      averageConfidence: number;
      emotionalStability: number;
      traitProgress: Record<string, number>;
    };
    state: 'active' | 'paused' | 'completed' | 'failed';
    error?: {
      step: number;
      message: string;
      timestamp: Date;
    };
  }
