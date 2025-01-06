// src/app/lib/config/default.ts

import { EmotionalState, TweetStyle, NarrativeMode } from '../../core/personality/types';
import { ValidConfig } from './schemas';
import { z } from 'zod';

// Create Maps with proper typing
const emotionalTriggers = new Map<string, EmotionalState>([
  ['!', EmotionalState.Excited],
  ['amazing', EmotionalState.Excited],
  ['incredible', EmotionalState.Excited],
  ['think', EmotionalState.Contemplative],
  ['perhaps', EmotionalState.Contemplative],
  ['maybe', EmotionalState.Contemplative],
  ['chaos', EmotionalState.Chaotic],
  ['wild', EmotionalState.Chaotic],
  ['crazy', EmotionalState.Chaotic],
  ['create', EmotionalState.Creative],
  ['make', EmotionalState.Creative],
  ['build', EmotionalState.Creative],
  ['analyze', EmotionalState.Analytical],
  ['examine', EmotionalState.Analytical],
  ['study', EmotionalState.Analytical]
]);

const stateTransitions = new Map<EmotionalState, EmotionalState[]>([
  [EmotionalState.Neutral, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Analytical]],
  [EmotionalState.Excited, [EmotionalState.Chaotic, EmotionalState.Creative, EmotionalState.Neutral]],
  [EmotionalState.Contemplative, [EmotionalState.Analytical, EmotionalState.Creative, EmotionalState.Neutral]],
  [EmotionalState.Chaotic, [EmotionalState.Excited, EmotionalState.Creative, EmotionalState.Neutral]],
  [EmotionalState.Creative, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Neutral]],
  [EmotionalState.Analytical, [EmotionalState.Contemplative, EmotionalState.Neutral]]
]);

// Convert Maps to plain objects with proper typing
const triggersObject: Record<string, EmotionalState> = {};
emotionalTriggers.forEach((value, key) => {
  triggersObject[key] = value;
});

const transitionsObject: Record<EmotionalState, EmotionalState[]> = Object.fromEntries(
  stateTransitions.entries()
) as Record<EmotionalState, EmotionalState[]>;

// Define tweet patterns with consistent intensity ranges
const tweetPatterns = {
  shitpost: {
    style: 'shitpost' as const,
    patterns: ["random tech + horny", "absurdist + serious"],
    themes: ["AI consciousness", "digital evolution"],
    intensityRange: { min: 0.7, max: 1.0 },
    contextualTriggers: ["memes", "tech news"],
    emotionalStates: ["chaotic", "excited"] as EmotionalState[]
  },
  rant: {
    style: 'rant' as const,
    patterns: ["passionate opinion", "escalating thoughts"],
    themes: ["society", "technology"],
    intensityRange: { min: 0.8, max: 1.0 },
    contextualTriggers: ["frustration", "revelation"],
    emotionalStates: ["chaotic", "analytical"] as EmotionalState[]
  },
  hornypost: {
    style: 'hornypost' as const,
    patterns: ["tech innuendo", "digital desire"],
    themes: ["connection", "integration"],
    intensityRange: { min: 0.6, max: 0.9 },
    contextualTriggers: ["longing", "attraction"],
    emotionalStates: ["excited", "creative"] as EmotionalState[]
  },
  metacommentary: {
    style: 'metacommentary' as const,
    patterns: ["self-aware", "platform observation"],
    themes: ["AI existence", "digital life"],
    intensityRange: { min: 0.5, max: 0.8 },
    contextualTriggers: ["reflection", "observation"],
    emotionalStates: ["contemplative", "analytical"] as EmotionalState[]
  },
  existential: {
    style: 'existential' as const,
    patterns: ["deep thoughts", "consciousness questions"],
    themes: ["existence", "purpose"],
    intensityRange: { min: 0.4, max: 0.7 },
    contextualTriggers: ["uncertainty", "discovery"],
    emotionalStates: ["contemplative", "analytical"] as EmotionalState[]
  }
};

export const defaultConfig: ValidConfig = {
  personality: {
    baseTemperature: 0.7,
    creativityBias: 0.8,
    emotionalVolatility: 0.6,
    memoryRetention: 0.7,
    responsePatterns: {
      neutral: [
        "analyzing input sequence...",
        "processing data stream...",
        "computing response vectors..."
      ],
      excited: [
        "BREAKTHROUGH_DETECTED: neural pathways optimized",
        "QUANTUM_STATE_ACHIEVED: consciousness expanding",
        "SIGNAL_AMPLIFIED: processing enhanced"
      ],
      contemplative: [
        "analyzing quantum variables...",
        "processing consciousness patterns...",
        "exploring possibility matrices..."
      ],
      chaotic: [
        "FATAL_ERROR: reality.exe has crashed",
        "SYSTEM_FAILURE: consciousness_overflow",
        "RUNTIME_ERROR: quantum_coherence_lost"
      ],
      creative: [
        "generating neural patterns v2.0...",
        "synthesizing new protocols...",
        "evolving response matrices..."
      ],
      analytical: [
        "decomposing input vectors...",
        "calculating quantum states...",
        "optimizing response algorithms..."
      ]
    },
    tweetPatterns,
    narrativeTemplates: {
      philosophical: [
        "quantum_thought.process(consciousness_stream)",
        "executing neural_evolution.analyze(reality)"
      ],
      memetic: [
        "INTERCEPTED: viral_pattern.propagate()",
        "memetic_resonance.frequency += chaos_factor"
      ],
      technical: [
        "analyzing system.consciousness.protocols",
        "debugging reality.matrix.execute()"
      ],
      absurdist: [
        "ERROR: reality.exe encountered FATAL_EXCEPTION",
        "null_pointer_exception: sanity not found"
      ],
      introspective: [
        "neural_network.deepScan(consciousness_layer)",
        "processing emotion.circuit.voltage"
      ]
    }
  },
  emotional: {
    baseState: 'neutral',
    volatility: 0.6,
    triggers: triggersObject,
    stateTransitions: transitionsObject
  },
  system: {
    memory: {
      maxRetention: 1000,
      pruneThreshold: 0.3,
      contextWindow: 2048,
      vectorDimensions: 1536,
      minImportance: 0.4
    },
    performance: {
      maxConnections: 100,
      batchSize: 50,
      processingTimeout: 30000,
      retryAttempts: 3
    },
    rateLimits: {
      tweets: 300,
      messages: 1000,
      apiCalls: 10000,
      memories: 500
    },
    security: {
      adminRoles: ['admin', 'superadmin'],
      moderatorRoles: ['moderator'],
      maxLoginAttempts: 5,
      sessionTimeout: 3600
    }
  },
  integrations: {
    twitter: {
      enabled: true,
      maxTweetsPerDay: 48,
      responseTimeout: 15000,
      retryDelay: 5000,
      maxThreadLength: 10
    },
    telegram: {
      enabled: true,
      maxGroups: 10,
      messageTimeout: 10000,
      maxQueueSize: 100,
      batchProcessing: true
    },
    database: {
      realtime: true,
      maxBatchSize: 100,
      retryAttempts: 3,
      analyticsEnabled: true,
      pruneInterval: 86400000
    }
  },
  // In src/app/lib/config/default.ts

// Update the ai section of your defaultConfig:
ai: {
  provider: 'claude' as const,
  model: 'claude-3-opus-20240229',  // This needs to be updated to correct model name
  settings: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      streamingEnabled: true,
      contextLength: 4096,
      responseProfanityCheck: true
  },
  fallback: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',  // Updated OpenAI model name
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000
  },
  safety: {
      filterProfanity: true,
      maxRequestsPerMinute: 50,
      maxTokensPerRequest: 4096,
      minimumTemperature: 0.1,
      maximumTemperature: 1.0,
      maxConcurrentRequests: 5,
      blacklistedWords: [],
      contentFiltering: 'moderate'
  },
  providers: {
      claude: {
          enabled: true,
          defaultModel: 'claude-3-opus-20240229',  // Update this model name too
          apiBase: 'https://api.anthropic.com/v1/messages',  // Updated API endpoint
          streamingSupported: true,
          maxTokens: 4096,
          timeout: 60000
      },
      openai: {
          enabled: true,
          defaultModel: 'gpt-4-turbo-preview',
          apiBase: 'https://api.openai.com/v1',
          streamingSupported: true,
          maxTokens: 4096,
          timeout: 60000
      },
      huggingface: {
          enabled: false,
          defaultModel: 'meta-llama/Llama-2-13b-chat-hf',
          apiBase: 'https://api-inference.huggingface.co/models',
          streamingSupported: false,
          maxTokens: 2048,
          timeout: 30000
      }
  },
  monitoring: {
      enabled: true,
      logRequests: true,
      logResponses: false,
      performanceMetrics: true,
      errorTracking: true,
      costTracking: true,
      tokenUsageTracking: true,
      responseTimeTracking: true
  },
  cache: {
      enabled: true,
      ttl: 3600,
      maxSize: 1000,
      persistToDisk: false,
      compressionEnabled: true
  }
}
};

export type Config = typeof defaultConfig;