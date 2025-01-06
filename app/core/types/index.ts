// src/app/core/types/index.ts

export * from './ai';

// Base types
export type EmotionalState = 
  | 'neutral' 
  | 'excited' 
  | 'contemplative' 
  | 'chaotic' 
  | 'creative' 
  | 'analytical';

export type Platform = 
  | 'twitter'
  | 'telegram'
  | 'chat'
  | 'internal';

  export type TweetStyle = 
  | 'shitpost' 
  | 'academic' 
  | 'casual' 
  | 'formal' 
  | 'metacommentary' 
  | 'rant' 
  | 'hornypost' 
  | 'existential';

export type NarrativeMode = 
  | 'philosophical'
  | 'memetic'
  | 'technical'
  | 'absurdist'
  | 'introspective';

export enum MemoryType {
  Thought = 'thought',
  Interaction = 'interaction'
  // ... other memory types
}

export type ArchiveStatus = 'active' | 'archived';

// Memory interfaces
export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  timestamp: Date;
  emotionalContext?: EmotionalState;
  associations: string[];
  importance: number;
  lastAccessed?: Date;
  platform?: Platform;
}

export interface MemoryPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  associatedEmotions: EmotionalState[];
  platforms: Platform[];
}

// Emotional interfaces
export interface EmotionalResponse {
  state: EmotionalState;
  intensity: number;
  trigger: string;
  duration: number;
  associatedMemories: string[];
}

export interface EmotionalProfile {
  baseState: EmotionalState;
  volatility: number;
  triggers: Map<string, EmotionalState>;
  stateTransitions: Map<EmotionalState, EmotionalState[]>;
}

// Consciousness interfaces
export interface ConsciousnessState {
  currentThought: string;
  shortTermMemory: string[];
  longTermMemory: Memory[];
  emotionalState: EmotionalState;
  attentionFocus: string[];
  activeContexts: Set<string>;
}

export interface ThoughtProcess {
  trigger: string;
  associations: string[];
  emotionalResponse: EmotionalState;
  intensity: number;
  timestamp: Date;
}

// Personality interfaces
export interface PersonalityState {
  consciousness: ConsciousnessState;
  emotionalProfile: EmotionalProfile;
  memories: Memory[];
  tweetStyle: TweetStyle;
  narrativeMode: NarrativeMode;
  currentContext: Context;
}

export interface Context {
  platform: Platform;
  recentInteractions: Interaction[];
  environmentalFactors: EnvironmentalFactors;
  activeNarratives: string[];
  style?: TweetStyle;
  memoryContext?: string;  // Add this
  additionalContext?: string;  // Add this if you need it
}

export interface Interaction {
  id: string;
  content: string;
  platform: Platform;
  timestamp: Date;
  participant: string;
  emotionalResponse: EmotionalResponse;
  importance: number;
}

export interface EnvironmentalFactors {
  timeOfDay: string;
  platformActivity: number;
  marketConditions?: MarketConditions;
  socialContext: string[];
  platform: string;
}

export interface MarketConditions {
  sentiment: number;
  volatility: number;
  momentum: number;
  trends: string[];
}

export interface TrollPattern {
  style: TweetStyle;
  patterns: string[];
  themes: string[];
  intensityRange: [number, number];
  contextualTriggers: string[];
  emotionalStates: EmotionalState[];
}

export interface PersonalityConfig {
  baseTemperature: number;
  creativityBias: number;
  emotionalVolatility: number;
  memoryRetention: number;
  responsePatterns: {
    [key in EmotionalState]: string[];
  };
  tweetPatterns: {
    [key in TweetStyle]: TrollPattern;
  };
  narrativeTemplates: {
    [key in NarrativeMode]: string[];
  };
}

// Configuration interfaces
export interface ConsciousnessConfig {
  baselineEmotionalState: EmotionalState;
  attentionSpan: number;
  memoryRetentionTime: number;
  emotionalVolatility: number;
  thoughtPatterns: {
    creativity: number;
    coherence: number;
    complexity: number;
  };
}