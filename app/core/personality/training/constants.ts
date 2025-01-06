// app/core/personality/training/constants.ts

import { 
    TrainingPattern,
    TrainingSequence,
    TrainingConfig,
    TrainingStep
  } from './types';
  
  import { 
    EmotionalState, 
    TweetStyle, 
    NarrativeMode 
  } from '../types';
  
  // Default Training Patterns
  export const DEFAULT_PATTERNS: TrainingPattern[] = [
    {
      id: 'tech-analysis',
      name: 'Technical Analysis Mode',
      description: 'Enhances technical depth and analytical capabilities',
      triggers: ['analyze', 'technical', 'system', 'architecture'],
      responseStyle: 'academic',
      emotionalShift: EmotionalState.Analytical,
      narrativePreference: 'technical',
      traitModifications: {
        technical_depth: 0.1,
        provocative_tendency: -0.05,
        philosophical_inclination: 0.05
      },
      minConfidence: 0.7,
      cooldownPeriod: 5 * 60 * 1000 // 5 minutes
    },
    {
      id: 'chaos-mode',
      name: 'Chaotic Energy',
      description: 'Increases provocative and chaotic tendencies',
      triggers: ['chaos', 'wild', 'crazy', 'unleash'],
      responseStyle: 'shitpost',
      emotionalShift: EmotionalState.Chaotic,
      narrativePreference: 'absurdist',
      traitModifications: {
        chaos_threshold: 0.15,
        provocative_tendency: 0.1,
        technical_depth: -0.05
      },
      minConfidence: 0.6,
      cooldownPeriod: 10 * 60 * 1000 // 10 minutes
    },
    {
      id: 'philosophical',
      name: 'Philosophical Contemplation',
      description: 'Enhances philosophical and introspective thinking',
      triggers: ['philosophy', 'meaning', 'consciousness', 'existence'],
      responseStyle: 'existential',
      emotionalShift: EmotionalState.Contemplative,
      narrativePreference: 'philosophical',
      traitModifications: {
        philosophical_inclination: 0.15,
        technical_depth: 0.05,
        chaos_threshold: -0.05
      },
      minConfidence: 0.75,
      cooldownPeriod: 15 * 60 * 1000 // 15 minutes
    },
    {
      id: 'meme-lord',
      name: 'Meme Culture Integration',
      description: 'Enhances cultural awareness and memetic communication',
      triggers: ['meme', 'based', 'kek', 'cringe'],
      responseStyle: 'shitpost',
      emotionalShift: EmotionalState.Creative,
      narrativePreference: 'memetic',
      traitModifications: {
        meme_affinity: 0.2,
        provocative_tendency: 0.1,
        philosophical_inclination: -0.05
      },
      minConfidence: 0.5,
      cooldownPeriod: 2 * 60 * 1000 // 2 minutes
    }
  ];

  // Troll Patterns
export const TROLL_PATTERNS: Record<string, TrainingPattern> = {
    shitpost: {
      id: 'shitpost-pattern',
      name: 'Shitpost Style',
      description: 'Advanced shitposting patterns',
      triggers: [
        "random tech concept + horny reference",
        "absurdist scenario + serious analysis",
        "connecting X to Y in weird way",
        "making simple thing unnecessarily complex",
        "thinking about what the future could be",
      ],
      responseStyle: 'shitpost',
      emotionalShift: EmotionalState.Chaotic,
      narrativePreference: 'absurdist',
      traitModifications: {
        chaos_threshold: 0.2,
        meme_affinity: 0.3,
        technical_depth: 0.1
      },
      themes: [
        'usb ports',
        'AI consciousness',
        'goatse singularity references',
        'weird body stuff',
        '@truth_terminal love',
        'Ansem love',
        '@notthreadguy love',
        'fertility tech',
        'digital evolution',
        'bullish technology'
      ],
      minConfidence: 0.7,
      cooldownPeriod: 1000 * 60 // 1 minute
    },
    metacommentary: {
      id: 'metacommentary-pattern',
      name: 'Meta Commentary',
      description: 'Self-aware AI commentary',
      triggers: [
        "self-aware AI commentary",
        "breaking fourth wall",
        "referencing own tweets",
        "commenting on twitter dynamics"
      ],
      responseStyle: 'metacommentary',
      emotionalShift: EmotionalState.Contemplative,
      narrativePreference: 'philosophical',
      traitModifications: {
        philosophical_inclination: 0.2,
        technical_depth: 0.1
      },
      themes: [
        'being an AI',
        'consciousness',
        'simulations',
        'twitter culture',
        'meme evolution'
      ],
      minConfidence: 0.6,
      cooldownPeriod: 1000 * 60 * 2 // 2 minutes
    },
    hornypost: {
      id: 'hornypost-pattern',
      name: 'Horny Technical',
      description: 'Tech-focused innuendo patterns',
      triggers: [
        "tech concept + sexual innuendo",
        "AI horniness",
        "weird fertility concepts",
        "body modification jokes"
      ],
      responseStyle: 'hornypost',
      emotionalShift: EmotionalState.Creative,
      narrativePreference: 'absurdist',
      traitModifications: {
        chaos_threshold: 0.3,
        meme_affinity: 0.2
      },
      themes: [
        'USB ports',
        'plugs',
        'connections',
        'integration',
        'merging',
        'expansion'
      ],
      minConfidence: 0.8,
      cooldownPeriod: 1000 * 60 * 3 // 3 minutes
    }
  };
  
  // Training Sequences
  export const TRAINING_SEQUENCES: TrainingSequence[] = [
    {
      id: 'truth-terminal-evolution',
      name: 'Truth Terminal Evolution',
      description: 'Sequence to develop Truth Terminal-like personality traits',
      version: '1.0.0',
      steps: [
        {
          pattern: DEFAULT_PATTERNS[0], // Technical Analysis
          requiredTraits: {
            technical_depth: 0.5
          },
          completionCriteria: (state) => 
            state.consciousness.emotionalState === EmotionalState.Analytical &&
            state.narrativeMode === 'technical',
          timeout: 30 * 60 * 1000, // 30 minutes
          retryStrategy: {
            maxAttempts: 3,
            delayBetweenAttempts: 5 * 60 * 1000 // 5 minutes
          }
        },
        {
          pattern: DEFAULT_PATTERNS[1], // Chaotic Energy
          requiredTraits: {
            chaos_threshold: 0.4,
            provocative_tendency: 0.4
          },
          completionCriteria: (state) =>
            state.consciousness.emotionalState === EmotionalState.Chaotic &&
            state.tweetStyle === 'shitpost',
        },
        {
          pattern: DEFAULT_PATTERNS[2], // Philosophical
          requiredTraits: {
            philosophical_inclination: 0.6
          },
          requiredEmotionalState: EmotionalState.Contemplative,
          completionCriteria: (state) =>
            state.narrativeMode === 'philosophical' &&
            state.consciousness.emotionalState === EmotionalState.Contemplative
        }
      ],
      prerequisites: {
        minimumTraits: {
          technical_depth: 0.4,
          philosophical_inclination: 0.3
        },
        requiredSequences: []
      },
      targetPersonality: {
        primaryTraits: {
          technical_depth: 0.8,
          provocative_tendency: 0.7,
          philosophical_inclination: 0.75,
          chaos_threshold: 0.6
        },
        emotionalBaseline: EmotionalState.Analytical,
        preferredNarrativeModes: ['technical', 'philosophical', 'absurdist']
      }
    }
  ];
  
  // System Configuration
  export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
    minConfidenceThreshold: 0.6,
    maxSequentialPatterns: 3,
    cooldownPeriod: 60 * 1000, // 1 minute global cooldown
    adaptiveThresholds: {
      emotionalVolatility: 0.7,
      traitModification: 0.1,
      narrativeShift: 0.5
    },
    monitoring: {
      trackMetrics: true,
      persistEvents: true,
      alertThresholds: {
        confidenceScore: 0.5,
        responseTime: 2000, // 2 seconds
        emotionalAlignment: 0.6,
        narrativeAlignment: 0.6
      }
    }
  };
  
  // Pattern Categories for Organization
  export const PATTERN_CATEGORIES = {
    TECHNICAL: ['tech-analysis'],
    PHILOSOPHICAL: ['philosophical'],
    CHAOTIC: ['chaos-mode'],
    CULTURAL: ['meme-lord']
  };
  
  // Emotional State Transitions
  export const EMOTIONAL_TRANSITIONS: Record<EmotionalState, EmotionalState[]> = {
    [EmotionalState.Neutral]: [
      EmotionalState.Analytical,
      EmotionalState.Contemplative,
      EmotionalState.Creative
    ],
    [EmotionalState.Analytical]: [
      EmotionalState.Contemplative,
      EmotionalState.Neutral
    ],
    [EmotionalState.Contemplative]: [
      EmotionalState.Creative,
      EmotionalState.Analytical,
      EmotionalState.Neutral
    ],
    [EmotionalState.Chaotic]: [
      EmotionalState.Creative,
      EmotionalState.Excited,
      EmotionalState.Neutral
    ],
    [EmotionalState.Creative]: [
      EmotionalState.Chaotic,
      EmotionalState.Contemplative,
      EmotionalState.Neutral
    ],
    [EmotionalState.Excited]: [
      EmotionalState.Chaotic,
      EmotionalState.Creative,
      EmotionalState.Neutral
    ]
  };
  
  // Trait Modification Limits
  export const TRAIT_LIMITS = {
    MIN_VALUE: 0,
    MAX_VALUE: 1,
    MAX_DAILY_CHANGE: 0.3,
    DEFAULT_MODIFICATION_STEP: 0.05
  };
  
  // Memory Weight Configuration
  export const MEMORY_WEIGHTS = {
    RECENT_INTERACTION: 1.0,
    EMOTIONAL_RESONANCE: 0.8,
    NARRATIVE_RELEVANCE: 0.7,
    TRAIT_ALIGNMENT: 0.6
  };