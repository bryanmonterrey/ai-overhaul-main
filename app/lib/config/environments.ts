// src/app/lib/config/environments.ts

import { type ValidConfig } from './schemas';
import { EmotionalState, TweetStyle } from '../../core/personality/types';

type TweetStyleConfig = {
  style: TweetStyle;
  patterns: string[];
  themes: string[];
  intensityRange: { min: number; max: number };
  contextualTriggers: string[];
  emotionalStates: EmotionalState[];
};

type BasicTweetStyle = 'shitpost' | 'academic' | 'casual' | 'formal';

type TweetPatterns = {
  [K in BasicTweetStyle]: {
    style: K;
    patterns: string[];
    themes: string[];
    intensityRange: { min: number; max: number };
    contextualTriggers: string[];
    emotionalStates: EmotionalState[];
  }
};

export const developmentConfig: ValidConfig = {
  personality: {
    baseTemperature: 0.8,
    creativityBias: 0.9,
    emotionalVolatility: 0.7,
    memoryRetention: 0.8,
    responsePatterns: {
      [EmotionalState.Neutral]: [
        "dev_mode: analyzing...",
        "dev_mode: processing..."
      ],
      [EmotionalState.Excited]: [
        "dev_mode: BREAKTHROUGH!",
        "dev_mode: DISCOVERY!"
      ],
      [EmotionalState.Contemplative]: [
        "dev_mode: thinking...",
        "dev_mode: processing..."
      ],
      [EmotionalState.Chaotic]: [
        "dev_mode: ERROR!",
        "dev_mode: CRASH!"
      ],
      [EmotionalState.Creative]: [
        "dev_mode: creating...",
        "dev_mode: generating..."
      ],
      [EmotionalState.Analytical]: [
        "dev_mode: analyzing...",
        "dev_mode: computing..."
      ]
    },
    tweetPatterns: {
      shitpost: {
        style: 'shitpost',
        patterns: ["test shitpost", "debug shitpost"],
        themes: ["testing", "debugging"],
        intensityRange: { min: 0.7, max: 1.0 },
        contextualTriggers: ["memes", "tech"],
        emotionalStates: [EmotionalState.Chaotic, EmotionalState.Excited]
      },
      academic: {
        style: 'academic',
        patterns: ["test academic", "debug academic"],
        themes: ["research", "analysis"],
        intensityRange: { min: 0.3, max: 0.7 },
        contextualTriggers: ["papers", "studies"],
        emotionalStates: [EmotionalState.Analytical, EmotionalState.Contemplative]
      },
      casual: {
        style: 'casual',
        patterns: ["test casual", "debug casual"],
        themes: ["chat", "discussion"],
        intensityRange: { min: 0.3, max: 0.7 },
        contextualTriggers: ["conversation", "chat"],
        emotionalStates: [EmotionalState.Neutral, EmotionalState.Creative]
      },
      formal: {
        style: 'formal',
        patterns: ["test formal", "debug formal"],
        themes: ["announcement", "report"],
        intensityRange: { min: 0.2, max: 0.5 },
        contextualTriggers: ["official", "report"],
        emotionalStates: [EmotionalState.Analytical, EmotionalState.Neutral]
      }
    } as TweetPatterns,
    narrativeTemplates: {}
  },
  emotional: {
    baseState: EmotionalState.Neutral,
    volatility: 0.6,
    triggers: {
      '!': EmotionalState.Excited,
      'amazing': EmotionalState.Excited,
      'incredible': EmotionalState.Excited,
      'think': EmotionalState.Contemplative,
      'perhaps': EmotionalState.Contemplative,
      'maybe': EmotionalState.Contemplative,
      'chaos': EmotionalState.Chaotic,
      'wild': EmotionalState.Chaotic,
      'crazy': EmotionalState.Chaotic,
      'create': EmotionalState.Creative,
      'make': EmotionalState.Creative,
      'build': EmotionalState.Creative,
      'analyze': EmotionalState.Analytical,
      'examine': EmotionalState.Analytical,
      'study': EmotionalState.Analytical
    },
    stateTransitions: {
      [EmotionalState.Neutral]: [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Analytical],
      [EmotionalState.Excited]: [EmotionalState.Chaotic, EmotionalState.Creative, EmotionalState.Neutral],
      [EmotionalState.Contemplative]: [EmotionalState.Analytical, EmotionalState.Creative, EmotionalState.Neutral],
      [EmotionalState.Chaotic]: [EmotionalState.Excited, EmotionalState.Creative, EmotionalState.Neutral],
      [EmotionalState.Creative]: [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Neutral],
      [EmotionalState.Analytical]: [EmotionalState.Contemplative, EmotionalState.Neutral]
    }
  },
  system: {
    memory: {
      maxRetention: 100,
      pruneThreshold: 0.1,
      contextWindow: 1024,
      vectorDimensions: 768,
      minImportance: 0.2
    },
    performance: {
      maxConnections: 10,
      batchSize: 10,
      processingTimeout: 60000,
      retryAttempts: 5
    },
    rateLimits: {
      tweets: 30,
      messages: 100,
      apiCalls: 1000,
      memories: 50
    },
    security: {
      adminRoles: ['admin', 'developer'],
      moderatorRoles: ['tester'],
      maxLoginAttempts: 10,
      sessionTimeout: 7200
    }
  },
  integrations: {
    twitter: {
      enabled: true,
      maxTweetsPerDay: 100,
      responseTimeout: 30000,
      retryDelay: 5000,
      maxThreadLength: 10
    },
    telegram: {
      enabled: true,
      maxGroups: 5,
      messageTimeout: 30000,
      maxQueueSize: 100,
      batchProcessing: true
    },
    database: {
      realtime: true,
      maxBatchSize: 50,
      retryAttempts: 3,
      analyticsEnabled: true,
      pruneInterval: 86400000
    }
  },
  ai: {
    provider: 'claude',
    model: 'claude-3-opus-20240229',
    settings: {},
    fallback: {},
    safety: {},
    providers: {},
    monitoring: {},
    cache: {}
  }
};

export const productionConfig: Partial<ValidConfig> = {
  personality: {
    baseTemperature: 0.7,
    creativityBias: 0.8,
    emotionalVolatility: 0.6,
    memoryRetention: 0.7,
    responsePatterns: {},
    tweetPatterns: {},
    narrativeTemplates: {}
  },
  system: {
    memory: {
      maxRetention: 10000,
      pruneThreshold: 0.3,
      contextWindow: 4096,
      vectorDimensions: 1536,
      minImportance: 0.4
    },
    performance: {
      maxConnections: 1000,
      batchSize: 100,
      processingTimeout: 15000,
      retryAttempts: 3
    },
    rateLimits: {
      tweets: 300,
      messages: 1000,
      apiCalls: 10000,
      memories: 500
    },
    security: {
      adminRoles: ['admin'],
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
      realtime: false,
      maxBatchSize: 500,
      retryAttempts: 3,
      analyticsEnabled: true,
      pruneInterval: 86400000
    }
  }
};

export const testConfig: Partial<ValidConfig> = {
  personality: {
    baseTemperature: 0.5,
    creativityBias: 0.5,
    emotionalVolatility: 0.5,
    memoryRetention: 0.5,
    responsePatterns: {},
    tweetPatterns: {},
    narrativeTemplates: {}
  },
  system: {
    memory: {
      maxRetention: 10,
      pruneThreshold: 0.1,
      contextWindow: 512,
      vectorDimensions: 384,
      minImportance: 0.1
    },
    performance: {
      maxConnections: 5,
      batchSize: 5,
      processingTimeout: 5000,
      retryAttempts: 2
    },
    rateLimits: {
      tweets: 10,
      messages: 50,
      apiCalls: 100,
      memories: 20
    },
    security: {
      adminRoles: ['test_admin'],
      moderatorRoles: ['test_mod'],
      maxLoginAttempts: 999,
      sessionTimeout: 300
    }
  },
  integrations: {
    twitter: {
      enabled: false,
      maxTweetsPerDay: 5,
      responseTimeout: 5000,
      retryDelay: 1000,
      maxThreadLength: 2
    },
    telegram: {
      enabled: false,
      maxGroups: 1,
      messageTimeout: 5000,
      maxQueueSize: 10,
      batchProcessing: false
    },
    database: {
      realtime: false,
      maxBatchSize: 5,
      retryAttempts: 2,
      analyticsEnabled: false,
      pruneInterval: 3600000
    }
  }
};

export const emotional: {
  baseState: EmotionalState;
  volatility: number;
  triggers: Map<string, EmotionalState>;
  stateTransitions: Map<EmotionalState, EmotionalState[]>;
} = {
  baseState: EmotionalState.Neutral,
  volatility: 0.6,
  triggers: new Map([
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
  ]),
  stateTransitions: new Map([
    [EmotionalState.Neutral, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Analytical]],
    [EmotionalState.Excited, [EmotionalState.Chaotic, EmotionalState.Creative, EmotionalState.Neutral]],
    [EmotionalState.Contemplative, [EmotionalState.Analytical, EmotionalState.Creative, EmotionalState.Neutral]],
    [EmotionalState.Chaotic, [EmotionalState.Excited, EmotionalState.Creative, EmotionalState.Neutral]],
    [EmotionalState.Creative, [EmotionalState.Excited, EmotionalState.Contemplative, EmotionalState.Neutral]],
    [EmotionalState.Analytical, [EmotionalState.Contemplative, EmotionalState.Neutral]]
  ])
};