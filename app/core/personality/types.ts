export enum EmotionalState {
    Neutral = 'neutral',
    Excited = 'excited',
    Contemplative = 'contemplative',
    Chaotic = 'chaotic',
    Creative = 'creative',
    Analytical = 'analytical'
}
export type TweetStyle = 'shitpost' | 'academic' | 'casual' | 'formal' | 'metacommentary' | 'rant' | 'hornypost' | 'existential';
export type NarrativeMode = 
  | 'analytical' 
  | 'absurdist' 
  | 'philosophical' 
  | 'creative' 
  | 'energetic' 
  | 'balanced';

export type Platform = 'twitter' | 'chat' | 'telegram' | 'internal';

export type MemoryType = 
  | 'chat_history'
  | 'tweet_history'
  | 'trading_params'
  | 'tweet'
  | 'insight'
  | 'trading_history'
  | 'custom_prompts'
  | 'agent_state'
  | 'user_interaction'
  | 'experience'  
  | 'interaction' 
  | 'all'; 

export interface Memory {
  id: string;
  content: string;
  type: string;
  timestamp: Date;
  emotionalContext: EmotionalState;
  platform?: string;
  importance: number;
  associations: string[];
  sentiment?: number;
  decay?: number;
  clusters?: string[];
    chainLinks?: string[];
    evolutionData?: {
        previousStates: Array<{
            timestamp: Date;
            content: string;
            emotionalContext: EmotionalState;
        }>;
    };
}

interface Interaction {
  type: 'message' | 'reaction' | 'action';
  content: string;
  timestamp: Date;
  platform: Platform;
  emotionalContext?: EmotionalState;
}

export interface NarrativeContext {
  mode: NarrativeMode;
  context: Partial<PersonalityState>;
}

export interface PersonalityState {
  consciousness: {
    emotionalState: EmotionalState;
    currentThought: string;
    shortTermMemory: string[];
    longTermMemory: string[];
    attentionFocus: string[];
    activeContexts: Set<string>;
    traits?: Record<string, number>; // Add this to properly type the traits
  };
  emotionalProfile: {
    baseState: EmotionalState;
    volatility: number;
    triggers: Map<string, EmotionalState>;
    stateTransitions: Map<EmotionalState, EmotionalState[]>;
  };
  memories: Memory[];
  tweetStyle: TweetStyle;
  narrativeMode: NarrativeMode;
  currentContext: Context;
}

export interface Context {
  platform: Platform;
  recentInteractions: string[];
  environmentalFactors: {
    timeOfDay: string;
    platformActivity: number;
    socialContext: string[];
    platform: string;
  };
  activeNarratives: string[];
  style?: TweetStyle;  
  memoryContext?: string; 
  additionalContext?: string;
  emotionalContext?: EmotionalState;
}

export interface EmotionalResponse {
  state: EmotionalState | null;
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

export interface ConsciousnessState {
  emotionalState: EmotionalState;
  currentThought: string;
  shortTermMemory: string[];
  longTermMemory: string[];
  attentionFocus: string[];
  activeContexts: Set<string>;
}

export interface PersonalityConfig {
  platform?: 'twitter' | string;
  baseTemperature: number;
  creativityBias: number;
  emotionalVolatility: number;
  memoryRetention: number;
  responsePatterns: Record<EmotionalState, string[]>;
}


export interface MemoryPattern {
  type: MemoryType;
  importance: number;
  triggers: string[];
  associations: string[];
} 

export interface EngagementTarget {
  id: string;
  username: string;
  topics: string[];
  replyProbability: number;
  lastInteraction?: Date;
  relationshipLevel: 'new' | 'familiar' | 'close';
  preferredStyle: TweetStyle;
}

export interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
}

export interface SystemState {
  consciousness: {
    currentThought: string;
    shortTermMemory: string[];
    longTermMemory: Memory[];
    emotionalState: EmotionalState;
    attentionFocus: string[];
  };
  personalityState: PersonalityState;
  emotionalResponse: EmotionalResponse;
  platform: Platform;
}

interface EnvironmentalFactors {
  timeOfDay: 'day' | 'night';
  platformActivity: number;
  socialContext: string[];
  platform: Platform;
}

export interface EnhancedMemoryAnalysis {
  sentiment: number;
  emotional_context: EmotionalState;
  key_concepts: string[];
  patterns: string[];
  importance_score: number;
  associations: string[];
  summary: string;
}

// types.ts

export interface ChainConfig {
  depth: number;
  min_similarity: number;
}

export interface ClusterConfig {
  time_period: 'day' | 'week' | 'month';
  min_cluster_size: number;
  similarity_threshold: number;
}

export interface MemoryChainResponse {
  success: boolean;
  data?: {
      chain: Memory[];
  };
  error?: string;
}

export interface MemoryClusterResponse {
  success: boolean;
  data?: {
      clusters: {
          centroid: string;
          memories: Memory[];
      }[];
  };
  error?: string;
}

export interface MemoryEvolutionResponse {
  success: boolean;
  data?: {
      evolution: {
          [timeframe: string]: {
              sentiment: number;
              frequency: number;
              context_changes: string[];
              related_concepts: string[];
          };
      };
  };
  error?: string;
}

export interface MemoryAnalysis {
  sentiment: number;
  emotional_context: EmotionalState;
  key_concepts: string[];
  patterns: string[];
  importance_score: number;
  associations: string[];
  summary: string;
}

export interface MemoryChain {
  start_memory: Memory;
  chain: Memory[];
  associations: string[];
}

export interface MemoryCluster {
  center: Memory;
  memories: Memory[];
  theme: string;
  coherence_score: number;
}